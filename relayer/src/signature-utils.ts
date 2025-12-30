/**
 * Signature Utilities
 *
 * Handles cryptographic signing for cross-chain proofs:
 * - ECDSA signatures for Ethereum (using ethers)
 * - Ed25519 signatures for Casper (using @noble/ed25519)
 */

import { ethers } from 'ethers';
import * as ed25519 from '@noble/ed25519';
import { sha512 } from '@noble/hashes/sha512';
import { Logger } from './logger';

// Setup sha512 for ed25519 (required in Node.js)
ed25519.etc.sha512Sync = (...m) => sha512(ed25519.etc.concatBytes(...m));

const logger = Logger.getInstance();

/**
 * Ethereum Signature Generation (ECDSA)
 *
 * WHY: Ethereum uses ECDSA (Elliptic Curve Digital Signature Algorithm)
 * The contract will recover the signer's address from the signature
 */
export class EthereumSigner {
  private wallet: ethers.Wallet;

  constructor(privateKey: string) {
    this.wallet = new ethers.Wallet(privateKey);
    logger.info('Ethereum signer initialized', {
      address: this.wallet.address
    });
  }

  /**
   * Create message hash for Ethereum signatures
   * MUST match the contract's _getMessageHash function!
   *
   * Contract format: keccak256(sourceChain, sourceTxHash, amount, recipient, nonce)
   */
  createMessageHash(
    sourceChain: string,
    sourceTxHash: string,
    amount: string,
    recipient: string,
    nonce: string
  ): string {
    // Use ethers.solidityPackedKeccak256 to match Solidity's abi.encodePacked + keccak256
    const hash = ethers.solidityPackedKeccak256(
      ['string', 'string', 'uint256', 'address', 'uint256'],
      [sourceChain, sourceTxHash, amount, recipient, nonce]
    );

    logger.debug('Created Ethereum message hash', {
      sourceChain,
      sourceTxHash,
      amount,
      recipient,
      nonce,
      hash
    });

    return hash;
  }

  /**
   * Sign a message hash
   * Returns signature as bytes (for contract verification)
   */
  async signMessage(messageHash: string): Promise<string> {
    // The wallet will add the Ethereum signed message prefix automatically
    // This matches MessageHashUtils.toEthSignedMessageHash in the contract
    const signature = await this.wallet.signMessage(ethers.getBytes(messageHash));

    logger.debug('Created Ethereum signature', {
      messageHash,
      signature,
      signer: this.wallet.address
    });

    return signature;
  }

  /**
   * Get signer's address (validator address)
   */
  getAddress(): string {
    return this.wallet.address;
  }
}

/**
 * Casper Signature Generation (Ed25519)
 *
 * WHY: Casper uses Ed25519 signatures (different from Ethereum)
 * The contract will verify using ed25519-dalek in Rust
 */
export class CasperSigner {
  private privateKey: Uint8Array;
  private publicKey: Uint8Array;

  constructor(privateKeyHex: string) {
    // Convert hex private key to Uint8Array
    this.privateKey = this.hexToBytes(privateKeyHex);

    // Derive public key from private key
    this.publicKey = ed25519.getPublicKey(this.privateKey);

    logger.info('Casper signer initialized', {
      publicKey: this.bytesToHex(this.publicKey)
    });
  }

  /**
   * Create message for Casper signatures
   * MUST match the contract's get_message_hash function!
   *
   * Contract format: "{sourceChain}|{sourceTxHash}|{amount}|{nonce}" + debug-formatted recipient
   */
  createMessage(
    sourceChain: string,
    sourceTxHash: string,
    amount: string,
    recipient: string,
    nonce: string
  ): Uint8Array {
    // Match the Rust contract format
    const message = `${sourceChain}|${sourceTxHash}|${amount}|${nonce}`;

    // Convert to bytes
    let messageBytes = new TextEncoder().encode(message);

    // Append recipient (in Rust, we use Debug format - for now just append as-is)
    const recipientBytes = new TextEncoder().encode(recipient);
    const combined = new Uint8Array(messageBytes.length + recipientBytes.length);
    combined.set(messageBytes, 0);
    combined.set(recipientBytes, messageBytes.length);

    logger.debug('Created Casper message', {
      sourceChain,
      sourceTxHash,
      amount,
      recipient,
      nonce,
      messageHex: this.bytesToHex(combined)
    });

    return combined;
  }

  /**
   * Sign a message
   * Returns Ed25519 signature (64 bytes)
   */
  async signMessage(message: Uint8Array): Promise<Uint8Array> {
    const signature = await ed25519.sign(message, this.privateKey);

    logger.debug('Created Casper signature', {
      messageHex: this.bytesToHex(message),
      signatureHex: this.bytesToHex(signature),
      publicKey: this.bytesToHex(this.publicKey)
    });

    return signature;
  }

  /**
   * Get signer's public key (32 bytes)
   */
  getPublicKey(): Uint8Array {
    return this.publicKey;
  }

  /**
   * Get public key as hex string
   */
  getPublicKeyHex(): string {
    return this.bytesToHex(this.publicKey);
  }

  // Helper functions
  private hexToBytes(hex: string): Uint8Array {
    // Remove 0x prefix if present
    hex = hex.replace(/^0x/, '');
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) {
      bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
    }
    return bytes;
  }

  private bytesToHex(bytes: Uint8Array): string {
    return '0x' + Array.from(bytes)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }
}

/**
 * Example usage:
 *
 * // For Ethereum (ECDSA):
 * const ethSigner = new EthereumSigner(process.env.ETHEREUM_PRIVATE_KEY!);
 * const hash = ethSigner.createMessageHash('casper', '0xabc...', '1000000', '0x123...', '42');
 * const signature = await ethSigner.signMessage(hash);
 *
 * // For Casper (Ed25519):
 * const casperSigner = new CasperSigner(process.env.CASPER_PRIVATE_KEY_HEX!);
 * const message = casperSigner.createMessage('ethereum', '0xdef...', '1000000', 'account-hash-...', '42');
 * const signature = await casperSigner.signMessage(message);
 */
