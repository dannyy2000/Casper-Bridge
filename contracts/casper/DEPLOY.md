# Casper Contract Deployment Guide

## ✅ Built Successfully!

Your contract WASM is ready at:
```
./target/wasm32-unknown-unknown/release/casper_bridge_vault.wasm
Size: 165 KB (168,920 bytes)
```

### Build Configuration:
- **Odra Version**: 2.4.0
- **Rust Toolchain**: nightly-2024-09-05 (1.83.0-nightly)
- **Build Command**: `cargo build --release --target wasm32-unknown-unknown`

## 📋 Deployment Steps

### Prerequisites:

1. **Install casper-client**:
```bash
cargo install casper-client
```

2. **Get Test CSPR**:
   - Create wallet at https://testnet.cspr.live/
   - Get test CSPR from faucet: https://testnet.cspr.live/tools/faucet

3. **Export your private key** from wallet (PEM format)

### Deploy Command:

```bash
casper-client put-deploy \
  --node-address http://65.21.235.219:7777 \
  --chain-name casper-test \
  --secret-key /path/to/your/secret_key.pem \
  --payment-amount 100000000000 \
  --session-path ./target/wasm32-unknown-unknown/release/casper_bridge_vault.wasm
```

### After Deployment:

1. Note the **deploy hash** from the output
2. Check status:
```bash
casper-client get-deploy \
  --node-address http://65.21.235.219:7777 \
  <YOUR_DEPLOY_HASH>
```

3. Get the **contract hash** from the deploy result
4. Update frontend config with contract hash

## 🔧 Alternative: Use Casper Testnet CSPR.click

If you have CSPR.click wallet extension:
1. Go to https://testnet.cspr.live/
2. Use the "Deploy" interface
3. Upload the WASM file
4. Sign with CSPRclick

## 📝 Contract Configuration

The contract is configured for:
- **Network**: casper-test
- **RPC**: http://65.21.235.219:7777

Need help? Check https://docs.casper.network/developers/dapps/deploying-contracts/
