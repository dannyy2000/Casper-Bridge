# Quick Start Guide

Get CasperBridge running in 15 minutes.

## Prerequisites Check

```bash
# Check Rust
rustc --version
# Should be 1.70+

# Check Node.js
node --version
# Should be 18+

# Check Cargo Odra
cargo odra --version
# If not installed: cargo install cargo-odra
```

## Step 1: Get Testnet Tokens (5 min)

### Casper Testnet CSPR

1. Generate keys:
```bash
cd contracts/casper
mkdir -p keys
cd keys
casper-client keygen .
```

2. Get your public key:
```bash
cat public_key_hex
```

3. Request tokens: https://testnet.cspr.live/tools/faucet
   - Paste your public key
   - Request 1000 CSPR
   - Wait ~1 minute

### Ethereum Sepolia ETH

1. Get Sepolia ETH from: https://sepoliafaucet.com/
2. Or use Alchemy faucet: https://sepoliafaucet.com/

## Step 2: Deploy Contracts (5 min)

### Deploy Casper Vault

```bash
cd contracts/casper

# Build the contract
cargo odra build

# Deploy to testnet
cargo odra deploy -n testnet

# Save the contract hash that's printed
# Example: contract-hash-abc123...
```

### Deploy Ethereum Wrapper

```bash
cd contracts/ethereum

# Install dependencies
npm install

# Create .env file
cp .env.example .env

# Edit .env with your private key
nano .env
# Set PRIVATE_KEY=your_ethereum_private_key

# Deploy
npm run deploy:sepolia

# Save the contract address that's printed
# Example: 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb
```

## Step 3: Configure Relayer (3 min)

```bash
cd relayer

# Install dependencies
npm install

# Create .env file
cp .env.example .env

# Edit with your contract addresses
nano .env
```

Update `.env`:
```bash
CASPER_VAULT_CONTRACT=contract-hash-from-step-2
ETHEREUM_WRAPPER_CONTRACT=0x-address-from-step-2
ETHEREUM_PRIVATE_KEY=your_ethereum_private_key
CASPER_PRIVATE_KEY_PATH=../contracts/casper/keys/secret_key.pem
```

## Step 4: Start Relayer (1 min)

```bash
cd relayer
npm run dev
```

You should see:
```
✅ Relayer service started successfully
Monitoring both chains for bridge events...
```

## Step 5: Test the Bridge (5 min)

### Test Lock on Casper

```bash
cd contracts/casper

# Lock 10 CSPR to bridge
cargo odra call -n testnet \
  --contract-hash YOUR_VAULT_CONTRACT \
  --method lock_cspr \
  --amount 10000000000 \
  --args '{"destination_chain": "ethereum", "destination_address": "YOUR_ETH_ADDRESS"}'
```

Check relayer logs - you should see:
```
Detected AssetLocked event on Casper
Submitting mint proof to Ethereum
Mint transaction confirmed
```

### Verify on Ethereum

```bash
cd contracts/ethereum

# Check wCSPR balance
npx hardhat console --network sepolia

# In console:
const wrapper = await ethers.getContractAt("CasperBridgeWrapper", "YOUR_WRAPPER_ADDRESS")
const balance = await wrapper.balanceOf("YOUR_ETH_ADDRESS")
console.log(ethers.formatEther(balance)) // Should show 10.0
```

## Troubleshooting

### "Insufficient balance" on Casper
- Request more CSPR from faucet
- Wait for faucet transaction to confirm

### "Nonce too low" on Ethereum
- Reset MetaMask nonce: Settings → Advanced → Reset Account

### Relayer not detecting events
- Check contract addresses in .env
- Verify relayer has ETH for gas
- Check network connectivity

### Contract deployment fails
- Verify you have testnet tokens
- Check RPC URLs are correct
- Try again (network might be congested)

## Next Steps

1. **Add More Validators**:
   ```bash
   # On Ethereum
   npx hardhat run scripts/add-validator.js --network sepolia
   ```

2. **Test Burn & Release**:
   - Burn wCSPR on Ethereum
   - Watch relayer release CSPR on Casper

3. **Build Frontend**:
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

4. **Monitor Activity**:
   - Casper: https://testnet.cspr.live
   - Ethereum: https://sepolia.etherscan.io

## Need Help?

- Check logs: `relayer/logs/combined.log`
- Read full docs: `docs/architecture.md`
- Discord: #hackathon channel
- Telegram: Casper Developers Group

## Production Checklist

Before mainnet:
- [ ] Security audit
- [ ] Add 5+ validators
- [ ] Set up monitoring alerts
- [ ] Create emergency runbook
- [ ] Test pause functionality
- [ ] Verify insurance coverage
- [ ] Document disaster recovery
