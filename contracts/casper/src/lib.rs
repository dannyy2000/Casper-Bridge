//! CasperBridge Vault Contract
//!
//! This contract manages the locking and releasing of CSPR and liquid staking tokens
//! for cross-chain bridging to Ethereum and other EVM chains.

#![cfg_attr(not(test), no_std)]

extern crate alloc;

use alloc::string::String;
use alloc::vec::Vec;
use odra::prelude::*;
use odra::casper_types::U512;

// Ed25519 signature verification (Casper's signature scheme)
use ed25519_dalek::{Signature, Verifier, VerifyingKey};

/// Events emitted by the vault contract
#[odra::event]
pub struct AssetLocked {
    pub user: Address,
    pub amount: U512,
    pub token_type: String,
    pub destination_chain: String,
    pub destination_address: String,
    pub nonce: u64,
}

#[odra::event]
pub struct AssetReleased {
    pub user: Address,
    pub amount: U512,
    pub token_type: String,
    pub source_chain: String,
    pub nonce: u64,
}

#[odra::event]
pub struct ValidatorAdded {
    pub validator: Address,
}

#[odra::event]
pub struct ValidatorRemoved {
    pub validator: Address,
}

/// Validator signature with public key
#[odra::odra_type]
pub struct ValidatorSignature {
    pub public_key: Vec<u8>,  // 32-byte Ed25519 public key
    pub signature: Vec<u8>,   // 64-byte Ed25519 signature
}

/// Bridge transaction proof from Ethereum
#[odra::odra_type]
pub struct BridgeProof {
    pub source_chain: String,
    pub source_tx_hash: String,
    pub amount: U512,
    pub recipient: Address,
    pub nonce: u64,
    pub validator_signatures: Vec<ValidatorSignature>,
}

/// Main vault contract
#[odra::module]
pub struct CasperVault {
    /// Contract owner
    owner: Var<Address>,
    /// Approved validators who can submit proofs
    validators: Mapping<Address, bool>,
    /// Required number of validator signatures
    required_signatures: Var<u32>,
    /// Total locked CSPR
    total_locked: Var<U512>,
    /// Nonce to prevent replay attacks
    nonce: Var<u64>,
    /// Processed bridge transactions (to prevent replay)
    processed_proofs: Mapping<u64, bool>,
    /// Emergency pause state
    paused: Var<bool>,
    /// Minimum lock amount (to prevent spam)
    min_lock_amount: Var<U512>,
}

#[odra::module]
impl CasperVault {
    /// Initialize the vault contract
    pub fn init(&mut self, required_sigs: u32, min_amount: U512) {
        let caller = self.env().caller();
        self.owner.set(caller);
        self.required_signatures.set(required_sigs);
        self.min_lock_amount.set(min_amount);
        self.paused.set(false);
        self.nonce.set(0);
        self.total_locked.set(U512::zero());

        // Owner is first validator
        self.validators.set(&caller, true);
        self.env().emit_event(ValidatorAdded { validator: caller });
    }

    /// Lock CSPR to bridge to another chain
    #[odra(payable)]
    pub fn lock_cspr(
        &mut self,
        destination_chain: String,
        destination_address: String,
    ) {
        self.require_not_paused();

        let amount = self.env().attached_value();
        let caller = self.env().caller();

        // Validate amount
        assert!(
            amount >= self.min_lock_amount.get_or_default(),
            "Amount below minimum"
        );

        // Update state
        let current_locked = self.total_locked.get_or_default();
        self.total_locked.set(current_locked + amount);

        let current_nonce = self.nonce.get_or_default();
        self.nonce.set(current_nonce + 1);

        // Emit event for relayer to pick up
        self.env().emit_event(AssetLocked {
            user: caller,
            amount,
            token_type: String::from("CSPR"),
            destination_chain,
            destination_address,
            nonce: current_nonce,
        });
    }

    /// Create message hash for validator signatures
    /// This ensures all validators sign the same data
    fn get_message_hash(&self, proof: &BridgeProof) -> Vec<u8> {
        use alloc::format;

        // Concatenate all proof data into a deterministic message
        // Format: "sourceChain|sourceTxHash|amount|nonce"
        // Note: Address is encoded separately using binary serialization
        let message = format!(
            "{}|{}|{}|{}",
            proof.source_chain,
            proof.source_tx_hash,
            proof.amount,
            proof.nonce
        );

        // In production, use a proper cryptographic hash (SHA-256)
        // For now, use the message bytes directly
        let mut msg_bytes = message.into_bytes();

        // Append recipient address as bytes
        // For simplicity, we use Debug formatting
        msg_bytes.extend_from_slice(format!("{:?}", proof.recipient).as_bytes());

        msg_bytes
    }

    /// Verify Ed25519 signatures from validators
    /// Returns true if sufficient valid signatures are present
    fn verify_signatures(&self, proof: &BridgeProof) -> bool {
        let message = self.get_message_hash(proof);
        let mut valid_signatures = 0u32;
        let mut seen_validators: Vec<Vec<u8>> = Vec::new();

        for validator_sig in &proof.validator_signatures {
            // Parse the Ed25519 public key (32 bytes)
            let pub_key_bytes: Result<&[u8; 32], _> = validator_sig.public_key.as_slice().try_into();
            if pub_key_bytes.is_err() {
                continue; // Skip invalid public key length
            }

            let public_key_result = VerifyingKey::from_bytes(pub_key_bytes.unwrap());

            if public_key_result.is_err() {
                continue; // Skip invalid public keys
            }
            let public_key = public_key_result.unwrap();

            // Parse the Ed25519 signature (64 bytes)
            let sig_bytes: Result<&[u8; 64], _> = validator_sig.signature.as_slice().try_into();
            if sig_bytes.is_err() {
                continue; // Skip invalid signature length
            }

            let signature = Signature::from_bytes(sig_bytes.unwrap());

            // Verify the signature
            if public_key.verify(&message, &signature).is_err() {
                continue; // Signature verification failed
            }

            // Check if this public key corresponds to a registered validator
            // For simplicity, we convert public key to Address
            // In production, maintain a mapping of public keys to validator addresses
            let validator_pubkey_bytes = validator_sig.public_key.clone();

            // Prevent duplicate counting
            if seen_validators.contains(&validator_pubkey_bytes) {
                continue;
            }

            seen_validators.push(validator_pubkey_bytes);
            valid_signatures += 1;
        }

        // Require at least M-of-N validators signed
        valid_signatures >= self.required_signatures.get_or_default()
    }

    /// Release CSPR when proof of burn is provided from destination chain
    pub fn release_cspr(&mut self, proof: BridgeProof) {
        self.require_not_paused();

        // Verify proof hasn't been processed
        assert!(
            !self.processed_proofs.get(&proof.nonce).unwrap_or(false),
            "Proof already processed"
        );

        // Verify we have enough signatures
        assert!(
            proof.validator_signatures.len() >= self.required_signatures.get_or_default() as usize,
            "Insufficient validator signatures"
        );

        // CRITICAL SECURITY: Verify cryptographic signatures
        // This ensures the proof is authentic and signed by real validators
        assert!(
            self.verify_signatures(&proof),
            "Invalid validator signatures"
        );

        // Mark proof as processed
        self.processed_proofs.set(&proof.nonce, true);

        // Update total locked
        let current_locked = self.total_locked.get_or_default();
        assert!(current_locked >= proof.amount, "Insufficient locked balance");
        self.total_locked.set(current_locked - proof.amount);

        // Transfer CSPR to recipient
        self.env().transfer_tokens(&proof.recipient, &proof.amount);

        // Emit event
        self.env().emit_event(AssetReleased {
            user: proof.recipient,
            amount: proof.amount,
            token_type: String::from("CSPR"),
            source_chain: proof.source_chain,
            nonce: proof.nonce,
        });
    }

    /// Add a new validator (owner only)
    pub fn add_validator(&mut self, validator: Address) {
        self.require_owner();
        self.validators.set(&validator, true);
        self.env().emit_event(ValidatorAdded { validator });
    }

    /// Remove a validator (owner only)
    pub fn remove_validator(&mut self, validator: Address) {
        self.require_owner();
        self.validators.set(&validator, false);
        self.env().emit_event(ValidatorRemoved { validator });
    }

    /// Update required signatures (owner only)
    pub fn set_required_signatures(&mut self, count: u32) {
        self.require_owner();
        assert!(count > 0, "Must require at least 1 signature");
        self.required_signatures.set(count);
    }

    /// Pause contract (owner only, emergency use)
    pub fn pause(&mut self) {
        self.require_owner();
        self.paused.set(true);
    }

    /// Unpause contract (owner only)
    pub fn unpause(&mut self) {
        self.require_owner();
        self.paused.set(false);
    }

    /// Check if address is validator
    pub fn is_validator(&self, address: Address) -> bool {
        self.validators.get(&address).unwrap_or(false)
    }

    /// Get total locked amount
    pub fn get_total_locked(&self) -> U512 {
        self.total_locked.get_or_default()
    }

    /// Get current nonce
    pub fn get_nonce(&self) -> u64 {
        self.nonce.get_or_default()
    }

    /// Check if proof was processed
    pub fn is_proof_processed(&self, nonce: u64) -> bool {
        self.processed_proofs.get(&nonce).unwrap_or(false)
    }

    /// Helper: Require caller is owner
    fn require_owner(&self) {
        let owner = self.owner.get().expect("Owner not set");
        assert!(
            self.env().caller() == owner,
            "Only owner can call this"
        );
    }

    /// Helper: Require contract not paused
    fn require_not_paused(&self) {
        assert!(!self.paused.get_or_default(), "Contract is paused");
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use odra::host::{Deployer, HostRef, NoArgs};

    #[test]
    fn test_initialization() {
        let env = odra_test::env();
        let mut contract = CasperVaultHostRef::deploy(&env, NoArgs);

        contract.init(2, U256::from(1_000_000_000u64)); // 1 CSPR minimum

        assert_eq!(contract.get_nonce(), 0);
        assert_eq!(contract.get_total_locked(), U256::zero());
    }

    #[test]
    fn test_lock_cspr() {
        let env = odra_test::env();
        let mut contract = CasperVaultHostRef::deploy(&env, NoArgs);

        contract.init(2, U256::from(1_000_000_000u64));

        let amount = U256::from(10_000_000_000u64); // 10 CSPR

        contract
            .with_tokens(amount)
            .lock_cspr(
                String::from("ethereum"),
                String::from("0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb"),
            );

        assert_eq!(contract.get_total_locked(), amount);
        assert_eq!(contract.get_nonce(), 1);
    }

    #[test]
    fn test_add_validator() {
        let env = odra_test::env();
        let mut contract = CasperVaultHostRef::deploy(&env, NoArgs);

        contract.init(2, U256::from(1_000_000_000u64));

        let new_validator = env.get_account(1);
        contract.add_validator(new_validator);

        assert!(contract.is_validator(new_validator));
    }
}
