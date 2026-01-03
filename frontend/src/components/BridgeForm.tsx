/**
 * Bridge Form Component
 * Main UI for bridging assets between Casper and Ethereum
 */

import { useState } from 'react';
import { useBridgeStore } from '../store/useBridgeStore';
import { ArrowDownUp, AlertCircle, Loader2, CheckCircle2 } from 'lucide-react';
import { ethers } from 'ethers';
import { CONTRACTS } from '../config/contracts';
import {
  CLPublicKey,
  DeployUtil,
  RuntimeArgs,
  CLValueBuilder
} from 'casper-js-sdk';

export function BridgeForm() {
  const {
    bridgeDirection,
    setBridgeDirection,
    ethereumAddress,
    casperAddress,
    casperBalance,
    wCSPRBalance,
    isProcessing,
    setProcessing,
    setLastTransaction,
  } = useBridgeStore();

  const [amount, setAmount] = useState('');
  const [status, setStatus] = useState<'idle' | 'signing' | 'submitting' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [manualCasperAddress, setManualCasperAddress] = useState('');

  const isCasperToEthereum = bridgeDirection === 'casper-to-ethereum';

  // Determine which balances to show
  const sourceBalance = isCasperToEthereum ? casperBalance : wCSPRBalance;
  const sourceToken = isCasperToEthereum ? 'CSPR' : 'wCSPR';
  const destToken = isCasperToEthereum ? 'wCSPR' : 'CSPR';

  // Check if wallets are connected
  const sourceWalletConnected = isCasperToEthereum ? !!casperAddress : !!ethereumAddress;
  const destWalletConnected = isCasperToEthereum ? !!ethereumAddress : !!casperAddress;
  // For Ethereum→Casper, we can use manual address input instead of wallet connection
  const canBridge = isCasperToEthereum
    ? (sourceWalletConnected && destWalletConnected)
    : (sourceWalletConnected && (destWalletConnected || manualCasperAddress.trim().length > 0));

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

    if (!canBridge) {
      setErrorMessage(isCasperToEthereum
        ? 'Please connect both wallets'
        : 'Please connect Ethereum wallet and enter Casper address');
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

    if (!casperAddress) {
      throw new Error('Casper wallet not connected');
    }

    if (!ethereumAddress) {
      throw new Error('Ethereum wallet not connected (needed for destination)');
    }

    try {
      // Convert amount to motes (1 CSPR = 1,000,000,000 motes)
      const amountInMotes = BigInt(Math.floor(parseFloat(amount) * 1_000_000_000));

      // Get Casper Wallet provider
      const provider = window.CasperWalletProvider?.() || window.csprclick;
      if (!provider) {
        throw new Error('Casper wallet provider not found');
      }

      // Get public key
      const publicKeyHex = await provider.getActivePublicKey();
      const publicKey = CLPublicKey.fromHex(publicKeyHex);

      // Contract details - remove 'hash-' prefix and convert to byte array
      const contractHashString = CONTRACTS.casper.vaultContract.replace('hash-', '');

      // Convert hex string to Uint8Array (browser-compatible)
      const hexToBytes = (hex: string): Uint8Array => {
        const bytes = new Uint8Array(hex.length / 2);
        for (let i = 0; i < hex.length; i += 2) {
          bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
        }
        return bytes;
      };

      const contractHashBytes = hexToBytes(contractHashString);

      // Prepare runtime arguments for lock_cspr
      const runtimeArgs = RuntimeArgs.fromMap({
        destination_chain: CLValueBuilder.string('ethereum'),
        destination_address: CLValueBuilder.string(ethereumAddress),
        amount: CLValueBuilder.u512(amountInMotes.toString())
      });

      // Create payment using the standardPayment helper
      const payment = DeployUtil.standardPayment(5_000_000_000);

      // Create deploy - pass bytes directly, not wrapped in CLByteArray
      const deploy = DeployUtil.makeDeploy(
        new DeployUtil.DeployParams(
          publicKey,
          CONTRACTS.casper.networkName,
          1, // Gas price
          1800000 // TTL (30 minutes)
        ),
        DeployUtil.ExecutableDeployItem.newStoredContractByHash(
          contractHashBytes,
          'lock_cspr',
          runtimeArgs
        ),
        payment
      );

      console.log('Deploy created, requesting signature from wallet...');
      setStatus('signing');

      // Sign with wallet - Casper Wallet expects the deploy JSON
      const deployJson = DeployUtil.deployToJson(deploy);

      console.log('Calling provider.sign() with deployJson');
      console.log('Deploy JSON to sign:', deployJson);

      const signResult = await provider.sign(
        JSON.stringify(deployJson),
        publicKeyHex
      );

      console.log('===== WALLET SIGN RESULT =====');
      console.log('Type:', typeof signResult);
      console.log('Value:', signResult);
      console.log('Keys:', signResult ? Object.keys(signResult) : 'N/A');
      console.log('JSON:', JSON.stringify(signResult, null, 2));
      console.log('==============================');

      // Prepare deploy JSON for submission
      let deployJsonToSubmit;

      // Check if this is Casper Wallet (returns {signatureHex, signature})
      // or CSPR.click (returns full deploy JSON)
      if (signResult.signatureHex && signResult.signature) {
        // Casper Wallet - manually add signature to deploy
        console.log('Casper Wallet signature - adding to deploy');
        const signatureHex = signResult.signatureHex;

        // Add signature to the deploy JSON structure
        const signedDeployJson = DeployUtil.deployToJson(deploy) as any;

        // CRITICAL: Approvals go INSIDE deploy.approvals, not at root level!
        if (!signedDeployJson.deploy.approvals) {
          signedDeployJson.deploy.approvals = [];
        }

        // Determine algorithm prefix from public key
        // Public keys in Casper: 01 = Ed25519, 02 = Secp256k1
        const algorithmPrefix = publicKeyHex.substring(0, 2);
        const signatureWithPrefix = algorithmPrefix + signatureHex;

        console.log('Public key algorithm prefix:', algorithmPrefix);
        console.log('Signature with prefix:', signatureWithPrefix);

        signedDeployJson.deploy.approvals.push({
          signer: publicKeyHex,
          signature: signatureWithPrefix
        });

        console.log('Added approval inside deploy.approvals:', signedDeployJson.deploy.approvals);

        // DON'T parse back to Deploy object - use the JSON directly to preserve approvals!
        deployJsonToSubmit = signedDeployJson;
      } else {
        // CSPR.click - returns full signed deploy
        console.log('CSPR.click signed deploy');
        let signedDeploy;
        if (typeof signResult === 'string') {
          signedDeploy = DeployUtil.deployFromJson(JSON.parse(signResult)).unwrap();
        } else {
          signedDeploy = DeployUtil.deployFromJson(signResult).unwrap();
        }
        deployJsonToSubmit = DeployUtil.deployToJson(signedDeploy);
      }

      console.log('Deploy signed successfully');

      console.log('Submitting deploy via relayer...');
      setStatus('submitting');

      try {
        // Submit via relayer's HTTP endpoint to avoid CORS issues
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

        console.log('Sending deploy to relayer endpoint...');
        console.log('Deploy JSON structure:', Object.keys(deployJsonToSubmit));
        console.log('Deploy has approvals:', (deployJsonToSubmit as any).deploy?.approvals?.length || 0);

        const response = await fetch('http://127.0.0.1:3001/api/submit-deploy', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            deployJson: deployJsonToSubmit,
          }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        console.log('Received response from relayer:', response.status);

        if (!response.ok) {
          const errorData = await response.json();
          console.error('Relayer error:', errorData);
          throw new Error(errorData.message || 'Failed to submit deploy');
        }

        const result = await response.json();

        console.log('✅ Deploy submitted successfully!');
        console.log('Deploy hash:', result.deployHash);
        console.log('Explorer:', result.explorerUrl);

        setLastTransaction(result.deployHash);

        console.log('🔄 Relayer will detect this lock and mint wCSPR on Ethereum');

      } catch (submitError: any) {
        console.error('Failed to submit deploy:', submitError);
        if (submitError.name === 'AbortError') {
          throw new Error('Request timed out after 30 seconds. Please check if the relayer is running.');
        }
        throw new Error(submitError.message || 'Failed to submit deploy to relayer');
      }

    } catch (error: any) {
      console.error('Casper bridge error:', error);
      throw new Error(error.message || 'Failed to bridge from Casper');
    }
  };

  const bridgeEthereumToCasper = async () => {
    console.log(`Bridging ${amount} wCSPR to Casper...`);

    const targetCasperAddress = casperAddress || manualCasperAddress;

    if (!window.ethereum || !targetCasperAddress) {
      throw new Error('MetaMask not connected or Casper address not provided');
    }

    try {
      // BYPASS rate limits by using MetaMask directly without BrowserProvider
      // This avoids unnecessary RPC calls like eth_blockNumber
      console.log('Using MetaMask directly (no BrowserProvider)');

      const provider = new ethers.BrowserProvider(window.ethereum, 'any');
      const signer = await provider.getSigner();

      // Create contract instance
      const contract = new ethers.Contract(
        CONTRACTS.ethereum.wrapperAddress,
        CONTRACTS.ethereum.abi,
        signer
      );

      // Convert amount to smallest unit (wCSPR has 18 decimals - standard ERC20)
      const amountWei = ethers.parseUnits(amount, 18);

      console.log('Burning wCSPR on Ethereum...');
      console.log('Amount:', amount, 'wCSPR');
      console.log('Destination Casper address:', targetCasperAddress);

      setStatus('submitting');

      // Call burn function on the contract
      // Note: burn function signature is burn(uint256 amount, string destinationChain, string destinationAddress)
      const tx = await contract.burn(amountWei, "casper", targetCasperAddress);

      console.log('Transaction sent:', tx.hash);
      setLastTransaction(tx.hash);

      // Wait for confirmation with timeout
      console.log('Waiting for confirmation...');

      try {
        const receipt = await Promise.race([
          tx.wait(),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('CONFIRMATION_TIMEOUT')), 60000)
          )
        ]);

        console.log('✅ Transaction confirmed in block:', receipt.blockNumber);
        console.log('Transaction hash:', receipt.hash);
      } catch (waitError: any) {
        // If confirmation timeout or network error, transaction was still submitted
        if (waitError.message === 'CONFIRMATION_TIMEOUT' || waitError.code === 'NETWORK_ERROR') {
          console.log('⚠️ Confirmation pending - transaction submitted but not yet confirmed');
          console.log('Transaction will complete in background. Hash:', tx.hash);
          // Don't throw - transaction was successfully submitted
          return;
        }
        throw waitError;
      }
    } catch (error: any) {
      // Handle specific error cases with better UX
      if (error.code === 'ACTION_REJECTED' || error.code === 4001) {
        throw new Error('Transaction cancelled by user');
      }
      if (error.message?.includes('insufficient funds')) {
        throw new Error('Insufficient balance for transaction');
      }
      if (error.message?.includes('CONFIRMATION_TIMEOUT')) {
        // Transaction submitted successfully but confirmation pending
        console.log('Transaction submitted - confirmation pending in background');
        return;
      }
      // Re-throw other errors
      throw error;
    }
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

      {/* Manual Casper Address Input (for Ethereum→Casper without wallet) */}
      {!isCasperToEthereum && !casperAddress && (
        <div className="mb-6">
          <label className="block text-sm font-medium mb-2 text-gray-300">
            Casper Destination Address
          </label>
          <input
            type="text"
            value={manualCasperAddress}
            onChange={(e) => setManualCasperAddress(e.target.value)}
            placeholder="account-hash-... or public key hex"
            className="input"
            disabled={isProcessing}
          />
          <div className="text-xs text-gray-400 mt-1">
            Enter your Casper wallet address to receive CSPR
          </div>
        </div>
      )}

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
        disabled={isProcessing || !canBridge || !amount || parseFloat(amount) <= 0}
        className="btn-primary w-full flex items-center justify-center gap-2"
      >
        {isProcessing ? (
          <>
            <Loader2 size={20} className="animate-spin" />
            Processing...
          </>
        ) : !canBridge ? (
          isCasperToEthereum ? 'Connect Both Wallets' : 'Connect Ethereum & Enter Casper Address'
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
