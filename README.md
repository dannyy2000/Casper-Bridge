# CasperBridge - Cross-Chain Asset Bridge

A decentralized bridge connecting Casper Network with EVM-compatible chains, with native support for liquid staking tokens.

**Built for Casper Hackathon 2026**

## Overview

CasperBridge enables seamless asset transfers between Casper and Ethereum, unlocking cross-chain DeFi opportunities for CSPR holders and liquid staking token users.

### Key Features

- **Bidirectional Bridge**: Transfer assets between Casper and Ethereum
- **Liquid Staking Support**: Bridge Casper liquid staking tokens (LSTs) to use in Ethereum DeFi
- **Trustless Design**: Decentralized relayer network with cryptographic proofs
- **User-Friendly**: Simple UI powered by CSPR.click wallet integration
- **Production Ready**: Comprehensive testing and security-focused architecture

### Prize Tracks

This project targets:
- **Interoperability Track** - Cross-chain bridge connecting Casper to Ethereum
- **Liquid Staking Track** - Native LST support for cross-chain DeFi
- **Main Track** - High-impact infrastructure for the Casper ecosystem

## Architecture

### Components

1. **Casper Vault Contract** (Rust/Odra)
   - Locks CSPR and LSTs on Casper side
   - Releases assets when proof of burn is provided from Ethereum
   - Manages validator signatures and consensus

2. **Ethereum Wrapper Contract** (Solidity)
   - Mints wrapped CSPR (wCSPR) on Ethereum
   - Burns wCSPR to initiate unlock on Casper
   - ERC-20 compatible for DeFi integration

3. **Relayer Service** (TypeScript)
   - Monitors events on both chains
   - Submits cross-chain transaction proofs
   - Handles cryptographic verification

4. **Frontend dApp** (React)
   - User interface for bridge operations
   - Wallet integration (MetaMask + CSPR.click)
   - Transaction history and status tracking

### Flow Diagram

```
Casper → Ethereum (Lock & Mint):
1. User locks CSPR in Casper Vault Contract
2. Relayer detects lock event
3. Relayer submits proof to Ethereum Wrapper Contract
4. Ethereum contract mints wCSPR to user's address

Ethereum → Casper (Burn & Release):
1. User burns wCSPR on Ethereum
2. Relayer detects burn event
3. Relayer submits proof to Casper Vault Contract
4. Casper contract releases CSPR to user's address
```

## Project Structure

```
casper-bridge/
├── contracts/
│   ├── casper/              # Rust/Odra smart contracts
│   │   ├── Cargo.toml
│   │   ├── src/
│   │   │   ├── lib.rs       # Main vault contract
│   │   │   ├── vault.rs     # Asset locking/releasing logic
│   │   │   └── types.rs     # Custom types and events
│   │   └── tests/
│   │       └── vault_tests.rs
│   └── ethereum/            # Solidity contracts
│       ├── hardhat.config.js
│       ├── package.json
│       ├── contracts/
│       │   ├── CasperBridgeWrapper.sol
│       │   └── interfaces/
│       │       └── IVault.sol
│       └── test/
│           └── wrapper.test.js
├── relayer/                 # Cross-chain relayer
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── index.ts         # Main relayer service
│       ├── casper-monitor.ts
│       ├── ethereum-monitor.ts
│       └── proof-generator.ts
├── frontend/                # React UI
│   ├── package.json
│   ├── public/
│   └── src/
│       ├── App.tsx
│       ├── components/
│       │   ├── BridgeForm.tsx
│       │   ├── TransactionHistory.tsx
│       │   └── WalletConnect.tsx
│       └── hooks/
│           ├── useCasperWallet.ts
│           └── useEthereumWallet.ts
├── docs/
│   ├── architecture.md      # Detailed architecture
│   ├── security.md          # Security considerations
│   └── deployment.md        # Deployment guide
└── README.md
```

## Quick Start

### Prerequisites

- Rust (1.70+) with `wasm32-unknown-unknown` target
- Node.js (18+) and npm
- Casper CLI tools: `cargo install cargo-odra`
- Git

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/casper-bridge.git
cd casper-bridge

# Install Casper contract dependencies
cd contracts/casper
cargo build --release

# Install Ethereum contract dependencies
cd ../ethereum
npm install

# Install relayer dependencies
cd ../../relayer
npm install

# Install frontend dependencies
cd ../frontend
npm install
```

### Get Testnet Tokens

1. **Casper Testnet CSPR**:
   ```bash
   # Generate keys if you don't have them
   casper-client keygen .

   # Get your public key
   cat public_key_hex

   # Request tokens from faucet: https://testnet.cspr.live/tools/faucet
   ```

2. **Ethereum Sepolia ETH**:
   - Use Alchemy or Infura faucet
   - Or get from https://sepoliafaucet.com/

### Development

#### Run Casper Contract Tests

```bash
cd contracts/casper
cargo odra test
```

#### Run Ethereum Contract Tests

```bash
cd contracts/ethereum
npx hardhat test
```

#### Deploy to Testnet

**Casper Testnet**:
```bash
cd contracts/casper
cargo odra deploy -n testnet
```

**Ethereum Sepolia**:
```bash
cd contracts/ethereum
npx hardhat run scripts/deploy.js --network sepolia
```

#### Run Relayer

```bash
cd relayer
cp .env.example .env
# Edit .env with your configuration
npm run dev
```

#### Run Frontend

```bash
cd frontend
npm run dev
```

## Technical Details

### Casper Vault Contract

**Key Functions**:
- `lock_cspr(amount)` - Lock CSPR for bridging
- `lock_lst(token_address, amount)` - Lock liquid staking tokens
- `release(recipient, amount, proof)` - Release assets with burn proof
- `add_validator(address)` - Add relayer validator (admin)

**Security Features**:
- Multi-signature validation
- Replay attack prevention
- Rate limiting
- Emergency pause mechanism

### Ethereum Wrapper Contract

**Key Functions**:
- `mint(recipient, amount, proof)` - Mint wCSPR with lock proof
- `burn(amount)` - Burn wCSPR to unlock on Casper
- `addValidator(address)` - Add relayer validator (admin)

**ERC-20 Compliance**:
- Fully compatible with existing DeFi protocols
- Can be used in Uniswap, Aave, etc.

### Relayer Service

**Features**:
- Event monitoring on both chains
- Proof generation and verification
- Automatic retry logic
- MEV protection
- Health monitoring and alerting

## Roadmap

### Phase 1 - MVP (Week 1-2)
- [x] Project setup and architecture design
- [ ] Casper vault contract implementation
- [ ] Ethereum wrapper contract implementation
- [ ] Basic relayer service
- [ ] Contract deployment to testnets

### Phase 2 - Liquid Staking (Week 2-3)
- [ ] LST support in vault contract
- [ ] Multi-token wrapper on Ethereum
- [ ] Enhanced relayer for LST transfers
- [ ] Integration testing

### Phase 3 - Frontend & Polish (Week 3-4)
- [ ] React UI implementation
- [ ] Wallet integrations
- [ ] Transaction history
- [ ] Demo video production
- [ ] Documentation completion

### Post-Hackathon
- [ ] Security audit
- [ ] Mainnet deployment
- [ ] Additional chain support (Polygon, BSC)
- [ ] DAO governance for validator management

## Testing Strategy

1. **Unit Tests**: Each contract function tested in isolation
2. **Integration Tests**: Full bridge flow testing
3. **Testnet Deployment**: Real-world testing on Casper Testnet + Sepolia
4. **Security Testing**: Fuzzing, edge cases, attack vectors
5. **User Testing**: Community feedback and bug bounty

## Security Considerations

- **Validator Consensus**: Requires M-of-N validator signatures
- **Proof Verification**: Cryptographic verification of cross-chain events
- **Rate Limiting**: Prevents flash loan attacks
- **Emergency Pause**: Admin can pause in case of detected issues
- **Upgradability**: Proxy pattern for bug fixes (with timelock)

See [docs/security.md](docs/security.md) for detailed security analysis.

## Contributing

This is a hackathon project, but contributions are welcome!

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## Resources

### Casper Documentation
- [Casper Docs](https://docs.casper.network)
- [Odra Framework](https://odra.dev/docs)
- [CSPR.click SDK](https://docs.cspr.click)
- [Testnet Explorer](https://testnet.cspr.live)

### Ethereum Documentation
- [Hardhat](https://hardhat.org/docs)
- [OpenZeppelin](https://docs.openzeppelin.com)
- [Ethers.js](https://docs.ethers.org)

### Community & Support
- [Casper Discord](https://discord.gg/caspernetwork) - #hackathon channel
- [Telegram Developers Group](https://t.me/casperdevelopers)
- [Forum](https://forum.casper.network)

## License

MIT License - see [LICENSE](LICENSE) file for details

## Acknowledgments

Built for **Casper Hackathon 2026**

Special thanks to:
- Casper Association for technical support
- Halborn, NodeOps, and NOWNodes for sponsorship
- The Casper developer community

## Contact

- GitHub: https://github.com/dannyy2000
- Twitter:  https://x.com/0xDanny__
- Discord: daniel_18804

---

**Status**: 🚧 In Active Development

**Hackathon Submission**: Targeting Qualification Round (Deadline: Jan 4, 2026)

**Live Demo**: Coming soon

**Testnet Contracts**:
- Casper Vault: `hash-bb63d7f3b51f0c40ba1b70f896c5700e7be6c87d666555c5ac27e41d7c614c96`
- Ethereum Wrapper: `0x08498FBFA0084394dF28555414F80a6C00814542`
