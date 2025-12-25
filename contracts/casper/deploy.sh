#!/bin/bash

# Casper Bridge Vault Deployment Script
# Run this from your local machine

set -e

WASM_PATH="./target/wasm32-unknown-unknown/release/casper_bridge_vault.wasm"
SECRET_KEY="/tmp/casper_deploy_key.pem"
NODE_ADDRESS="https://node.testnet.casper.network:7777"
CHAIN_NAME="casper-test"
PAYMENT_AMOUNT="100000000000"  # 100 CSPR

echo "====================================="
echo "Casper Bridge Vault Deployment"
echo "====================================="
echo "WASM: $WASM_PATH"
echo "Node: $NODE_ADDRESS"
echo "Chain: $CHAIN_NAME"
echo "Payment: $PAYMENT_AMOUNT motes (100 CSPR)"
echo ""

# Check if WASM exists
if [ ! -f "$WASM_PATH" ]; then
    echo "ERROR: WASM file not found at $WASM_PATH"
    echo "Run: cargo build --release --target wasm32-unknown-unknown"
    exit 1
fi

# Check if secret key exists
if [ ! -f "$SECRET_KEY" ]; then
    echo "ERROR: Secret key not found at $SECRET_KEY"
    exit 1
fi

# Deploy the contract
echo "Deploying contract..."
casper-client put-deploy \
  --node-address "$NODE_ADDRESS" \
  --chain-name "$CHAIN_NAME" \
  --secret-key "$SECRET_KEY" \
  --payment-amount "$PAYMENT_AMOUNT" \
  --session-path "$WASM_PATH" \
  --session-arg "contract_name:string='casper_bridge'" \
  --session-arg "required_sigs:u32='1'" \
  --session-arg "min_amount:u512='1000000000'"

echo ""
echo "====================================="
echo "Deployment submitted!"
echo "====================================="
echo ""
echo "Save the deploy hash from above and check status with:"
echo "casper-client get-deploy --node-address $NODE_ADDRESS <DEPLOY_HASH>"
echo ""
echo "After deployment succeeds (~2 minutes), extract the contract hash"
echo "and update the frontend config."
