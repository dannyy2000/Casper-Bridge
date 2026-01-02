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
  private pendingDeploys: Set<string> = new Set(); // Track submitted deploys

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

  // Add a deploy to track
  trackDeploy(deployHash: string): void {
    this.pendingDeploys.add(deployHash);
    logger.info('Tracking new deploy', { deployHash: deployHash.substring(0, 16) + '...' });
  }

  private async checkPendingDeploys(): Promise<void> {
    if (this.pendingDeploys.size === 0) {
      return;
    }

    logger.info(`Checking ${this.pendingDeploys.size} pending deploys...`);

    for (const deployHash of this.pendingDeploys) {
      try {
        logger.info('Querying deploy...', { deployHash: deployHash.substring(0, 16) + '...' });
        const [deploy, deployResult] = await this.casperClient.getDeploy(deployHash);

        logger.info('Deploy result received', {
          deployHash: deployHash.substring(0, 16) + '...',
          hasExecutionResults: !!deployResult?.execution_results?.[0],
          executionResultCount: deployResult?.execution_results?.length || 0,
          keys: Object.keys(deployResult || {}),
        });

        // Check if executed - handle both Casper 2.0 (execution_info) and Legacy (execution_results)
        let executionResult;

        if ((deployResult as any).execution_info?.execution_result) {
          executionResult = (deployResult as any).execution_info.execution_result;
        } else if (deployResult.execution_results?.[0]?.result) {
          executionResult = deployResult.execution_results[0].result;
        } else {
          logger.info('Deploy not executed yet, will check again next cycle', {
            deployHash: deployHash.substring(0, 16) + '...',
          });
          continue; // Not executed yet
        }

        // Check if successful - handle both Version2 (Casper 2.0) and legacy formats
        let isSuccess = false;
        let errorMessage = null;

        if ((executionResult as any).Version2) {
          // Casper 2.0 format: success if error_message is null
          const v2Result = (executionResult as any).Version2;
          isSuccess = v2Result.error_message === null;
          errorMessage = v2Result.error_message;
        } else if (executionResult.Success) {
          // Legacy format
          isSuccess = true;
        } else if (executionResult.Failure) {
          isSuccess = false;
          errorMessage = executionResult.Failure?.error_message;
        }

        if (!isSuccess) {
          logger.warn('Deploy failed', {
            deployHash: deployHash.substring(0, 16),
            error: errorMessage,
          });
          this.pendingDeploys.delete(deployHash);
          continue;
        }

        logger.info('✅ Deploy executed successfully!', {
          deployHash: deployHash.substring(0, 16) + '...',
        });

        // Parse lock event from execution
        const lockEvent = this.parseLockEventFromDeploy(deploy, deployHash);

        if (lockEvent) {
          logger.info('🔒 Detected lock event!', { lockEvent });

          // Emit event for minting
          this.emit('AssetLocked', lockEvent);

          // Mark as processed
          this.processedDeploys.add(deployHash);
          this.pendingDeploys.delete(deployHash);
        } else {
          // Not a lock event, just remove from pending
          this.pendingDeploys.delete(deployHash);
        }
      } catch (error: any) {
        // Deploy not found yet or other error
        if (error.message === 'No such deploy') {
          logger.info('Deploy not found in node yet, will retry', {
            deployHash: deployHash.substring(0, 16) + '...',
          });
        } else {
          logger.error('Error checking pending deploy', {
            deployHash: deployHash.substring(0, 16) + '...',
            error: error.message,
            stack: error.stack,
          });
        }
      }
    }
  }

  private parseLockEventFromDeploy(deploy: any, deployHash: string): any | null {
    try {
      // Check if this is a lock_cspr call
      const session = deploy?.session;
      if (!(session as any)?.StoredContractByHash) {
        return null;
      }

      const contractHash = (session as any).StoredContractByHash.hash;
      const entryPoint = (session as any).StoredContractByHash.entry_point;

      // Check if it's our vault contract and lock_cspr entry point
      if (contractHash !== this.config.vaultContract.replace('hash-', '') || entryPoint !== 'lock_cspr') {
        return null;
      }

      // Parse args
      const args = (session as any).StoredContractByHash.args;
      if (!args) return null;

      let destinationChain = '';
      let destinationAddress = '';
      let amount = '';

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

      // Generate nonce from deploy hash (first 8 chars as hex)
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
      logger.error('Error parsing lock event from deploy', {
        error: error.message,
      });
      return null;
    }
  }

  private async pollEvents(): Promise<void> {
    while (this.isRunning) {
      try {
        // Get latest block to check for executed deploys
        const latestBlock = await this.casperClient.nodeClient.getLatestBlockInfo();

        if (latestBlock?.block?.hash) {
          await this.checkBlockForLockEvents(latestBlock.block.hash);
        }

        // Check pending deploys that were submitted directly
        await this.checkPendingDeploys();

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
      // CRITICAL: Convert from Ethereum decimals (18) to Casper decimals (9)
      // 1 wCSPR = 1,000,000,000,000,000,000 wei (18 decimals)
      // 1 CSPR = 1,000,000,000 motes (9 decimals)
      // Therefore: amountInMotes = amountInWei / 10^9
      const amountInWei = BigInt(burnEvent.amount);
      const amountInMotes = amountInWei / BigInt(1_000_000_000); // Divide by 10^9

      // STEP 1: Create message (MUST match contract's get_message_hash)
      // IMPORTANT: Use the converted amount in motes for the signature
      const message = this.signer.createMessage(
        'ethereum',                         // sourceChain
        burnEvent.txHash || '0x0',          // sourceTxHash
        amountInMotes.toString(),           // amount in MOTES (9 decimals)
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
        amountInWei: burnEvent.amount,
        amountInMotes: amountInMotes.toString(),
      });

      // STEP 3: Create proof with signature
      const proof = {
        source_chain: 'ethereum',
        source_tx_hash: burnEvent.txHash || '0x0',
        amount: amountInMotes.toString(),
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
      logger.info('📝 Proof ready for Casper submission', { proof });

      const { DeployUtil, CLValueBuilder, CLPublicKey, RuntimeArgs } = require('casper-js-sdk');

      // Prepare runtime args for release_cspr
      const runtimeArgs = RuntimeArgs.fromMap({
        source_chain: CLValueBuilder.string(proof.source_chain),
        source_tx_hash: CLValueBuilder.string(proof.source_tx_hash),
        amount: CLValueBuilder.u512(proof.amount),
        recipient: CLValueBuilder.string(proof.recipient),
        nonce: CLValueBuilder.u64(proof.nonce),
        validator_public_keys: CLValueBuilder.list([
          CLValueBuilder.byteArray(Buffer.from(proof.validator_signatures[0].public_key))
        ]),
        validator_signatures: CLValueBuilder.list([
          CLValueBuilder.byteArray(Buffer.from(proof.validator_signatures[0].signature))
        ]),
      });

      // Create deploy to call release_cspr entry point
      const deployParams = new DeployUtil.DeployParams(
        this.signer.getPublicKeyCL(),
        this.config.networkName,
        1, // gasPrice - use 1 for testnet
        1800000 // ttl - 30 minutes
      );

      // Use system contract for payment
      const payment = DeployUtil.ExecutableDeployItem.newModuleBytes(
        Uint8Array.from([]), // Empty module bytes triggers system contract
        RuntimeArgs.fromMap({
          amount: CLValueBuilder.u512(3_000_000_000) // 3 CSPR gas
        })
      );

      const session = DeployUtil.ExecutableDeployItem.newStoredContractByHash(
        Uint8Array.from(Buffer.from(this.config.vaultContract.replace('hash-', ''), 'hex')),
        'release_cspr',
        runtimeArgs
      );

      const deploy = DeployUtil.makeDeploy(deployParams, session, payment);

      // Sign the deploy
      const signedDeploy = DeployUtil.signDeploy(deploy, this.signer.getKeyPair());

      // Submit to Casper network
      const deployHash = await this.casperClient.putDeploy(signedDeploy);

      logger.info('✅ Release transaction submitted to Casper', {
        deployHash,
        explorerUrl: `https://testnet.cspr.live/deploy/${deployHash}`
      });
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
