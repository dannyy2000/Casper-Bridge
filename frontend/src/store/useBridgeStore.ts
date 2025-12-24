/**
 * Global State Management for CasperBridge
 * Using Zustand for simple, efficient state management
 */

import { create } from 'zustand';
import { ethers } from 'ethers';

export type BridgeDirection = 'casper-to-ethereum' | 'ethereum-to-casper';

export interface WalletState {
  // Ethereum wallet
  ethereumAddress: string | null;
  ethereumProvider: ethers.BrowserProvider | null;
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

      const provider = new ethers.BrowserProvider(window.ethereum);
      const accounts = await provider.send('eth_requestAccounts', []);
      const address = accounts[0];

      set({
        ethereumAddress: address,
        ethereumProvider: provider,
      });

      // Update balance
      await get().updateEthereumBalance();

      console.log('✅ Connected to Ethereum:', address);
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

      // TODO: Fetch wCSPR balance from contract
      set({ wCSPRBalance: '0.0' });
    } catch (error) {
      console.error('Failed to update Ethereum balance:', error);
    }
  },

  // Casper wallet actions
  connectCasper: async () => {
    try {
      // Check if CSPR.click extension is available
      if (!window.csprclick) {
        alert('Please install CSPR.click wallet extension!');
        window.open('https://www.csprclick.io/', '_blank');
        return;
      }

      // Request connection
      const connected = await window.csprclick.requestConnection();

      if (!connected) {
        console.log('User rejected connection');
        return;
      }

      // Get active account
      const account = await window.csprclick.getActivePublicKey();

      set({
        casperAddress: account,
      });

      // Update balance
      await get().updateCasperBalance();

      console.log('✅ Connected to Casper:', account);
    } catch (error) {
      console.error('Failed to connect to Casper:', error);
      // Fallback: Mock connection for development
      set({
        casperAddress: 'account-hash-mock-casper-address',
        casperBalance: '1000.0',
      });
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
      // TODO: Fetch actual balance from Casper network
      set({ casperBalance: '1000.0' }); // Mock for now
    } catch (error) {
      console.error('Failed to update Casper balance:', error);
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
  }
}
