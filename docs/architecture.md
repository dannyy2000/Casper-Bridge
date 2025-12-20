# CasperBridge Architecture

## System Overview

CasperBridge is a trustless cross-chain bridge connecting Casper Network with EVM-compatible chains (initially Ethereum). It enables bidirectional asset transfers while maintaining security through a multi-validator consensus mechanism.

## Core Components

### 1. Casper Vault Contract (Rust/Odra)

**Location**: `contracts/casper/src/lib.rs`

**Responsibilities**:
- Lock CSPR and liquid staking tokens (LSTs) when bridging to Ethereum
- Release assets when valid burn proofs are submitted from Ethereum
- Manage validator set and signature requirements
- Emit events for relayer monitoring
- Prevent replay attacks using nonces

**Key Functions**:
```rust
pub fn lock_cspr(&mut self, destination_chain: String, destination_address: String)
pub fn release_cspr(&mut self, proof: BridgeProof)
pub fn add_validator(&mut self, validator: Address)
pub fn pause(&mut self) // Emergency function
```

**Security Features**:
- Multi-signature validation (M-of-N validators)
- Nonce-based replay protection
- Minimum lock amounts to prevent spam
- Emergency pause mechanism
- Owner-only admin functions

### 2. Ethereum Wrapper Contract (Solidity)

**Location**: `contracts/ethereum/contracts/CasperBridgeWrapper.sol`

**Responsibilities**:
- Mint wCSPR (wrapped CSPR) when CSPR is locked on Casper
- Burn wCSPR to initiate unlock on Casper
- ERC-20 token standard compliance
- Validator management
- Proof verification

**Key Functions**:
```solidity
function mint(MintProof calldata proof) external
function burn(uint256 amount, string calldata destinationChain, string calldata destinationAddress) external
function addValidator(address validator) external onlyOwner
function pause() external onlyOwner
```

**ERC-20 Compliance**:
The wrapper contract implements the full ERC-20 standard, making wCSPR compatible with existing DeFi protocols:
- Uniswap pools
- Aave lending
- Curve stableswap
- Any ERC-20 compatible dApp

### 3. Relayer Service (TypeScript)

**Location**: `relayer/src/`

**Architecture**:
```
┌─────────────────────────────────────┐
│       Bridge Relayer Service        │
├─────────────────┬───────────────────┤
│ Casper Monitor  │ Ethereum Monitor  │
│                 │                   │
│ - Poll events   │ - Poll events     │
│ - Filter logs   │ - Filter logs     │
│ - Validate      │ - Validate        │
│ - Sign proofs   │ - Sign proofs     │
└────────┬────────┴────────┬──────────┘
         │                 │
         ▼                 ▼
    ┌────────┐        ┌────────┐
    │ Casper │        │Ethereum│
    │  Node  │        │  Node  │
    └────────┘        └────────┘
```

**Responsibilities**:
- Monitor events on both chains
- Collect validator signatures
- Generate cryptographic proofs
- Submit cross-chain transactions
- Handle retries and failures
- Log all operations

**Event Flow**:
1. Monitor detects event (Lock or Burn)
2. Wait for confirmation blocks
3. Gather validator signatures
4. Construct proof object
5. Submit to destination chain
6. Verify transaction success

### 4. Frontend dApp (React - To Be Built)

**Planned Location**: `frontend/src/`

**Features**:
- Wallet connection (MetaMask for Ethereum, CSPR.click for Casper)
- Bridge form (amount, direction selection)
- Transaction history
- Status tracking with confirmations
- Network switching
- Balance display

## Bridge Flow Diagrams

### Casper → Ethereum (Lock & Mint)

```
┌──────────┐                                           ┌──────────┐
│   User   │                                           │Relayer(s)│
└────┬─────┘                                           └────┬─────┘
     │                                                       │
     │  1. Lock CSPR + Destination Address                  │
     ├─────────────────────────────────────────┐            │
     │                                          ▼            │
     │                                    ┌─────────────┐   │
     │                                    │Casper Vault │   │
     │                                    │  Contract   │   │
     │                                    └──────┬──────┘   │
     │                                           │          │
     │                         2. Emit AssetLocked Event    │
     │                                           ├──────────▶
     │                                           │          │
     │                            3. Detect Event & Wait    │
     │                               for Confirmations      │
     │                                           │          │
     │                            4. Gather Validator       │
     │                               Signatures             │
     │                                           │          │
     │                            5. Submit Mint Proof      │
     │                                           │          │
     │                                           ▼          │
     │                                   ┌──────────────┐  │
     │                                   │  Ethereum    │  │
     │  6. Receive wCSPR                 │   Wrapper    │  │
     ◀─────────────────────────────────┬─┤   Contract   │  │
                                       │ └──────────────┘  │
                                       │                   │
                                7. Mint wCSPR Event        │
                                       └───────────────────▶
```

### Ethereum → Casper (Burn & Release)

```
┌──────────┐                                           ┌──────────┐
│   User   │                                           │Relayer(s)│
└────┬─────┘                                           └────┬─────┘
     │                                                       │
     │  1. Burn wCSPR + Casper Address                      │
     ├─────────────────────────────────────────┐            │
     │                                          ▼            │
     │                                   ┌──────────────┐   │
     │                                   │  Ethereum    │   │
     │                                   │   Wrapper    │   │
     │                                   │   Contract   │   │
     │                                   └──────┬───────┘   │
     │                                          │           │
     │                         2. Emit AssetBurned Event    │
     │                                          ├───────────▶
     │                                          │           │
     │                            3. Detect Event & Wait    │
     │                               for Confirmations      │
     │                                          │           │
     │                            4. Gather Validator       │
     │                               Signatures             │
     │                                          │           │
     │                            5. Submit Release Proof   │
     │                                          │           │
     │                                          ▼           │
     │                                    ┌─────────────┐  │
     │  6. Receive CSPR                   │Casper Vault │  │
     ◀────────────────────────────────┬───┤  Contract   │  │
                                      │   └─────────────┘  │
                                      │                    │
                               7. Release CSPR Event       │
                                      └────────────────────▶
```

## Security Model

### Multi-Validator Consensus

The bridge uses an M-of-N signature scheme:
- **M**: Required number of signatures (configurable, initially 2)
- **N**: Total number of validators (initially 3-5)

This prevents:
- Single point of failure
- Malicious validator attacks
- Network partition issues

### Replay Attack Prevention

**Nonce System**:
- Each lock/burn gets a unique nonce
- Nonces are marked as processed
- Duplicate nonces are rejected
- Monotonically increasing counter

**Example**:
```rust
// Casper side
assert!(!self.processed_proofs.get(&proof.nonce).unwrap_or(false),
        "Proof already processed");
self.processed_proofs.set(&proof.nonce, true);
```

### Confirmation Blocks

To prevent chain reorganizations from causing issues:
- **Casper**: 3 block confirmations (~3 minutes)
- **Ethereum**: 12 block confirmations (~3 minutes)

### Emergency Pause

Both contracts have pause functionality:
- Owner can pause in case of detected exploit
- All bridge operations halt
- Existing locked funds remain safe
- Can be unpaused after issue resolution

### Rate Limiting (Future Enhancement)

Planned features:
- Maximum lock amount per transaction
- Maximum total locked amount
- Cooldown periods between large transfers
- Circuit breaker for unusual activity

## Data Structures

### BridgeProof (Casper)

```rust
#[odra::odra_type]
pub struct BridgeProof {
    pub source_chain: String,          // "ethereum"
    pub source_tx_hash: String,        // Ethereum tx hash
    pub amount: U256,                  // Amount to release
    pub recipient: Address,            // Casper recipient
    pub nonce: u64,                    // Unique identifier
    pub validator_signatures: Vec<String>, // M signatures
}
```

### MintProof (Ethereum)

```solidity
struct MintProof {
    string sourceChain;        // "casper"
    string sourceTxHash;       // Casper deploy hash
    uint256 amount;            // Amount to mint
    address recipient;         // Ethereum recipient
    uint256 nonce;             // Unique identifier
    bytes[] validatorSignatures; // M signatures
}
```

## Deployment Architecture

### Testnet Deployment

```
Casper Testnet (casper-test)
├── Vault Contract: contract-hash-...
├── Testnet Faucet: testnet.cspr.live/tools/faucet
└── RPC: 65.21.235.219:7777

Ethereum Sepolia
├── Wrapper Contract: 0x...
├── Testnet Faucet: sepoliafaucet.com
└── RPC: rpc.sepolia.org

Relayer Service
├── Hosted on: Cloud VPS (AWS/DigitalOcean)
├── Monitoring: Both chains simultaneously
└── High Availability: Multiple relayer instances
```

### Mainnet Deployment (Future)

- Enhanced security audits
- More validators (5-7)
- Higher signature requirements (3-of-5 or 4-of-7)
- Professional node infrastructure
- 24/7 monitoring and alerting
- Insurance fund for bridge protection

## Scalability Considerations

### Current Throughput

- **Casper**: ~100 TPS theoretical, bridge limited by confirmation times
- **Ethereum**: ~15 TPS, gas costs are main limitation
- **Effective Bridge Throughput**: ~1-2 transactions per minute (due to confirmations)

### Optimization Opportunities

1. **Batch Processing**: Collect multiple bridge requests and process together
2. **Layer 2 Integration**: Deploy on Ethereum L2s (Arbitrum, Optimism)
3. **State Channels**: For frequent traders, use off-chain channels
4. **Validator Optimization**: Faster signature aggregation
5. **Gas Optimization**: Optimize Solidity code for lower gas costs

## Liquid Staking Integration

### Phase 2 Enhancement

The bridge will support Casper liquid staking tokens:

**Supported LSTs**:
- Casper native LSTs
- Third-party staking derivative tokens

**Architecture Changes**:
```rust
// Enhanced vault contract
pub fn lock_lst(&mut self,
    token_address: Address,
    amount: U256,
    destination_chain: String,
    destination_address: String
)

pub fn release_lst(&mut self,
    token_address: Address,
    proof: BridgeProof
)
```

**Benefits**:
- Use staked CSPR in Ethereum DeFi
- Earn staking rewards while using assets
- Increased capital efficiency
- Attracts more liquidity to Casper

## Monitoring & Observability

### Metrics to Track

1. **Bridge Health**:
   - Total value locked (TVL)
   - Transaction success rate
   - Average confirmation time
   - Failed transaction reasons

2. **Relayer Health**:
   - Uptime percentage
   - Event detection latency
   - Signature collection time
   - Gas costs

3. **Security Metrics**:
   - Validator participation rate
   - Signature verification failures
   - Attempted replay attacks
   - Pause events

### Logging

All components use structured logging:
- Timestamp
- Log level (info, warn, error)
- Component identifier
- Transaction/event details
- Error stack traces

## Testing Strategy

### Unit Tests

- Contract function tests (Rust + Solidity)
- Proof validation logic
- Access control mechanisms
- Edge cases and error conditions

### Integration Tests

- Full bridge flow (lock → mint)
- Reverse flow (burn → release)
- Multi-validator coordination
- Failure recovery scenarios

### Security Testing

- Replay attack attempts
- Double-spend prevention
- Unauthorized access attempts
- Reentrancy protection
- Integer overflow/underflow

### Testnet Testing

- Real-world network conditions
- Actual blockchain confirmations
- Gas cost estimation
- User experience validation

## Future Enhancements

### Multi-Chain Support

Expand beyond Ethereum:
- Polygon
- BNB Smart Chain
- Arbitrum
- Optimism

### Advanced Features

- **Flash Loans**: Borrow wCSPR for same-block repayment
- **Limit Orders**: Automated bridging at target prices
- **Bridge Aggregation**: Route through cheapest path
- **NFT Bridging**: Cross-chain NFT transfers

### Governance

- DAO for validator management
- Community voting on parameters
- Fee distribution to token holders
- Protocol upgrades

## References

- [Casper Documentation](https://docs.casper.network)
- [Odra Framework](https://odra.dev/docs)
- [OpenZeppelin Contracts](https://docs.openzeppelin.com)
- [Bridge Security Best Practices](https://ethereum.org/en/developers/docs/bridges/)
