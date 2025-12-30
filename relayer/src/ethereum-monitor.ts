/**
 * Ethereum Network Monitor
 * Listens for AssetBurned events and submits mint proofs
 */

import { EventEmitter } from 'events';
import { ethers } from 'ethers';
import { Logger } from './logger';
import { EthereumSigner } from './signature-utils';

const logger = Logger.getInstance();

export interface EthereumMonitorConfig {
  rpcUrl: string;
  chainId: number;
  wrapperContract: string;
  privateKey: string;
  pollInterval: number;
  confirmationBlocks: number;
}

export class EthereumMonitor extends EventEmitter {
  private config: EthereumMonitorConfig;
  private provider: ethers.JsonRpcProvider;
  private wallet: ethers.Wallet;
  private signer: EthereumSigner;
  private contract: ethers.Contract | null = null;
  private isRunning: boolean = false;
  private lastProcessedBlock: number = 0;

  // Simplified ABI for the events we care about
  private readonly WRAPPER_ABI = [
    'event AssetBurned(address indexed user, uint256 amount, string destinationChain, string destinationAddress, uint256 indexed nonce)',
    'event AssetMinted(address indexed user, uint256 amount, string sourceChain, string sourceTxHash, uint256 indexed nonce)',
    'function mint((string sourceChain, string sourceTxHash, uint256 amount, address recipient, uint256 nonce, bytes[] validatorSignatures) proof)',
  ];

  constructor(config: EthereumMonitorConfig) {
    super();
    this.config = config;
    // Create provider with explicit network config to avoid detection timeout
    const network = new ethers.Network('sepolia', config.chainId);
    this.provider = new ethers.JsonRpcProvider(config.rpcUrl, network, { staticNetwork: network });
    this.wallet = new ethers.Wallet(config.privateKey, this.provider);
    this.signer = new EthereumSigner(config.privateKey);
  }

  async start(): Promise<void> {
    logger.info('Starting Ethereum monitor', {
      rpc: this.config.rpcUrl,
      chainId: this.config.chainId,
      contract: this.config.wrapperContract,
    });

    this.contract = new ethers.Contract(
      this.config.wrapperContract,
      this.WRAPPER_ABI,
      this.wallet
    );

    this.isRunning = true;

    // Get current block to start from (with retry logic)
    let retries = 3;
    while (retries > 0) {
      try {
        this.lastProcessedBlock = await this.provider.getBlockNumber();
        logger.info('Ethereum monitor started at block', { block: this.lastProcessedBlock });
        break;
      } catch (error) {
        retries--;
        logger.warn(`Failed to get block number, retries left: ${retries}`, { error });
        if (retries === 0) throw error;
        await this.sleep(2000);
      }
    }

    this.pollEvents();
  }

  async stop(): Promise<void> {
    this.isRunning = false;
    logger.info('Ethereum monitor stopped');
  }

  private async pollEvents(): Promise<void> {
    while (this.isRunning) {
      try {
        const currentBlock = await this.provider.getBlockNumber();
        const confirmationBlock = currentBlock - this.config.confirmationBlocks;

        if (confirmationBlock > this.lastProcessedBlock) {
          await this.processBlocks(this.lastProcessedBlock + 1, confirmationBlock);
          this.lastProcessedBlock = confirmationBlock;
        }

        await this.sleep(this.config.pollInterval);
      } catch (error) {
        logger.error('Error polling Ethereum events', { error });
      }
    }
  }

  private async processBlocks(fromBlock: number, toBlock: number): Promise<void> {
    if (!this.contract) return;

    // Limit block range for Alchemy free tier (max 10 blocks per query)
    const MAX_BLOCKS_PER_QUERY = 10;
    let currentFrom = fromBlock;

    while (currentFrom <= toBlock) {
      const currentTo = Math.min(currentFrom + MAX_BLOCKS_PER_QUERY - 1, toBlock);

      try {
        const filter = this.contract.filters.AssetBurned();
        const events = await this.contract.queryFilter(filter, currentFrom, currentTo);

        logger.debug(`Queried blocks ${currentFrom} to ${currentTo}, found ${events.length} events`);

        for (const event of events) {
          // Type guard to check if event is an EventLog with args
          if ('args' in event && event.args) {
            logger.info('🔥 Detected AssetBurned event!', {
              user: event.args.user,
              amount: event.args.amount.toString(),
              nonce: event.args.nonce.toString(),
              block: event.blockNumber,
              tx: event.transactionHash
            });

            this.emit('AssetBurned', {
              user: event.args.user,
              amount: event.args.amount.toString(),
              destinationChain: event.args.destinationChain,
              destinationAddress: event.args.destinationAddress,
              nonce: event.args.nonce.toString(),
              blockNumber: event.blockNumber,
              txHash: event.transactionHash,
            });
          }
        }
      } catch (error) {
        logger.warn(`Failed to query blocks ${currentFrom}-${currentTo}`, { error });
        // Continue to next range even if this one fails
      }

      currentFrom = currentTo + 1;
    }
  }

  async submitMintProof(lockEvent: any): Promise<void> {
    if (!this.contract) {
      logger.error('Contract not initialized');
      return;
    }

    logger.info('Submitting mint proof to Ethereum', { lockEvent });

    try {
      // STEP 1: Create message hash (MUST match contract's _getMessageHash)
      const messageHash = this.signer.createMessageHash(
        'casper',                        // sourceChain
        lockEvent.txHash || '0x0',       // sourceTxHash
        lockEvent.amount.toString(),     // amount (as string)
        lockEvent.destinationAddress,    // recipient
        lockEvent.nonce.toString()       // nonce (as string)
      );

      // STEP 2: Sign the message hash
      const signature = await this.signer.signMessage(messageHash);

      logger.info('Generated signature for mint proof', {
        messageHash,
        signature,
        validator: this.signer.getAddress()
      });

      // STEP 3: Create proof with signature
      const proof = {
        sourceChain: 'casper',
        sourceTxHash: lockEvent.txHash || '0x0',
        amount: lockEvent.amount,
        recipient: lockEvent.destinationAddress,
        nonce: lockEvent.nonce,
        validatorSignatures: [
          signature, // Real cryptographic signature!
        ],
      };

      // STEP 4: Submit to Ethereum contract
      const tx = await this.contract.mint(proof);
      logger.info('Mint transaction submitted', { txHash: tx.hash });

      const receipt = await tx.wait();
      logger.info('✅ Mint transaction confirmed', {
        txHash: receipt.hash,
        blockNumber: receipt.blockNumber,
        validator: this.signer.getAddress()
      });
    } catch (error) {
      logger.error('❌ Error submitting mint proof', { error });
      throw error;
    }
  }

  getStatus(): object {
    return {
      isRunning: this.isRunning,
      lastProcessedBlock: this.lastProcessedBlock,
      contract: this.config.wrapperContract,
    };
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
