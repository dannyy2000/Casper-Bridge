/**
 * Wallet Connection Component
 * Handles both MetaMask (Ethereum) and CSPR.click (Casper) wallet connections
 */

import { useBridgeStore } from '../store/useBridgeStore';
import { Wallet, LogOut } from 'lucide-react';

export function WalletConnect() {
  const {
    ethereumAddress,
    casperAddress,
    ethereumBalance,
    casperBalance,
    connectEthereum,
    disconnectEthereum,
    connectCasper,
    disconnectCasper,
  } = useBridgeStore();

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  return (
    <div className="flex gap-4 justify-end">
      {/* Ethereum Wallet */}
      <div className="card min-w-[200px]">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-3 h-3 bg-ethereum-purple rounded-full"></div>
          <span className="text-sm font-semibold">Ethereum</span>
        </div>

        {ethereumAddress ? (
          <div>
            <div className="text-xs text-gray-400 mb-1">Connected</div>
            <div className="text-sm font-mono mb-2">{formatAddress(ethereumAddress)}</div>
            <div className="text-xs text-gray-400">Balance: {ethereumBalance ? `${Number(ethereumBalance).toFixed(4)} ETH` : '...'}</div>
            <button
              onClick={disconnectEthereum}
              className="mt-3 flex items-center gap-1 text-xs text-red-400 hover:text-red-300"
            >
              <LogOut size={12} />
              Disconnect
            </button>
          </div>
        ) : (
          <button
            onClick={connectEthereum}
            className="btn-secondary text-sm py-2 px-4 w-full flex items-center justify-center gap-2"
          >
            <Wallet size={16} />
            Connect MetaMask
          </button>
        )}
      </div>

      {/* Casper Wallet */}
      <div className="card min-w-[200px]">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-3 h-3 bg-casper-red rounded-full"></div>
          <span className="text-sm font-semibold">Casper</span>
        </div>

        {casperAddress ? (
          <div>
            <div className="text-xs text-gray-400 mb-1">Connected</div>
            <div className="text-sm font-mono mb-2 truncate" title={casperAddress}>
              {casperAddress.length > 20 ? formatAddress(casperAddress) : casperAddress}
            </div>
            <div className="text-xs text-gray-400">Balance: {casperBalance ? `${Number(casperBalance).toFixed(2)} CSPR` : '...'}</div>
            <button
              onClick={disconnectCasper}
              className="mt-3 flex items-center gap-1 text-xs text-red-400 hover:text-red-300"
            >
              <LogOut size={12} />
              Disconnect
            </button>
          </div>
        ) : (
          <button
            onClick={connectCasper}
            className="btn-secondary text-sm py-2 px-4 w-full flex items-center justify-center gap-2"
          >
            <Wallet size={16} />
            Connect Wallet
          </button>
        )}
      </div>
    </div>
  );
}
