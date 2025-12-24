/**
 * Bridge Form Component
 * Main UI for bridging assets between Casper and Ethereum
 */

import { useState } from 'react';
import { useBridgeStore } from '../store/useBridgeStore';
import { ArrowDownUp, AlertCircle, Loader2, CheckCircle2 } from 'lucide-react';
import { ethers } from 'ethers';

export function BridgeForm() {
  const {
    bridgeDirection,
    setBridgeDirection,
    ethereumAddress,
    casperAddress,
    ethereumBalance,
    casperBalance,
    wCSPRBalance,
    isProcessing,
    setProcessing,
    setLastTransaction,
  } = useBridgeStore();

  const [amount, setAmount] = useState('');
  const [status, setStatus] = useState<'idle' | 'signing' | 'submitting' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const isCasperToEthereum = bridgeDirection === 'casper-to-ethereum';

  // Determine which balances to show
  const sourceBalance = isCasperToEthereum ? casperBalance : wCSPRBalance;
  const sourceToken = isCasperToEthereum ? 'CSPR' : 'wCSPR';
  const destToken = isCasperToEthereum ? 'wCSPR' : 'CSPR';

  // Check if wallets are connected
  const sourceWalletConnected = isCasperToEthereum ? !!casperAddress : !!ethereumAddress;
  const destWalletConnected = isCasperToEthereum ? !!ethereumAddress : !!casperAddress;
  const bothWalletsConnected = sourceWalletConnected && destWalletConnected;

  const handleSwapDirection = () => {
    const newDirection = isCasperToEthereum ? 'ethereum-to-casper' : 'casper-to-ethereum';
    setBridgeDirection(newDirection);
    setAmount('');
    setStatus('idle');
    setErrorMessage('');
  };

  const handleBridge = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      setErrorMessage('Please enter a valid amount');
      return;
    }

    if (!bothWalletsConnected) {
      setErrorMessage('Please connect both wallets');
      return;
    }

    try {
      setProcessing(true);
      setStatus('signing');
      setErrorMessage('');

      if (isCasperToEthereum) {
        // Casper → Ethereum flow
        await bridgeCasperToEthereum();
      } else {
        // Ethereum → Casper flow
        await bridgeEthereumToCasper();
      }

      setStatus('success');
      setAmount('');

      // Reset success state after 5 seconds
      setTimeout(() => {
        setStatus('idle');
      }, 5000);
    } catch (error: any) {
      console.error('Bridge error:', error);
      setStatus('error');
      setErrorMessage(error.message || 'Transaction failed');
    } finally {
      setProcessing(false);
    }
  };

  const bridgeCasperToEthereum = async () => {
    console.log(`Bridging ${amount} CSPR to Ethereum...`);

    // TODO: Implement actual Casper contract interaction
    // For now, simulate transaction
    await new Promise((resolve) => setTimeout(resolve, 2000));

    setStatus('submitting');
    await new Promise((resolve) => setTimeout(resolve, 2000));

    const mockTxHash = '0x' + Math.random().toString(16).substring(2, 66);
    setLastTransaction(mockTxHash);

    console.log('✅ Casper lock transaction:', mockTxHash);
  };

  const bridgeEthereumToCasper = async () => {
    console.log(`Bridging ${amount} wCSPR to Casper...`);

    // TODO: Implement actual Ethereum contract interaction
    // For now, simulate transaction
    setStatus('submitting');
    await new Promise((resolve) => setTimeout(resolve, 3000));

    const mockTxHash = '0x' + Math.random().toString(16).substring(2, 66);
    setLastTransaction(mockTxHash);

    console.log('✅ Ethereum burn transaction:', mockTxHash);
  };

  const setMaxAmount = () => {
    if (sourceBalance) {
      // Leave a small amount for gas
      const maxAmount = Math.max(0, parseFloat(sourceBalance) - 0.1);
      setAmount(maxAmount.toString());
    }
  };

  return (
    <div className="card max-w-lg mx-auto">
      <h2 className="text-2xl font-bold mb-6 text-center bg-gradient-to-r from-casper-red to-ethereum-purple bg-clip-text text-transparent">
        Bridge Assets
      </h2>

      {/* Source Chain */}
      <div className="mb-4">
        <label className="block text-sm font-medium mb-2 text-gray-300">
          From: {isCasperToEthereum ? 'Casper Network' : 'Ethereum'}
        </label>
        <div className="relative">
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.0"
            className="input pr-24"
            disabled={isProcessing || !sourceWalletConnected}
          />
          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
            <button
              onClick={setMaxAmount}
              className="text-xs text-casper-red hover:text-red-400 font-semibold"
              disabled={isProcessing || !sourceWalletConnected}
            >
              MAX
            </button>
            <span className="text-gray-400">|</span>
            <span className="font-semibold">{sourceToken}</span>
          </div>
        </div>
        {sourceBalance && (
          <div className="text-xs text-gray-400 mt-1">
            Balance: {parseFloat(sourceBalance).toFixed(4)} {sourceToken}
          </div>
        )}
      </div>

      {/* Swap Direction Button */}
      <div className="flex justify-center my-4">
        <button
          onClick={handleSwapDirection}
          className="p-3 rounded-full bg-gray-700 hover:bg-gray-600 transition-colors"
          disabled={isProcessing}
        >
          <ArrowDownUp size={20} />
        </button>
      </div>

      {/* Destination Chain */}
      <div className="mb-6">
        <label className="block text-sm font-medium mb-2 text-gray-300">
          To: {isCasperToEthereum ? 'Ethereum' : 'Casper Network'}
        </label>
        <div className="input bg-gray-900/80 flex items-center justify-between">
          <span className="text-gray-500">You will receive</span>
          <span className="font-semibold">
            {amount || '0.0'} {destToken}
          </span>
        </div>
      </div>

      {/* Error Message */}
      {errorMessage && (
        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/50 rounded-lg flex items-start gap-2">
          <AlertCircle size={16} className="text-red-500 mt-0.5 flex-shrink-0" />
          <span className="text-sm text-red-400">{errorMessage}</span>
        </div>
      )}

      {/* Status Message */}
      {status === 'signing' && (
        <div className="mb-4 p-3 bg-blue-500/10 border border-blue-500/50 rounded-lg flex items-center gap-2">
          <Loader2 size={16} className="text-blue-400 animate-spin" />
          <span className="text-sm text-blue-400">Please sign the transaction in your wallet...</span>
        </div>
      )}

      {status === 'submitting' && (
        <div className="mb-4 p-3 bg-yellow-500/10 border border-yellow-500/50 rounded-lg flex items-center gap-2">
          <Loader2 size={16} className="text-yellow-400 animate-spin" />
          <span className="text-sm text-yellow-400">Submitting transaction...</span>
        </div>
      )}

      {status === 'success' && (
        <div className="mb-4 p-3 bg-green-500/10 border border-green-500/50 rounded-lg flex items-center gap-2">
          <CheckCircle2 size={16} className="text-green-400" />
          <span className="text-sm text-green-400">Transaction submitted successfully!</span>
        </div>
      )}

      {/* Bridge Button */}
      <button
        onClick={handleBridge}
        disabled={isProcessing || !bothWalletsConnected || !amount || parseFloat(amount) <= 0}
        className="btn-primary w-full flex items-center justify-center gap-2"
      >
        {isProcessing ? (
          <>
            <Loader2 size={20} className="animate-spin" />
            Processing...
          </>
        ) : !bothWalletsConnected ? (
          'Connect Both Wallets'
        ) : (
          <>
            Bridge {sourceToken} → {destToken}
          </>
        )}
      </button>

      {/* Info */}
      <div className="mt-4 text-xs text-gray-400 text-center">
        <p>Bridge time: ~5-10 minutes</p>
        <p className="mt-1">Min amount: 1 {sourceToken}</p>
      </div>
    </div>
  );
}
