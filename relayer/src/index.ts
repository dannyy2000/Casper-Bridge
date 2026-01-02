/**
 * CasperBridge Relayer Service
 *
 * Monitors events on both Casper and Ethereum chains and relays
 * cross-chain transaction proofs to enable bridging.
 */

import * as dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import { CasperMonitor } from './casper-monitor';
import { EthereumMonitor } from './ethereum-monitor';
import { Logger } from './logger';
import { CasperClient, DeployUtil } from 'casper-js-sdk';

dotenv.config();

const logger = Logger.getInstance();

class BridgeRelayer {
  private casperMonitor: CasperMonitor;
  private ethereumMonitor: EthereumMonitor;
  private isRunning: boolean = false;
  private app: express.Application;
  private httpServer: any;
  private casperClient: CasperClient;

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

    // Initialize Casper client for deploy submission
    this.casperClient = new CasperClient(process.env.CASPER_RPC_URL || 'http://34.220.83.153:7777/rpc');

    // Setup HTTP server for deploy submission endpoint
    this.app = express();
    this.app.use(cors());
    this.app.use(express.json({ limit: '1mb' }));

    // Health check endpoint
    this.app.get('/health', (req, res) => {
      res.json({ status: 'ok', relayer: this.getStatus() });
    });

    // Deploy submission endpoint
    this.app.post('/api/submit-deploy', async (req, res) => {
      try {
        const { deployJson } = req.body;

        if (!deployJson) {
          return res.status(400).json({ error: 'Missing deployJson in request body' });
        }

        logger.info('Received deploy submission request');
        logger.info('Deploy JSON keys:', { keys: Object.keys(deployJson) });

        // Check for approvals in the correct nested location
        const approvals = deployJson.deploy?.approvals || deployJson.approvals || [];
        logger.info('Deploy JSON approvals:', { approvals: approvals.length });

        // Log the actual approval structure
        if (approvals.length > 0) {
          logger.info('Approval details:', {
            signer: approvals[0].signer,
            signatureLength: approvals[0].signature?.length || 0,
            signatureType: typeof approvals[0].signature,
          });
        } else {
          logger.warn('⚠️ No approvals found in deploy! Deploy will fail without signatures.');
        }

        // Parse deploy from JSON - must include approvals at root level
        const deploy = DeployUtil.deployFromJson(deployJson).unwrap();

        logger.info('Deploy after parsing:', {
          hash: deploy.hash,
          approvalsCount: deploy.approvals.length,
        });

        if (deploy.approvals.length > 0) {
          logger.info('Parsed approval:', {
            signer: deploy.approvals[0].signer,
            signature: deploy.approvals[0].signature,
          });
        }

        logger.info('Submitting deploy to Casper network...');

        // Submit to Casper network
        const deployHash = await this.casperClient.putDeploy(deploy);

        logger.info('✅ Deploy submitted successfully', { deployHash });

        // Track this deploy for lock event detection
        this.casperMonitor.trackDeploy(deployHash);

        res.json({
          success: true,
          deployHash,
          explorerUrl: `https://testnet.cspr.live/deploy/${deployHash}`,
        });
      } catch (error: any) {
        logger.error('Failed to submit deploy', { error: error.message, stack: error.stack });
        res.status(500).json({
          error: 'Failed to submit deploy',
          message: error.message,
        });
      }
    });

    // Endpoint to manually reprocess a past deploy
    this.app.post('/api/reprocess-deploy', async (req, res) => {
      try {
        const { deployHash } = req.body;

        if (!deployHash) {
          return res.status(400).json({ error: 'Missing deployHash' });
        }

        logger.info('Received reprocess request for deploy', { deployHash });

        // Track this deploy for lock event detection
        this.casperMonitor.trackDeploy(deployHash);

        res.json({
          success: true,
          message: 'Deploy added to tracking queue',
          deployHash
        });
      } catch (error: any) {
        logger.error('Failed to reprocess deploy', { error: error.message });
        res.status(500).json({ error: error.message });
      }
    });

    // Casper balance endpoint to proxy RPC and avoid CORS
    this.app.post('/api/casper-balance', async (req, res) => {
      try {
        const { publicKey } = req.body;

        if (!publicKey) {
          return res.status(400).json({ error: 'Missing publicKey' });
        }

        // Use casper-js-sdk to fetch balance
        try {
          // Get latest block to get state root hash
          const latestBlock = await this.casperClient.nodeClient.getLatestBlockInfo();

          logger.info('Latest block structure', {
            topLevelKeys: Object.keys(latestBlock),
            hasBlock: !!latestBlock.block,
            blockType: typeof latestBlock.block,
            fullDump: JSON.stringify(latestBlock).substring(0, 500)
          });

          // Casper 2.0: block might be directly in latestBlock or nested
          const block = (latestBlock as any).block_with_signatures?.block || latestBlock.block;

          let stateRootHash;
          if ((block as any)?.Version2) {
            const header = (block as any).Version2.header;
            logger.info('Found Version2 block');
            stateRootHash = header.state_root_hash;
          } else if (block?.header) {
            logger.info('Found legacy block');
            stateRootHash = block.header.state_root_hash;
          }

          if (!stateRootHash) {
            logger.error('Could not get state root hash', {
              hadBlock: !!block,
              blockKeys: Object.keys(block || {})
            });
            throw new Error('Could not get state root hash');
          }

          // Get balance using state query (Casper 2.0)
          const balanceUref = await this.casperClient.nodeClient.getAccountBalanceUrefByPublicKeyHash(
            stateRootHash,
            publicKey
          );

          const balance = await this.casperClient.nodeClient.getAccountBalance(
            stateRootHash,
            balanceUref
          );

          // Convert motes to CSPR
          const balanceInMotes = BigInt(balance.toString());
          const balanceInCSPR = (Number(balanceInMotes) / 1_000_000_000).toFixed(2);
          res.json({ balance: balanceInCSPR });
        } catch (balanceError: any) {
          logger.warn('Could not fetch balance, account may be empty or invalid', {
            publicKey: publicKey.substring(0, 10) + '...',
            error: balanceError.message,
          });
          // Return 0 for accounts that don't exist or have no balance
          res.json({ balance: '0.00' });
        }
      } catch (error: any) {
        logger.error('Failed to fetch Casper balance', { error: error.message });
        res.status(500).json({ error: 'Failed to fetch balance' });
      }
    });
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('Relayer is already running');
      return;
    }

    logger.info('Starting relayer service...');
    this.isRunning = true;

    // Start HTTP server for deploy submission
    const port = parseInt(process.env.RELAYER_PORT || '3001');
    this.httpServer = this.app.listen(port, '0.0.0.0', () => {
      logger.info(`🌐 HTTP server listening on http://localhost:${port}`);
      logger.info(`Deploy submission endpoint: http://localhost:${port}/api/submit-deploy`);
    });

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

    // Close HTTP server
    if (this.httpServer) {
      await new Promise<void>((resolve) => {
        this.httpServer.close(() => {
          logger.info('HTTP server closed');
          resolve();
        });
      });
    }

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
