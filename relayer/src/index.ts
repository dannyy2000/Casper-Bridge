/**
 * CasperBridge Relayer Service
 *
 * Monitors events on both Casper and Ethereum chains and relays
 * cross-chain transaction proofs to enable bridging.
 */

import * as dotenv from 'dotenv';
import { CasperMonitor } from './casper-monitor';
import { EthereumMonitor } from './ethereum-monitor';
import { Logger } from './logger';

dotenv.config();

const logger = Logger.getInstance();

class BridgeRelayer {
  private casperMonitor: CasperMonitor;
  private ethereumMonitor: EthereumMonitor;
  private isRunning: boolean = false;

  constructor() {
    logger.info('Initializing CasperBridge Relayer...');

    this.casperMonitor = new CasperMonitor(
      {
        rpcUrl: process.env.CASPER_RPC_URL!,
        networkName: process.env.CASPER_NETWORK_NAME!,
        vaultContract: process.env.CASPER_VAULT_CONTRACT!,
        privateKeyPath: process.env.CASPER_PRIVATE_KEY_PATH!,
        pollInterval: parseInt(process.env.POLL_INTERVAL_MS || '5000'),
        confirmationBlocks: parseInt(process.env.CONFIRMATION_BLOCKS_CASPER || '3'),
      },
      process.env.CASPER_PRIVATE_KEY_HEX!  // Ed25519 private key as hex string
    );

    this.ethereumMonitor = new EthereumMonitor({
      rpcUrl: process.env.ETHEREUM_RPC_URL!,
      chainId: parseInt(process.env.ETHEREUM_CHAIN_ID || '11155111'),
      wrapperContract: process.env.ETHEREUM_WRAPPER_CONTRACT!,
      privateKey: process.env.ETHEREUM_PRIVATE_KEY!,
      pollInterval: parseInt(process.env.POLL_INTERVAL_MS || '5000'),
      confirmationBlocks: parseInt(process.env.CONFIRMATION_BLOCKS_ETHEREUM || '12'),
    });
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('Relayer is already running');
      return;
    }

    logger.info('Starting relayer service...');
    this.isRunning = true;

    // Setup event handlers
    this.casperMonitor.on('AssetLocked', async (event) => {
      logger.info('Detected AssetLocked event on Casper', { event });
      await this.ethereumMonitor.submitMintProof(event);
    });

    this.ethereumMonitor.on('AssetBurned', async (event) => {
      logger.info('Detected AssetBurned event on Ethereum', { event });
      await this.casperMonitor.submitReleaseProof(event);
    });

    // Start monitoring both chains
    await Promise.all([
      this.casperMonitor.start(),
      this.ethereumMonitor.start(),
    ]);

    logger.info('✅ Relayer service started successfully');
    logger.info('Monitoring both chains for bridge events...');
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    logger.info('Stopping relayer service...');
    this.isRunning = false;

    await Promise.all([
      this.casperMonitor.stop(),
      this.ethereumMonitor.stop(),
    ]);

    logger.info('Relayer service stopped');
  }

  getStatus(): object {
    return {
      isRunning: this.isRunning,
      casper: this.casperMonitor.getStatus(),
      ethereum: this.ethereumMonitor.getStatus(),
    };
  }
}

// Main execution
async function main() {
  const relayer = new BridgeRelayer();

  // Graceful shutdown
  process.on('SIGINT', async () => {
    logger.info('Received SIGINT, shutting down gracefully...');
    await relayer.stop();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    logger.info('Received SIGTERM, shutting down gracefully...');
    await relayer.stop();
    process.exit(0);
  });

  try {
    await relayer.start();
  } catch (error) {
    logger.error('Failed to start relayer', { error });
    process.exit(1);
  }
}

// Run if this is the main module
if (require.main === module) {
  main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { BridgeRelayer };
