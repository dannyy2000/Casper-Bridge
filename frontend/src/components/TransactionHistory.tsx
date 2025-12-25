/**
 * Transaction History Component
 * Displays recent bridge transactions
 */

import { useState, useEffect } from 'react';
import { useBridgeStore } from '../store/useBridgeStore';
import { ExternalLink, Clock, CheckCircle, RefreshCw } from 'lucide-react';
import { ethers } from 'ethers';
import { CONTRACTS } from '../config/contracts';

interface Transaction {
  id: string;
  from: string;
  to: string;
  amount: string;
  status: 'completed' | 'pending';
  txHash: string;
  timestamp: string;
  blockNumber: number;
}

export function TransactionHistory() {
  const { ethereumProvider, ethereumAddress, lastTransaction } = useBridgeStore();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Fetch on mount and when new transaction
    if (ethereumProvider && ethereumAddress) {
      fetchTransactions();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ethereumAddress, lastTransaction]);

  const handleRefresh = () => {
    fetchTransactions();
  };

  const fetchTransactions = async () => {
    if (!ethereumProvider || !ethereumAddress) return;

    try {
      setLoading(true);

      const contract = new ethers.Contract(
        CONTRACTS.ethereum.wrapperAddress,
        CONTRACTS.ethereum.abi,
        ethereumProvider
      );

      // Fetch recent events (Alchemy free tier: max 10 blocks per query)
      // Query last 100 blocks in chunks of 10
      const currentBlock = await ethereumProvider.getBlockNumber();
      const fromBlock = Math.max(0, currentBlock - 100);

      // Query in chunks of 10 blocks (Alchemy free tier limit)
      const mintEvents: any[] = [];
      const burnEvents: any[] = [];

      for (let i = fromBlock; i <= currentBlock; i += 10) {
        const to = Math.min(i + 9, currentBlock);

        // Fetch AssetMinted events
        const mintFilter = contract.filters.AssetMinted(ethereumAddress);
        const mints = await contract.queryFilter(mintFilter, i, to);
        mintEvents.push(...mints);

        // Fetch AssetBurned events
        const burnFilter = contract.filters.AssetBurned(ethereumAddress);
        const burns = await contract.queryFilter(burnFilter, i, to);
        burnEvents.push(...burns);
      }

      // Convert events to transaction objects
      const mintTxs: Transaction[] = await Promise.all(
        mintEvents.map(async (event) => {
          const block = await event.getBlock();
          const amount = 'args' in event ? (event.args?.amount || 0) : 0;
          return {
            id: event.transactionHash,
            from: 'Casper',
            to: 'Ethereum',
            amount: `${ethers.formatEther(amount)} CSPR`,
            status: 'completed' as const,
            txHash: event.transactionHash,
            timestamp: new Date(block.timestamp * 1000).toLocaleString(),
            blockNumber: event.blockNumber,
          };
        })
      );

      const burnTxs: Transaction[] = await Promise.all(
        burnEvents.map(async (event) => {
          const block = await event.getBlock();
          const amount = 'args' in event ? (event.args?.amount || 0) : 0;
          return {
            id: event.transactionHash,
            from: 'Ethereum',
            to: 'Casper',
            amount: `${ethers.formatEther(amount)} wCSPR`,
            status: 'completed' as const,
            txHash: event.transactionHash,
            timestamp: new Date(block.timestamp * 1000).toLocaleString(),
            blockNumber: event.blockNumber,
          };
        })
      );

      // Combine and sort by block number (most recent first)
      const allTxs = [...mintTxs, ...burnTxs].sort((a, b) => b.blockNumber - a.blockNumber);

      setTransactions(allTxs);
    } catch (error) {
      console.error('Failed to fetch transactions:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card max-w-4xl mx-auto mt-8">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl font-bold">Recent Transactions</h3>
        <div className="flex items-center gap-2">
          {loading && (
            <div className="text-sm text-gray-400 flex items-center gap-2">
              <Clock size={14} className="animate-spin" />
              Loading...
            </div>
          )}
          <button
            onClick={handleRefresh}
            disabled={loading || !ethereumProvider}
            className="p-2 rounded-lg bg-gray-700 hover:bg-gray-600 transition-colors disabled:opacity-50"
            title="Refresh transactions"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {transactions.length === 0 && !loading ? (
        <div className="text-center py-12 text-gray-400">
          <p>No transactions yet</p>
          <p className="text-sm mt-2">Your bridge transactions will appear here</p>
        </div>
      ) : (
        <div className="space-y-3">
          {transactions.map((tx) => (
            <div
              key={tx.id}
              className="flex items-center justify-between p-4 bg-gray-900/50 rounded-lg border border-gray-700/50 hover:border-gray-600/50 transition-colors"
            >
              <div className="flex items-center gap-4">
                {tx.status === 'completed' ? (
                  <CheckCircle className="text-green-500" size={20} />
                ) : (
                  <Clock className="text-yellow-500 animate-pulse-slow" size={20} />
                )}

                <div>
                  <div className="font-semibold text-sm">
                    {tx.from} → {tx.to}
                  </div>
                  <div className="text-xs text-gray-400 mt-1">{tx.timestamp}</div>
                </div>
              </div>

              <div className="text-right">
                <div className="font-semibold">{tx.amount}</div>
                <a
                  href={`https://sepolia.etherscan.io/tx/${tx.txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-casper-red hover:text-red-400 flex items-center gap-1 justify-end mt-1"
                >
                  View TX
                  <ExternalLink size={12} />
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
