/**
 * Casper Network Monitor
 * Listens for AssetLocked events and submits release proofs
 */

import { EventEmitter } from 'events';
import { Logger } from './logger';
import { CasperSigner } from './signature-utils';
import { CasperClient, CLPublicKey } from 'casper-js-sdk';

const logger = Logger.getInstance();

export interface CasperMonitorConfig {
  rpcUrl: string;
  networkName: string;
  vaultContract: string;
  privateKeyPath: string;
  pollInterval: number;
  confirmationBlocks: number;
}

interface LockEvent {
  sourceChain: string;
  sourceTxHash: string;
  amount: string;
  destinationChain: string;
  destinationAddress: string;
  nonce: number;
  sender: string;
}

export class CasperMonitor extends EventEmitter {
  private config: CasperMonitorConfig;
  private signer: CasperSigner;
  private isRunning: boolean = false;
  private lastProcessedBlock: number = 0;
  private casperClient: CasperClient;
  private processedDeploys: Set<string> = new Set();

  constructor(config: CasperMonitorConfig, casperPrivateKeyHex: string) {
    super();
    this.config = config;
    this.signer = new CasperSigner(casperPrivateKeyHex);
    this.casperClient = new CasperClient(config.rpcUrl);
  }

  async start(): Promise<void> {
    logger.info('Starting Casper monitor', {
      rpc: this.config.rpcUrl,
      contract: this.config.vaultContract,
    });

    this.isRunning = true;

    // Start polling for lock events
    this.pollEvents();
  }

  async stop(): Promise<void> {
    this.isRunning = false;
    logger.info('Casper monitor stopped');
  }

  private async pollEvents(): Promise<void> {
    while (this.isRunning) {
      try {
        // Get latest block to check for executed deploys
        const latestBlock = await this.casperClient.nodeClient.getLatestBlockInfo();

        if (latestBlock?.block?.hash) {
          await this.checkBlockForLockEvents(latestBlock.block.hash);
        }

        await this.sleep(this.config.pollInterval);
      } catch (error: any) {
        logger.error('Error polling Casper events', { error: error.message });
        await this.sleep(this.config.pollInterval);
      }
    }
  }

  private async checkBlockForLockEvents(blockHash: string): Promise<void> {
    try {
      // Get block details
      const blockData = await this.casperClient.nodeClient.getBlockInfo(blockHash);

      if (!(blockData?.block as any)?.body?.deploy_hashes) {
        return;
      }

      // Check each deploy in the block
      for (const deployHash of (blockData.block as any).body.deploy_hashes) {
        // Skip if already processed
        if (this.processedDeploys.has(deployHash)) {
          continue;
        }

        await this.checkDeployForLockEvent(deployHash);
      }
    } catch (error: any) {
      logger.error('Error checking block for lock events', {
        blockHash,
        error: error.message
      });
    }
  }

  private async checkDeployForLockEvent(deployHash: string): Promise<void> {
    try {
      const [deploy, deployResult] = await this.casperClient.getDeploy(deployHash);

      if (!deployResult?.execution_results?.[0]) {
        return; // Deploy not executed yet
      }

      const executionResult = deployResult.execution_results[0].result;

      // Check if execution was successful
      if (!executionResult.Success) {
        this.processedDeploys.add(deployHash);
        return;
      }

      // Check if this deploy called the lock_cspr entry point
      const session = deploy?.session;
      if (!(session as any)?.storedContractByHash) {
        this.processedDeploys.add(deployHash);
        return;
      }

      const contractHash = (session as any).storedContractByHash.hash;
      const entryPoint = (session as any).storedContractByHash.entry_point;

      // Check if it's our vault contract and lock_cspr entry point
      if (contractHash !== this.config.vaultContract || entryPoint !== 'lock_cspr') {
        this.processedDeploys.add(deployHash);
        return;
      }

      // Parse the lock event from the deploy args
      const lockEvent = this.parseLockEvent(deploy, deployHash);

      if (lockEvent) {
        logger.info('🔒 Detected lock event on Casper', { lockEvent });

        // Emit event for the main relayer to handle minting
        this.emit('AssetLocked', lockEvent);

        this.processedDeploys.add(deployHash);
      }
    } catch (error: any) {
      logger.error('Error checking deploy for lock event', {
        deployHash,
        error: error.message
      });
    }
  }

  private parseLockEvent(deploy: any, deployHash: string): LockEvent | null {
    try {
      const args = deploy.session?.StoredContractByHash?.args;
      if (!args) return null;

      let destinationChain = '';
      let destinationAddress = '';
      let amount = '';

      // Parse args array
      for (const [name, value] of args) {
        if (name === 'destination_chain') {
          destinationChain = value.parsed || '';
        } else if (name === 'destination_address') {
          destinationAddress = value.parsed || '';
        } else if (name === 'amount') {
          amount = value.parsed || '';
        }
      }

      if (!destinationChain || !destinationAddress || !amount) {
        logger.warn('Incomplete lock event data', { deployHash });
        return null;
      }

      // Generate nonce from deploy hash
      const nonce = parseInt(deployHash.substring(0, 8), 16);

      return {
        sourceChain: 'casper',
        sourceTxHash: deployHash,
        amount,
        destinationChain,
        destinationAddress,
        nonce,
        sender: deploy.header?.account || '',
      };
    } catch (error: any) {
      logger.error('Error parsing lock event', { error: error.message });
      return null;
    }
  }

  async submitReleaseProof(burnEvent: any): Promise<void> {
    logger.info('Submitting release proof to Casper', { burnEvent });

    try {
      // STEP 1: Create message (MUST match contract's get_message_hash)
      const message = this.signer.createMessage(
        'ethereum',                         // sourceChain
        burnEvent.txHash || '0x0',          // sourceTxHash
        burnEvent.amount.toString(),        // amount (as string)
        burnEvent.destinationAddress,       // recipient (Casper address)
        burnEvent.nonce.toString()          // nonce (as string)
      );

      // STEP 2: Sign the message with Ed25519
      const signature = await this.signer.signMessage(message);
      const publicKey = this.signer.getPublicKey();

      logger.info('Generated Ed25519 signature for release proof', {
        messageHex: Buffer.from(message).toString('hex'),
        signatureHex: Buffer.from(signature).toString('hex'),
        publicKeyHex: this.signer.getPublicKeyHex(),
      });

      // STEP 3: Create proof with signature
      const proof = {
        source_chain: 'ethereum',
        source_tx_hash: burnEvent.txHash || '0x0',
        amount: burnEvent.amount,
        recipient: burnEvent.destinationAddress,
        nonce: burnEvent.nonce,
        validator_signatures: [
          {
            public_key: Array.from(publicKey),     // 32-byte Ed25519 public key
            signature: Array.from(signature),      // 64-byte Ed25519 signature
          },
        ],
      };

      // STEP 4: Submit to Casper vault contract
      // TODO: Implement Casper contract interaction using casper-js-sdk
      logger.info('📝 Proof ready for Casper submission', { proof });
      logger.warn('Casper contract submission not yet implemented - need casper-js-sdk integration');

      // Placeholder for actual contract call:
      // const deploy = await casperClient.makeDeploy(...);
      // const deployHash = await casperClient.putDeploy(deploy);
      // logger.info('✅ Release transaction submitted to Casper', { deployHash });
    } catch (error) {
      logger.error('❌ Error submitting release proof to Casper', { error });
      throw error;
    }
  }

  getStatus(): object {
    return {
      isRunning: this.isRunning,
      lastProcessedBlock: this.lastProcessedBlock,
      contract: this.config.vaultContract,
    };
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
