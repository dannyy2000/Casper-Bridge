/**
 * Global State Management for CasperBridge
 * Using Zustand for simple, efficient state management
 */

import { create } from 'zustand';
import { ethers } from 'ethers';
import { CONTRACTS } from '../config/contracts';

export type BridgeDirection = 'casper-to-ethereum' | 'ethereum-to-casper';

export interface WalletState {
  // Ethereum wallet
  ethereumAddress: string | null;
  ethereumProvider: ethers.JsonRpcProvider | null;
  ethereumBalance: string | null;
  wCSPRBalance: string | null;

  // Casper wallet
  casperAddress: string | null;
  casperBalance: string | null;

  // Bridge state
  bridgeDirection: BridgeDirection;
  isProcessing: boolean;
  lastTransaction: string | null;
}

interface BridgeActions {
  // Ethereum wallet actions
  connectEthereum: () => Promise<void>;
  disconnectEthereum: () => void;
  updateEthereumBalance: () => Promise<void>;

  // Casper wallet actions
  connectCasper: () => Promise<void>;
  disconnectCasper: () => void;
  updateCasperBalance: () => Promise<void>;

  // Bridge actions
  setBridgeDirection: (direction: BridgeDirection) => void;
  setProcessing: (isProcessing: boolean) => void;
  setLastTransaction: (txHash: string) => void;
}

export const useBridgeStore = create<WalletState & BridgeActions>((set, get) => ({
  // Initial state
  ethereumAddress: null,
  ethereumProvider: null,
  ethereumBalance: null,
  wCSPRBalance: null,
  casperAddress: null,
  casperBalance: null,
  bridgeDirection: 'casper-to-ethereum',
  isProcessing: false,
  lastTransaction: null,

  // Ethereum wallet actions
  connectEthereum: async () => {
    try {
      if (!window.ethereum) {
        alert('Please install MetaMask!');
        return;
      }

      // Request account access
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      const address = accounts[0];

      // Create a read-only provider using public RPC
      const provider = new ethers.JsonRpcProvider(
        CONTRACTS.ethereum.rpcUrl
      );

      set({
        ethereumAddress: address,
        ethereumProvider: provider,
      });

      // Listen for account changes
      window.ethereum.on('accountsChanged', async (accounts: string[]) => {
        if (accounts.length === 0) {
          // User disconnected
          get().disconnectEthereum();
        } else {
          // User switched accounts
          console.log('🔄 Account switched to:', accounts[0]);
          set({ ethereumAddress: accounts[0] });
          await get().updateEthereumBalance();
        }
      });

      // Update balance once after connecting
      await get().updateEthereumBalance();

      console.log('✅ Connected to Ethereum:', address);
      console.log('📡 Using public RPC for data queries');
    } catch (error) {
      console.error('Failed to connect to Ethereum:', error);
    }
  },

  disconnectEthereum: () => {
    set({
      ethereumAddress: null,
      ethereumProvider: null,
      ethereumBalance: null,
      wCSPRBalance: null,
    });
  },

  updateEthereumBalance: async () => {
    const { ethereumProvider, ethereumAddress } = get();
    if (!ethereumProvider || !ethereumAddress) return;

    try {
      const balance = await ethereumProvider.getBalance(ethereumAddress);
      set({ ethereumBalance: ethers.formatEther(balance) });

      // Fetch wCSPR balance from contract
      const contract = new ethers.Contract(
        CONTRACTS.ethereum.wrapperAddress,
        CONTRACTS.ethereum.abi,
        ethereumProvider
      );
      const wCSPRBal = await contract.balanceOf(ethereumAddress);
      // wCSPR uses standard ERC20 18 decimals
      set({ wCSPRBalance: ethers.formatEther(wCSPRBal) });
    } catch (error) {
      console.error('Failed to update Ethereum balance:', error);
    }
  },

  // Casper wallet actions
  connectCasper: async () => {
    try {
      // Try Casper Wallet (official) first
      if (window.CasperWalletProvider) {
        console.log('Using Casper Wallet (official)');
        const provider = window.CasperWalletProvider();

        // Request connection
        const isConnected = await provider.requestConnection();

        if (!isConnected) {
          console.log('User rejected connection');
          return;
        }

        // Get active key
        const activeKey = await provider.getActivePublicKey();

        set({
          casperAddress: activeKey,
        });

        await get().updateCasperBalance();
        console.log('✅ Connected to Casper Wallet:', activeKey);
        return;
      }

      // Fallback to CSPR.click
      if (window.csprclick) {
        console.log('Using CSPR.click wallet');
        const connected = await window.csprclick.requestConnection();

        if (!connected) {
          console.log('User rejected connection');
          return;
        }

        const account = await window.csprclick.getActivePublicKey();

        set({
          casperAddress: account,
        });

        await get().updateCasperBalance();
        console.log('✅ Connected to CSPR.click:', account);
        return;
      }

      // No wallet found
      alert('Please install Casper Wallet or CSPR.click extension!\n\nCasper Wallet: https://www.casperwallet.io/\nCSPR.click: https://www.csprclick.io/');
      window.open('https://www.casperwallet.io/', '_blank');
    } catch (error) {
      console.error('Failed to connect to Casper:', error);
      alert('Failed to connect to Casper wallet. Please make sure your wallet is unlocked.');
    }
  },

  disconnectCasper: () => {
    set({
      casperAddress: null,
      casperBalance: null,
    });
  },

  updateCasperBalance: async () => {
    const { casperAddress } = get();
    if (!casperAddress) return;

    try {
      // Use relayer proxy to avoid CORS issues
      const response = await fetch('http://127.0.0.1:3001/api/casper-balance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          publicKey: casperAddress,
        }),
      });

      const data = await response.json();

      if (data.balance) {
        set({ casperBalance: data.balance });
      } else {
        console.warn('Could not fetch Casper balance');
        set({ casperBalance: 'N/A' });
      }
    } catch (error) {
      console.error('Failed to update Casper balance:', error);
      set({ casperBalance: 'N/A' });
    }
  },

  // Bridge actions
  setBridgeDirection: (direction) => set({ bridgeDirection: direction }),
  setProcessing: (isProcessing) => set({ isProcessing }),
  setLastTransaction: (txHash) => set({ lastTransaction: txHash }),
}));

// Type declarations for browser extensions
declare global {
  interface Window {
    ethereum?: any;
    csprclick?: {
      requestConnection: () => Promise<boolean>;
      getActivePublicKey: () => Promise<string>;
      sign: (message: string) => Promise<string>;
    };
    CasperWalletProvider?: () => {
      requestConnection: () => Promise<boolean>;
      getActivePublicKey: () => Promise<string>;
      signMessage: (message: string, publicKey: string) => Promise<{ signature: string }>;
      sign: (deployJson: string, publicKeyHex: string, targetPublicKeyHex?: string) => Promise<any>;
      disconnectFromSite: () => Promise<void>;
    };
  }
}
