import { type Brand, brandAs } from './brand.ts';
import type { UtcInstant } from './time.ts';
import type { CanonicalBlockchainReference } from './blockchain-reference.ts';

export type ProductReconciliationLinkId = Brand<string, 'ProductReconciliationLinkId'>;

export function asProductReconciliationLinkId(value: string): ProductReconciliationLinkId {
  if (value.length === 0) {
    throw new TypeError('ProductReconciliationLinkId must be a non-empty string');
  }
  return brandAs<string, 'ProductReconciliationLinkId'>(value);
}

export const PRODUCT_RECONCILIATION_SOURCE_KINDS = [
  'LEDGER_JOURNAL',
  'WALLET_PROJECTION',
  'EXCHANGE_SETTLEMENT',
  'SUNREY_ISSUANCE_RECEIPT',
  'MOONREY_ISSUANCE_RECEIPT',
  'CUSTODY_MOVEMENT',
  'OPERATION_EXECUTION',
] as const;

export type ProductReconciliationSourceKind = (typeof PRODUCT_RECONCILIATION_SOURCE_KINDS)[number];

/**
 * Traceability link from a downstream operational representation to its
 * authoritative chain and/or ledger anchors. Read-only audit artifact.
 */
export type ProductReconciliationLink = {
  readonly linkId: ProductReconciliationLinkId;
  readonly sourceKind: ProductReconciliationSourceKind;
  readonly sourceId: string;
  readonly journalId: string | null;
  readonly chainReference: CanonicalBlockchainReference | null;
  readonly correlationId: string | null;
  readonly createdAt: UtcInstant;
};

export function freezeProductReconciliationLink(link: ProductReconciliationLink): ProductReconciliationLink {
  return Object.freeze({ ...link });
}
