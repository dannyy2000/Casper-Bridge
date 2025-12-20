/**
 * Ethereum Network Monitor
 * Listens for AssetBurned events and submits mint proofs
 */

import { EventEmitter } from 'events';
import { ethers } from 'ethers';
import { Logger } from './logger';

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
    this.provider = new ethers.JsonRpcProvider(config.rpcUrl);
    this.wallet = new ethers.Wallet(config.privateKey, this.provider);
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

    // Get current block to start from
    this.lastProcessedBlock = await this.provider.getBlockNumber();

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

    const filter = this.contract.filters.AssetBurned();
    const events = await this.contract.queryFilter(filter, fromBlock, toBlock);

    for (const event of events) {
      if (event.args) {
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
  }

  async submitMintProof(lockEvent: any): Promise<void> {
    if (!this.contract) {
      logger.error('Contract not initialized');
      return;
    }

    logger.info('Submitting mint proof to Ethereum', { lockEvent });

    try {
      // TODO: Gather validator signatures
      const proof = {
        sourceChain: 'casper',
        sourceTxHash: lockEvent.txHash || '0x0',
        amount: lockEvent.amount,
        recipient: lockEvent.destinationAddress,
        nonce: lockEvent.nonce,
        validatorSignatures: [
          '0x00', // Placeholder for MVP
          '0x00',
        ],
      };

      const tx = await this.contract.mint(proof);
      logger.info('Mint transaction submitted', { txHash: tx.hash });

      const receipt = await tx.wait();
      logger.info('Mint transaction confirmed', {
        txHash: receipt.hash,
        blockNumber: receipt.blockNumber,
      });
    } catch (error) {
      logger.error('Error submitting mint proof', { error });
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
