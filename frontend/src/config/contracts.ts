import CasperBridgeWrapperABI from '../contracts/CasperBridgeWrapper.json';

/**
 * Contract addresses and configuration for CasperBridge
 */

export const CONTRACTS = {
  ethereum: {
    // Deployed on Sepolia testnet
    wrapperAddress: '0x08498FBFA0084394dF28555414F80a6C00814542',
    abi: CasperBridgeWrapperABI.abi,
    chainId: 11155111, // Sepolia
    chainName: 'Sepolia',
    rpcUrl: 'https://eth-sepolia.g.alchemy.com/v2/wHwbkttFi9IOFoM5Wzh31Gw1IvNHL-lt',
  },
  casper: {
    // Deployed on Casper 2.1 Testnet
    vaultContract: 'hash-bb63d7f3b51f0c40ba1b70f896c5700e7be6c87d666555c5ac27e41d7c614c96',
    networkName: 'casper-test',
    rpcUrl: 'http://34.220.83.153:7777/rpc', // Updated to working RPC endpoint
  },
} as const;

export const NETWORK_CONFIG = {
  sepolia: {
    chainId: `0x${(11155111).toString(16)}`, // 0xaa36a7
    chainName: 'Sepolia Test Network',
    nativeCurrency: {
      name: 'Sepolia ETH',
      symbol: 'ETH',
      decimals: 18,
    },
    rpcUrls: ['https://rpc.sepolia.org'],
    blockExplorerUrls: ['https://sepolia.etherscan.io'],
  },
} as const;

// Contract event topics for filtering logs
export const EVENT_TOPICS = {
  Minted: '0x...', // Will be populated from ABI
  Burned: '0x...', // Will be populated from ABI
} as const;
