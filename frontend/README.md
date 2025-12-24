# CasperBridge Frontend

Modern React UI for bridging assets between Casper Network and Ethereum.

## Features

- 🔐 **Wallet Integration**: Connect MetaMask (Ethereum) and CSPR.click (Casper)
- 🌉 **Bidirectional Bridge**: Transfer assets both ways
- 📊 **Real-time Balances**: View CSPR, ETH, and wCSPR balances
- 📜 **Transaction History**: Track your bridge transactions
- ⚡ **Fast & Responsive**: Built with React + TypeScript + Vite
- 🎨 **Beautiful UI**: Tailwind CSS with custom Casper/Ethereum theming

## Quick Start

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

The app will open at `http://localhost:3000`

## Prerequisites

### Wallets

1. **MetaMask**: [Install MetaMask](https://metamask.io/)
   - Switch to Sepolia testnet
   - Get test ETH from [Sepolia Faucet](https://sepoliafaucet.com/)

2. **CSPR.click**: [Install CSPR.click](https://www.csprclick.io/)
   - Connect to Casper Testnet
   - Get test CSPR from [Casper Faucet](https://testnet.cspr.live/tools/faucet)

## How to Use

### Bridging CSPR → Ethereum

1. Click "Connect CSPR.click" to connect your Casper wallet
2. Click "Connect MetaMask" to connect your Ethereum wallet
3. Enter amount of CSPR to bridge
4. Click "Bridge CSPR → wCSPR"
5. Approve transaction in CSPR.click
6. Wait ~5-10 minutes for bridge to complete
7. wCSPR will appear in your Ethereum wallet

### Bridging wCSPR → Casper

1. Connect both wallets
2. Click the swap button to reverse direction
3. Enter amount of wCSPR to bridge
4. Click "Bridge wCSPR → CSPR"
5. Approve transaction in MetaMask
6. Wait ~5-10 minutes for bridge to complete
7. CSPR will appear in your Casper wallet

## Project Structure

```
frontend/
├── src/
│   ├── components/
│   │   ├── BridgeForm.tsx        # Main bridge interface
│   │   ├── WalletConnect.tsx     # Wallet connection UI
│   │   └── TransactionHistory.tsx # Transaction list
│   ├── store/
│   │   └── useBridgeStore.ts     # Global state (Zustand)
│   ├── App.tsx                   # Main app component
│   ├── main.tsx                  # Entry point
│   └── index.css                 # Tailwind styles
├── index.html
├── package.json
├── tailwind.config.js
├── tsconfig.json
└── vite.config.ts
```

## Technologies

- **React 18** - UI library
- **TypeScript** - Type safety
- **Vite** - Build tool
- **Tailwind CSS** - Styling
- **Zustand** - State management
- **ethers.js** - Ethereum interactions
- **casper-js-sdk** - Casper interactions
- **Lucide React** - Icons

## Build for Production

```bash
npm run build
```

Build output will be in `dist/` directory.

## Development Notes

### State Management

Global state is managed with Zustand in `src/store/useBridgeStore.ts`:
- Wallet connections
- Balances
- Bridge direction
- Transaction status

### Contract Integration

To integrate with actual contracts:

1. Update `ETHEREUM_WRAPPER_CONTRACT` address in the store
2. Add contract ABI
3. Implement `bridgeCasperToEthereum()` function
4. Implement `bridgeEthereumToCasper()` function

See TODOs in `BridgeForm.tsx` for specific integration points.

## Troubleshooting

### MetaMask not detected
- Install MetaMask extension
- Refresh the page
- Make sure you're using a compatible browser (Chrome, Firefox, Brave)

### CSPR.click not detected
- Install CSPR.click extension from [csprclick.io](https://www.csprclick.io/)
- Refresh the page
- Grant connection permissions

### Transaction fails
- Check you have enough balance + gas
- Verify you're on the correct network (Sepolia for ETH, Casper Testnet)
- Check browser console for errors

## License

MIT License - Built for Casper Hackathon 2026
