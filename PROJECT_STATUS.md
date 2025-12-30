# CasperBridge Project Status
**Last Updated**: December 29, 2025

## 🎯 Project Overview
Cross-chain bridge enabling CSPR token transfers between Casper Network and Ethereum (Sepolia testnet).

---

## ✅ COMPLETED COMPONENTS

### 1. Ethereum Smart Contract ✅
- **Status**: Deployed & Operational
- **Contract Address**: `0x08498FBFA0084394dF28555414F80a6C00814542`
- **Network**: Sepolia Testnet
- **Explorer**: https://sepolia.etherscan.io/address/0x08498FBFA0084394dF28555414F80a6C00814542
- **Functionality**:
  - ✅ Mint wrapped CSPR tokens
  - ✅ Burn tokens for bridge back to Casper
  - ✅ Multi-signature validator system
  - ✅ Tested burn flow successfully

### 2. Casper Smart Contract ✅ DEPLOYED
- **Status**: Successfully Deployed & Initialized on Casper 2.1 Testnet
- **Contract Hash**: `hash-bb63d7f3b51f0c40ba1b70f896c5700e7be6c87d666555c5ac27e41d7c614c96`
- **Entity Address**: `entity-contract-bb63d7f3b51f0c40ba1b70f896c5700e7be6c87d666555c5ac27e41d7c614c96`
- **Contract Package**: `contract-package-c0837569051230341883338ac73b4dc65c65c6faa4a83611f95cf5b825a09ff3`
- **Named Key**: `bridge_vault_final`
- **Network**: Casper 2.1 Testnet (casper-test)
- **Explorer**: https://testnet.cspr.live/contract/bb63d7f3b51f0c40ba1b70f896c5700e7be6c87d666555c5ac27e41d7c614c96
- **WASM Location**: `contracts/casper/target/wasm32-unknown-unknown/release/casper_bridge_vault.wasm`
- **WASM Size**: 93 KB
- **Dependencies**: casper-contract 5.0.0, casper-types 6.0.0, base64ct 1.7.2
- **Rust Version**: nightly-2024-07-31
- **Configuration**: required_sigs=1, min_amount=1,000,000,000
- **Deployment Transactions**:
  - Install: `c735d303f4c29aa89d1c6dc9f1168c9cd14b165ac5e7290b9070913606c4c82c`
  - Init: `ea445c29c7a2d9b65f9822c130c0de8067fb0743b60244f047e242e64bc5bbc1`
- **Functionality**:
  - ✅ Lock CSPR for bridging to Ethereum
  - ✅ Release CSPR when proof verified from Ethereum
  - ✅ Validator management (add/remove)
  - ✅ Pause/unpause mechanism
  - ✅ Nonce-based replay protection
  - ✅ Multi-signature verification
  - ✅ Query functions (is_validator, get_total_locked, get_nonce)

### 3. Relayer Service ✅
- **Status**: Code complete, build successful, ready for testing
- **Location**: `relayer/`
- **Components**:
  - ✅ `ethereum-monitor.ts` - Monitors Ethereum for AssetBurned events
  - ✅ `casper-monitor.ts` - Monitors Casper for AssetLocked events
  - ✅ `signature-utils.ts` - Multi-sig aggregation and verification
  - ✅ `index.ts` - Main relayer orchestration
  - ✅ `logger.ts` - Structured logging
- **Configuration**:
  - ✅ `.env` file created with Ethereum contract address
  - ⚠️ **Needs**: Your Ethereum private key (validator/relayer account)
  - ⚠️ **Needs**: Casper contract address when deployed
- **Build Status**: ✅ TypeScript compilation successful

### 4. Frontend Application ✅
- **Status**: Code complete, ready for testing
- **Location**: `frontend/`
- **Framework**: React + Vite + TypeScript
- **Configuration**:
  - ✅ Ethereum contract address configured
  - ✅ Casper RPC endpoint updated to working node
  - ⚠️ **Needs**: Casper contract address when deployed
- **Features**:
  - Bridge UI for both directions
  - Wallet connection (MetaMask, Casper Wallet)
  - Transaction history
  - Balance display

---

## ⏳ PENDING TASKS

### HIGH PRIORITY (Blockers)

#### 1. Resolve Casper Contract Deployment ⚠️
**Current Issue**: `ApiError::Unhandled [31]`

**Attempted Solutions**:
- ✅ Used correct library versions (casper-contract 1.4.4)
- ✅ Tried multiple deployment methods (put-deploy, put-transaction)
- ✅ Tested minimal contract (same error)
- ✅ Used correct Casper 2.0 parameters (--pricing-mode classic, --standard-payment)

**Next Steps**:
1. Ask in Casper Discord: https://discord.gg/casperblockchain
   - Mention `ApiError::Unhandled [31]` with Casper 2.0 testnet
   - Share deployment command and contract structure
2. Alternative: Test on local NCTL network first
3. Check if Casper 2.0 requires different contract patterns

**Deployment Command** (when issue resolved):
```bash
casper-client put-transaction session \
  --node-address http://34.220.83.153:7777 \
  --chain-name casper-test \
  --secret-key /tmp/casper_deploy_key.pem \
  --wasm-path ./target/wasm32-unknown-unknown/release/casper_bridge_vault.wasm \
  --payment-amount 100000000000 \
  --standard-payment "true" \
  --gas-price-tolerance 10 \
  --pricing-mode classic \
  --session-arg "contract_name:string='casper_bridge'" \
  --session-arg "required_sigs:u32='1'" \
  --session-arg "min_amount:u512='1000000000'"
```

Then call init:
```bash
casper-client put-transaction invocable-entity \
  --node-address http://34.220.83.153:7777 \
  --chain-name casper-test \
  --secret-key /tmp/casper_deploy_key.pem \
  --payment-amount 5000000000 \
  --standard-payment "true" \
  --gas-price-tolerance 10 \
  --pricing-mode classic \
  --entity-hash <CONTRACT_HASH_FROM_DEPLOYMENT> \
  --entry-point "init" \
  --arg "required_sigs:u32='1'" \
  --arg "min_amount:u512='1000000000'"
```

#### 2. Add Ethereum Private Key to Relayer
**File**: `relayer/.env`
**Line to update**:
```bash
ETHEREUM_PRIVATE_KEY=YOUR_ETHEREUM_PRIVATE_KEY_HERE
```
**Note**: Use a dedicated validator/relayer account, NOT your main wallet

### HIGH PRIORITY (Now that Casper is deployed)

#### 3. Update All Contract Addresses ⚠️

**A. Frontend Config** (`frontend/src/config/contracts.ts`):
```typescript
vaultContract: 'hash-bb63d7f3b51f0c40ba1b70f896c5700e7be6c87d666555c5ac27e41d7c614c96',
```

**B. Relayer Config** (`relayer/.env`):
```bash
CASPER_VAULT_CONTRACT=hash-bb63d7f3b51f0c40ba1b70f896c5700e7be6c87d666555c5ac27e41d7c614c96
CASPER_PRIVATE_KEY_HEX=YOUR_ED25519_PRIVATE_KEY_HEX  # Convert from PEM
```

**C. Add Ethereum Private Key** (`relayer/.env`):
```bash
ETHEREUM_PRIVATE_KEY=YOUR_ETHEREUM_PRIVATE_KEY_HERE
```

#### 4. Test Relayer
```bash
cd relayer
npm install
npm run build
npm start
```

**Expected Behavior**:
- Connects to both Ethereum and Casper RPCs
- Starts monitoring for events
- Logs "✅ Relayer service started successfully"

**Test Scenarios**:
1. Burn tokens on Ethereum → Check relayer detects event
2. Verify relayer submits release proof to Casper
3. Lock tokens on Casper → Check relayer detects event
4. Verify relayer submits mint proof to Ethereum

#### 5. Test Frontend
```bash
cd frontend
npm install
npm run dev
```

**Test Scenarios**:
1. Connect MetaMask (Sepolia)
2. Connect Casper Wallet
3. Test Ethereum→Casper bridge
4. Test Casper→Ethereum bridge
5. View transaction history

### LOW PRIORITY

#### 6. Production Deployment
- Deploy frontend to Vercel/Netlify
- Set up monitoring for relayer
- Configure alerts for failed transactions
- Set up multiple relayer instances for redundancy

---

## 📊 CURRENT CONFIGURATION

### Ethereum (Sepolia)
- **RPC**: https://eth-sepolia.g.alchemy.com/v2/wHwbkttFi9IOFoM5Wzh31Gw1IvNHL-lt
- **Chain ID**: 11155111
- **Contract**: 0x08498FBFA0084394dF28555414F80a6C00814542
- **Explorer**: https://sepolia.etherscan.io

### Casper (Testnet)
- **RPC**: http://34.220.83.153:7777/rpc
- **Chain Name**: casper-test
- **Contract**: PENDING_DEPLOYMENT
- **Explorer**: https://testnet.cspr.live

### Relayer Settings
- **Poll Interval**: 5 seconds
- **Confirmation Blocks** (Casper): 3
- **Confirmation Blocks** (Ethereum): 12

---

## 🔑 REQUIRED CREDENTIALS

### What You Need to Provide:

1. **Ethereum Private Key** (for relayer)
   - Account that will act as validator/relayer
   - Needs sufficient Sepolia ETH for gas
   - Add to `relayer/.env`

2. **Casper Private Key Hex** (for relayer)
   - Convert `/tmp/casper_deploy_key.pem` to hex format
   - Add to `relayer/.env`

### Security Notes:
- Never commit `.env` files
- Use dedicated accounts for relayer (not personal wallets)
- Keep production keys separate from testnet keys

---

## 📝 NEXT IMMEDIATE ACTIONS

1. **Ask Casper Discord** about ApiError::Unhandled [31]
   - Discord: https://discord.gg/casperblockchain
   - Channel: #technical-support or #smart-contracts
   - Question: "Getting ApiError::Unhandled [31] when deploying contracts to Casper 2.0 testnet with put-transaction. Even minimal contracts fail. Using casper-contract 1.4.4. Any known issues?"

2. **Add your Ethereum private key** to `relayer/.env`

3. **Wait for Casper deployment resolution**, then:
   - Deploy contract
   - Update all configurations
   - Test relayer
   - Test frontend
   - Deploy to production

---

## 🎓 HELPFUL COMMANDS

### Build & Test
```bash
# Ethereum contract
cd contracts/ethereum
npx hardhat test

# Casper contract
cd contracts/casper
cargo build --release --target wasm32-unknown-unknown

# Relayer
cd relayer
npm run build
npm start

# Frontend
cd frontend
npm run dev
```

### Check Balances
```bash
# Ethereum (check deployed contract)
cd contracts/ethereum
node check-balance.js

# Casper (check deploy key account)
casper-client get-balance \
  --node-address http://34.220.83.153:7777 \
  --public-key 0203d67680af8fe885ac24986a8c6b8c4cc6be1ef6e06a3cf22beedc557e91b80270
```

---

## 🐛 KNOWN ISSUES

1. **Casper Deployment**: ApiError::Unhandled [31]
   - Affects all contracts on Casper 2.0 testnet
   - Not a code issue - likely environment/testnet configuration
   - Awaiting community guidance

---

## ✅ TESTING CHECKLIST

### Pre-Deployment
- [x] Ethereum contract compiled
- [x] Ethereum contract deployed
- [x] Ethereum contract tested (burn flow)
- [x] Casper contract compiled
- [ ] Casper contract deployed
- [ ] Casper contract tested (init)
- [x] Relayer code complete
- [x] Relayer builds successfully
- [x] Frontend code complete
- [x] Frontend builds successfully

### Post-Deployment (Casper)
- [ ] Casper contract initialized
- [ ] Casper contract lock tested
- [ ] Relayer connects to both chains
- [ ] Relayer detects Ethereum events
- [ ] Relayer detects Casper events
- [ ] Relayer submits proofs successfully
- [ ] Frontend connects to wallets
- [ ] Frontend shows correct balances
- [ ] End-to-end: Ethereum→Casper works
- [ ] End-to-end: Casper→Ethereum works

---

**For questions or issues**: Check Casper Discord or review transaction logs on block explorers.
