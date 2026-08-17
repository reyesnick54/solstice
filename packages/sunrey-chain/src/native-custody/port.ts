/**
 * Native-chain port consumed by institutional custody.
 *
 * Canonical native-asset quantity lives on SunRey Blockchain.
 * This port is not a second mutable asset ledger.
 */

export const NATIVE_CUSTODY_CHAIN_MODE = 'SIMULATION_ONLY' as const;

export type NativeChainTxStatus =
  | 'MEMPOOL'
  | 'FINALIZED'
  | 'SUBMISSION_UNKNOWN'
  | 'UNKNOWN'
  | 'NOT_FOUND';

export type NativeChainTransfer = {
  readonly txId: string;
  readonly source: string;
  readonly destination: string;
  readonly assetId: 'SUNREY_COIN';
  readonly quantity: bigint;
  readonly feeAssetId: 'SUNREY_COIN';
  readonly maxFee: bigint;
  readonly nonce: bigint;
  readonly networkId: string;
  readonly chainId: string;
  readonly canonicalBytesHex: string;
  readonly previewHash: string;
  readonly signatureHex: string | null;
  readonly signerPublicKeyHex: string | null;
  readonly suiteId: string;
};

export type FinalizedNativeBlock = {
  readonly height: bigint;
  readonly blockId: string;
  readonly finalized: true;
  readonly validatorVotes: readonly string[];
  readonly transactions: readonly NativeChainTransfer[];
};

export type NativeSubmitResult =
  | { readonly kind: 'SUBMITTED'; readonly txId: string }
  | { readonly kind: 'SUBMISSION_UNKNOWN'; readonly txId: string; readonly reason: string };

export type NativeQueryResult =
  | { readonly kind: 'FINALIZED'; readonly tx: NativeChainTransfer; readonly height: bigint }
  | { readonly kind: 'MEMPOOL'; readonly tx: NativeChainTransfer }
  | { readonly kind: 'SUBMISSION_UNKNOWN'; readonly txId: string }
  | { readonly kind: 'UNKNOWN' }
  | { readonly kind: 'NOT_FOUND' };

export type NativeCustodyChainPort = {
  readonly mode: typeof NATIVE_CUSTODY_CHAIN_MODE;
  readonly networkId: string;
  readonly chainId: string;
  addressFromPublicKey(publicKeyHex: string): string;
  holding(address: string, assetId: 'SUNREY_COIN'): bigint;
  submit(tx: NativeChainTransfer): NativeSubmitResult;
  queryByTxId(txId: string): NativeQueryResult;
  discoverUnknown(txId: string): NativeQueryResult;
  finalizeNextBlock(): FinalizedNativeBlock;
  latestFinalizedHeight(): bigint;
  getFinalizedBlock(height: bigint): FinalizedNativeBlock | null;
  listFinalizedBlocks(): readonly FinalizedNativeBlock[];
  fundDevelopment(address: string, quantity: bigint): FinalizedNativeBlock;
};
