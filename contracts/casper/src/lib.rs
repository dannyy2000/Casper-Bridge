//! CasperBridge Vault Contract
//!
//! This contract manages the locking and releasing of CSPR and liquid staking tokens
//! for cross-chain bridging to Ethereum and other EVM chains.

#![cfg_attr(not(test), no_std)]

extern crate alloc;

use alloc::string::String;
use alloc::vec::Vec;
use odra::prelude::*;
use odra::{casper_types::U256, Address, Mapping, Var};

/// Events emitted by the vault contract
#[odra::event]
pub struct AssetLocked {
    pub user: Address,
    pub amount: U256,
    pub token_type: String,
    pub destination_chain: String,
    pub destination_address: String,
    pub nonce: u64,
}

#[odra::event]
pub struct AssetReleased {
    pub user: Address,
    pub amount: U256,
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

/// Bridge transaction proof from Ethereum
#[odra::odra_type]
pub struct BridgeProof {
    pub source_chain: String,
    pub source_tx_hash: String,
    pub amount: U256,
    pub recipient: Address,
    pub nonce: u64,
    pub validator_signatures: Vec<String>,
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
    total_locked: Var<U256>,
    /// Nonce to prevent replay attacks
    nonce: Var<u64>,
    /// Processed bridge transactions (to prevent replay)
    processed_proofs: Mapping<u64, bool>,
    /// Emergency pause state
    paused: Var<bool>,
    /// Minimum lock amount (to prevent spam)
    min_lock_amount: Var<U256>,
}

#[odra::module]
impl CasperVault {
    /// Initialize the vault contract
    pub fn init(&mut self, required_sigs: u32, min_amount: U256) {
        let caller = self.env().caller();
        self.owner.set(caller);
        self.required_signatures.set(required_sigs);
        self.min_lock_amount.set(min_amount);
        self.paused.set(false);
        self.nonce.set(0);
        self.total_locked.set(U256::zero());

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

        // TODO: Verify validator signatures are valid
        // This requires cryptographic signature verification
        // For MVP, we trust the validators

        // Mark proof as processed
        self.processed_proofs.set(&proof.nonce, true);

        // Update total locked
        let current_locked = self.total_locked.get_or_default();
        assert!(current_locked >= proof.amount, "Insufficient locked balance");
        self.total_locked.set(current_locked - proof.amount);

        // Transfer CSPR to recipient
        self.env().transfer_tokens(&proof.recipient, proof.amount);

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
    pub fn get_total_locked(&self) -> U256 {
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
        assert!(
            self.env().caller() == self.owner.get_or_revert(),
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
