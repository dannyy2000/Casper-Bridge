# Browser Deployment Guide for Casper Contract

## ✅ Prerequisites Complete:
- ✅ WASM built: `casper_bridge_vault.wasm` (165 KB)
- ✅ Casper Wallet installed (CSPR.click)
- 🔄 Test CSPR (get from faucet)

## 📍 WASM File Location:
```
/home/danielakinsanya/casper-bridge/contracts/casper/target/wasm32-unknown-unknown/release/casper_bridge_vault.wasm
```

## 🚀 Deployment Steps:

### 1. Get Test CSPR
- Open Casper Wallet extension
- Copy your wallet address
- Visit: https://testnet.cspr.live/tools/faucet
- Request test CSPR (you'll need ~100 CSPR for deployment)

### 2. Deploy via Browser
1. Go to: **https://testnet.cspr.live/**
2. Click **"Deploy"** in the top navigation
3. Click **"Deploy Contract"**
4. Fill in the deployment form:
   - **Node Address**: http://65.21.235.219:7777 (or use default)
   - **Chain Name**: casper-test
   - **Payment Amount**: 100000000000 (100 CSPR)
   - **Session**: Click "Upload File"
     - Select: `/home/danielakinsanya/casper-bridge/contracts/casper/target/wasm32-unknown-unknown/release/casper_bridge_vault.wasm`

5. Review the deployment:
   - Contract: CasperVault
   - Size: 165 KB
   - Payment: 100 CSPR

6. Click **"Sign and Deploy"**
7. Confirm in your Casper Wallet extension

### 3. After Deployment:

Once deployed, you'll get a **Deploy Hash**. Example:
```
Deploy Hash: abc123...
```

**Save this hash!** You'll need it to:
1. Check deployment status
2. Get the contract hash (needed for frontend)

### 4. Get Contract Hash:

After deployment succeeds (wait ~2 minutes), check the deploy status:

1. Go to: https://testnet.cspr.live/
2. Search for your deploy hash
3. Find the **Contract Hash** in the deploy details
4. Format will be: `hash-abc123...`

### 5. Update Frontend Config:

Once you have the contract hash, update:
```
/home/danielakinsanya/casper-bridge/frontend/src/config/contracts.ts
```

Change this line:
```typescript
vaultContract: 'hash-YOUR_CONTRACT_HASH_HERE',
```

## 🎯 Contract Initialization:

After deployment, you need to initialize the contract by calling `init()` with:
- `required_sigs`: 1 (for testing)
- `min_amount`: 1000000000 (1 CSPR minimum)

This can be done via the browser deploy interface or casper-client.

## ⚠️ Important Notes:

- Deployment costs ~100 CSPR on testnet
- First deployment attempt might fail - this is normal, try again
- Keep your deploy hash - you can always look up the contract hash later
- The contract owner will be the address that deploys it
- You'll be automatically added as the first validator

## 📊 Verify Deployment:

Search your contract on: https://testnet.cspr.live/
You should see:
- Contract Package Hash
- Contract Hash
- Entry Points: init, lock_cspr, release_cspr, add_validator, etc.
