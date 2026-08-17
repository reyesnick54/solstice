/**
 * Four-validator SunRey development chain used by institutional custody.
 *
 * Simulation only. BFT finality here means 3 of 4 development validators
 * vote. Not production consensus. Not a second application ledger.
 */

import { createHash } from 'node:crypto';

import { sha256Hex } from '../../../security/src/hash.ts';
import { PROTOCOL_CHAIN_ID, PROTOCOL_NETWORK_ID } from '../protocol/constants.ts';
import { FOUR_VALIDATOR_LABELS } from '../validators/four-validator.ts';
import type {
  FinalizedNativeBlock,
  NativeChainTransfer,
  NativeCustodyChainPort,
  NativeQueryResult,
  NativeSubmitResult,
} from './port.ts';
import { NATIVE_CUSTODY_CHAIN_MODE } from './port.ts';

export const DEVELOPMENT_FAUCET_ADDRESS = 'sr1_dev_faucet_not_for_production';
export const DEVELOPMENT_FAUCET_SUPPLY = 1_000_000_000n;

export function custodyAddressFromPublicKey(publicKeyHex: string): string {
  return `sr1${sha256Hex(publicKeyHex).slice(0, 40)}`;
}

function blockIdFor(height: bigint, txIds: readonly string[]): string {
  return sha256Hex(`sunrey.custody.block.v1:${height}:${txIds.join(',')}`);
}

export class SimulationNativeCustodyChain implements NativeCustodyChainPort {
  readonly mode = NATIVE_CUSTODY_CHAIN_MODE;
  readonly networkId = PROTOCOL_NETWORK_ID;
  readonly chainId = PROTOCOL_CHAIN_ID;

  private readonly balances = new Map<string, bigint>([[DEVELOPMENT_FAUCET_ADDRESS, DEVELOPMENT_FAUCET_SUPPLY]]);
  private readonly mempool: NativeChainTransfer[] = [];
  private readonly unknown = new Map<string, NativeChainTransfer>();
  private readonly blocks: FinalizedNativeBlock[] = [];
  private unknownNext = false;

  addressFromPublicKey(publicKeyHex: string): string {
    return custodyAddressFromPublicKey(publicKeyHex);
  }

  holding(address: string, assetId: 'SUNREY_COIN'): bigint {
    void assetId;
    return this.balances.get(address) ?? 0n;
  }

  forceNextUnknown(): void {
    this.unknownNext = true;
  }

  submit(tx: NativeChainTransfer): NativeSubmitResult {
    if (!tx.signatureHex || !tx.signerPublicKeyHex) {
      throw new Error('unsigned transfer cannot enter the mempool');
    }
    if (this.unknownNext) {
      this.unknownNext = false;
      this.unknown.set(tx.txId, tx);
      return {
        kind: 'SUBMISSION_UNKNOWN',
        txId: tx.txId,
        reason: 'RPC/network ambiguity after possible broadcast',
      };
    }
    this.mempool.push(tx);
    return { kind: 'SUBMITTED', txId: tx.txId };
  }

  queryByTxId(txId: string): NativeQueryResult {
    for (const block of this.blocks) {
      const found = block.transactions.find((tx) => tx.txId === txId);
      if (found) {
        return { kind: 'FINALIZED', tx: found, height: block.height };
      }
    }
    const pending = this.mempool.find((tx) => tx.txId === txId);
    if (pending) {
      return { kind: 'MEMPOOL', tx: pending };
    }
    if (this.unknown.has(txId)) {
      return { kind: 'SUBMISSION_UNKNOWN', txId };
    }
    return { kind: 'NOT_FOUND' };
  }

  discoverUnknown(txId: string): NativeQueryResult {
    const hidden = this.unknown.get(txId);
    if (!hidden) {
      return this.queryByTxId(txId);
    }
    this.unknown.delete(txId);
    this.mempool.push(hidden);
    return { kind: 'MEMPOOL', tx: hidden };
  }

  finalizeNextBlock(): FinalizedNativeBlock {
    const transactions = this.mempool.splice(0, this.mempool.length);
    for (const tx of transactions) {
      this.apply(tx);
    }
    const height = BigInt(this.blocks.length + 1);
    const votes = FOUR_VALIDATOR_LABELS.slice(0, 3).map((label) => `val_dev_${label.toLowerCase()}`);
    const block: FinalizedNativeBlock = Object.freeze({
      height,
      blockId: blockIdFor(
        height,
        transactions.map((tx) => tx.txId),
      ),
      finalized: true,
      validatorVotes: Object.freeze(votes),
      transactions: Object.freeze([...transactions]),
    });
    this.blocks.push(block);
    return block;
  }

  latestFinalizedHeight(): bigint {
    return this.blocks.length === 0 ? 0n : this.blocks[this.blocks.length - 1]!.height;
  }

  getFinalizedBlock(height: bigint): FinalizedNativeBlock | null {
    return this.blocks.find((block) => block.height === height) ?? null;
  }

  listFinalizedBlocks(): readonly FinalizedNativeBlock[] {
    return [...this.blocks];
  }

  fundDevelopment(address: string, quantity: bigint): FinalizedNativeBlock {
    const faucetNonce = this.holding(DEVELOPMENT_FAUCET_ADDRESS, 'SUNREY_COIN');
    const canonical = Buffer.from(
      `faucet:${DEVELOPMENT_FAUCET_ADDRESS}:${address}:${quantity}:${this.blocks.length}`,
      'utf8',
    );
    const tx: NativeChainTransfer = Object.freeze({
      txId: sha256Hex(canonical),
      source: DEVELOPMENT_FAUCET_ADDRESS,
      destination: address,
      assetId: 'SUNREY_COIN',
      quantity,
      feeAssetId: 'SUNREY_COIN',
      maxFee: 0n,
      nonce: faucetNonce,
      networkId: this.networkId,
      chainId: this.chainId,
      canonicalBytesHex: canonical.toString('hex'),
      previewHash: sha256Hex(canonical),
      signatureHex: createHash('sha256').update('dev-faucet-sim').digest('hex'),
      signerPublicKeyHex: '00'.repeat(32),
      suiteId: 'sunrey-ed25519-v1',
    });
    this.mempool.push(tx);
    return this.finalizeNextBlock();
  }

  private apply(tx: NativeChainTransfer): void {
    const source = this.balances.get(tx.source) ?? 0n;
    if (source < tx.quantity + tx.maxFee) {
      throw new Error(`insufficient on-chain holding at ${tx.source}`);
    }
    this.balances.set(tx.source, source - tx.quantity - tx.maxFee);
    this.balances.set(tx.destination, (this.balances.get(tx.destination) ?? 0n) + tx.quantity);
  }
}
