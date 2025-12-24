/**
 * Transaction History Component
 * Displays recent bridge transactions
 */

import { useBridgeStore } from '../store/useBridgeStore';
import { ExternalLink, Clock, CheckCircle } from 'lucide-react';

// Mock transaction data for demonstration
const mockTransactions = [
  {
    id: '1',
    from: 'Casper',
    to: 'Ethereum',
    amount: '100.0 CSPR',
    status: 'completed',
    txHash: '0x1234...5678',
    timestamp: new Date(Date.now() - 3600000).toLocaleString(),
  },
  {
    id: '2',
    from: 'Ethereum',
    to: 'Casper',
    amount: '50.0 wCSPR',
    status: 'pending',
    txHash: '0xabcd...efgh',
    timestamp: new Date(Date.now() - 300000).toLocaleString(),
  },
];

export function TransactionHistory() {
  const { lastTransaction } = useBridgeStore();

  return (
    <div className="card max-w-4xl mx-auto mt-8">
      <h3 className="text-xl font-bold mb-4">Recent Transactions</h3>

      {mockTransactions.length === 0 && !lastTransaction ? (
        <div className="text-center py-12 text-gray-400">
          <p>No transactions yet</p>
          <p className="text-sm mt-2">Your bridge transactions will appear here</p>
        </div>
      ) : (
        <div className="space-y-3">
          {mockTransactions.map((tx) => (
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
                  href={`https://etherscan.io/tx/${tx.txHash}`}
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
