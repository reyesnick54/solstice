import { type Brand, brandAs } from './brand.ts';
import type { UtcInstant } from './time.ts';

/**
 * Opaque identifier for a canonical SunRey chain transaction.
 * Operational records reference chain objects; they do not duplicate supply authority.
 */
export type ChainTransactionId = Brand<string, 'ChainTransactionId'>;

export function asChainTransactionId(value: string): ChainTransactionId {
  if (value.length === 0) {
    throw new TypeError('ChainTransactionId must be a non-empty string');
  }
  return brandAs<string, 'ChainTransactionId'>(value);
}

export type ChainId = Brand<string, 'ChainId'>;

export function asChainId(value: string): ChainId {
  if (value.length === 0) {
    throw new TypeError('ChainId must be a non-empty string');
  }
  return brandAs<string, 'ChainId'>(value);
}

export type EconomicClaimId = Brand<string, 'EconomicClaimId'>;

export function asEconomicClaimId(value: string): EconomicClaimId {
  if (value.length === 0) {
    throw new TypeError('EconomicClaimId must be a non-empty string');
  }
  return brandAs<string, 'EconomicClaimId'>(value);
}

export type EconomicReceiptId = Brand<string, 'EconomicReceiptId'>;

export function asEconomicReceiptId(value: string): EconomicReceiptId {
  if (value.length === 0) {
    throw new TypeError('EconomicReceiptId must be a non-empty string');
  }
  return brandAs<string, 'EconomicReceiptId'>(value);
}

export type MonetaryStateRoot = Brand<string, 'MonetaryStateRoot'>;

export function asMonetaryStateRoot(value: string): MonetaryStateRoot {
  if (value.length === 0) {
    throw new TypeError('MonetaryStateRoot must be a non-empty string');
  }
  return brandAs<string, 'MonetaryStateRoot'>(value);
}

export type BlockHash = Brand<string, 'BlockHash'>;

export function asBlockHash(value: string): BlockHash {
  if (value.length === 0) {
    throw new TypeError('BlockHash must be a non-empty string');
  }
  return brandAs<string, 'BlockHash'>(value);
}

/**
 * Canonical reference to finalized sovereign blockchain state.
 * Attached to operational records (ledger journals, wallet projections, exchange
 * settlements, issuance receipts) for traceability — never as writable supply truth.
 */
export type CanonicalBlockchainReference = {
  readonly chainId: ChainId;
  readonly transactionId: ChainTransactionId;
  readonly finalizedBlockHeight: number;
  readonly finalizedBlockHash: BlockHash;
  readonly monetaryStateRoot: MonetaryStateRoot;
  readonly economicClaimId: EconomicClaimId | null;
  readonly economicReceiptId: EconomicReceiptId | null;
  readonly finalizedAt: UtcInstant;
};

export function freezeCanonicalBlockchainReference(
  reference: CanonicalBlockchainReference,
): CanonicalBlockchainReference {
  if (!Number.isInteger(reference.finalizedBlockHeight) || reference.finalizedBlockHeight < 0) {
    throw new TypeError('finalizedBlockHeight must be a non-negative integer');
  }
  return Object.freeze({ ...reference });
}

export function isCanonicalBlockchainReference(value: unknown): value is CanonicalBlockchainReference {
  if (value === null || typeof value !== 'object') {
    return false;
  }
  const record = value as Record<string, unknown>;
  return (
    typeof record.chainId === 'string' &&
    typeof record.transactionId === 'string' &&
    typeof record.finalizedBlockHeight === 'number' &&
    typeof record.finalizedBlockHash === 'string' &&
    typeof record.monetaryStateRoot === 'string' &&
    typeof record.finalizedAt === 'string' &&
    (record.economicClaimId === null || typeof record.economicClaimId === 'string') &&
    (record.economicReceiptId === null || typeof record.economicReceiptId === 'string')
  );
}
