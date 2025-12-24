/**
 * Main App Component
 * CasperBridge - Cross-chain asset bridge between Casper and Ethereum
 */

import { WalletConnect } from './components/WalletConnect';
import { BridgeForm } from './components/BridgeForm';
import { TransactionHistory } from './components/TransactionHistory';
import { Github, Twitter, FileText } from 'lucide-react';

function App() {
  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="border-b border-gray-800 bg-black/50 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            {/* Logo */}
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-10 h-10 bg-gradient-to-br from-casper-red to-ethereum-purple rounded-lg flex items-center justify-center">
                  <span className="text-xl font-bold">CB</span>
                </div>
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
              </div>
              <div>
                <h1 className="text-xl font-bold">CasperBridge</h1>
                <p className="text-xs text-gray-400">Cross-chain Asset Bridge</p>
              </div>
            </div>

            {/* Wallet Connect */}
            <WalletConnect />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-12">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold mb-4">
            Bridge Assets Between{' '}
            <span className="bg-gradient-to-r from-casper-red to-ethereum-purple bg-clip-text text-transparent">
              Casper & Ethereum
            </span>
          </h2>
          <p className="text-gray-400 max-w-2xl mx-auto">
            Seamlessly transfer CSPR and liquid staking tokens across chains with our secure,
            decentralized bridge. Powered by cryptographic proofs and validator consensus.
          </p>
        </div>

        {/* Bridge Form */}
        <BridgeForm />

        {/* Transaction History */}
        <TransactionHistory />

        {/* Features */}
        <div className="grid md:grid-cols-3 gap-6 mt-16 max-w-4xl mx-auto">
          <div className="card text-center">
            <div className="w-12 h-12 bg-casper-red/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-casper-red" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h3 className="font-semibold mb-2">Secure</h3>
            <p className="text-sm text-gray-400">
              Cryptographic signatures and validator consensus ensure your assets are safe
            </p>
          </div>

          <div className="card text-center">
            <div className="w-12 h-12 bg-ethereum-purple/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-ethereum-purple" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <h3 className="font-semibold mb-2">Fast</h3>
            <p className="text-sm text-gray-400">
              Bridge transactions complete in 5-10 minutes with automated relayers
            </p>
          </div>

          <div className="card text-center">
            <div className="w-12 h-12 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <h3 className="font-semibold mb-2">Decentralized</h3>
            <p className="text-sm text-gray-400">
              No central authority - powered by smart contracts and validators
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-800 mt-20 bg-black/50">
        <div className="container mx-auto px-4 py-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="text-sm text-gray-400">
              © 2026 CasperBridge • Built for Casper Hackathon 2026
            </div>
            <div className="flex items-center gap-6">
              <a href="#" className="text-gray-400 hover:text-white transition-colors">
                <Github size={20} />
              </a>
              <a href="#" className="text-gray-400 hover:text-white transition-colors">
                <Twitter size={20} />
              </a>
              <a href="#" className="text-gray-400 hover:text-white transition-colors">
                <FileText size={20} />
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
