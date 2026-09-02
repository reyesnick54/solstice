import type { Pool } from 'pg';

import {
  asBlockHash,
  asChainId,
  asChainTransactionId,
  asEconomicClaimId,
  asEconomicReceiptId,
  asMonetaryStateRoot,
  freezeCanonicalBlockchainReference,
  type CanonicalBlockchainReference,
} from '../../../domain/src/blockchain-reference.ts';
import {
  asProductReconciliationLinkId,
  freezeProductReconciliationLink,
  type ProductReconciliationLink,
  type ProductReconciliationSourceKind,
} from '../../../domain/src/product-reconciliation-link.ts';
import { asUtcInstant } from '../../../domain/src/time.ts';
import { withClient } from '../postgres/pools.ts';

function canonicalJson(value: unknown): string {
  return JSON.stringify(value);
}

export async function insertChainReferenceAnchor(
  pool: Pool,
  link: ProductReconciliationLink,
): Promise<void> {
  if (!link.chainReference) {
    throw new Error('chain reference anchor requires a chainReference');
  }
  const ref = link.chainReference;
  await withClient(pool, async (client) => {
    await client.query(
      `INSERT INTO ledger.chain_reference_anchor
         (anchor_id, source_kind, source_id, journal_id, chain_id, transaction_id,
          finalized_block_height, finalized_block_hash, monetary_state_root,
          economic_claim_id, economic_receipt_id, correlation_id, finalized_at,
          created_at, body_canonical)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
       ON CONFLICT (source_kind, source_id) DO NOTHING`,
      [
        link.linkId,
        link.sourceKind,
        link.sourceId,
        link.journalId,
        ref.chainId,
        ref.transactionId,
        ref.finalizedBlockHeight,
        ref.finalizedBlockHash,
        ref.monetaryStateRoot,
        ref.economicClaimId,
        ref.economicReceiptId,
        link.correlationId,
        ref.finalizedAt,
        link.createdAt,
        canonicalJson(link),
      ],
    );
  });
}

export async function loadChainReferenceAnchor(
  pool: Pool,
  sourceKind: ProductReconciliationSourceKind,
  sourceId: string,
): Promise<ProductReconciliationLink | null> {
  const result = await pool.query<{
    anchor_id: string;
    source_kind: ProductReconciliationSourceKind;
    source_id: string;
    journal_id: string | null;
    chain_id: string;
    transaction_id: string;
    finalized_block_height: number;
    finalized_block_hash: string;
    monetary_state_root: string;
    economic_claim_id: string | null;
    economic_receipt_id: string | null;
    correlation_id: string | null;
    finalized_at: Date;
    created_at: Date;
  }>(
    `SELECT anchor_id, source_kind, source_id, journal_id, chain_id, transaction_id,
            finalized_block_height, finalized_block_hash, monetary_state_root,
            economic_claim_id, economic_receipt_id, correlation_id, finalized_at, created_at
       FROM ledger.chain_reference_anchor
      WHERE source_kind = $1 AND source_id = $2`,
    [sourceKind, sourceId],
  );
  const row = result.rows[0];
  if (!row) {
    return null;
  }
  const chainReference = freezeCanonicalBlockchainReference({
    chainId: asChainId(row.chain_id),
    transactionId: asChainTransactionId(row.transaction_id),
    finalizedBlockHeight: row.finalized_block_height,
    finalizedBlockHash: asBlockHash(row.finalized_block_hash),
    monetaryStateRoot: asMonetaryStateRoot(row.monetary_state_root),
    economicClaimId: row.economic_claim_id ? asEconomicClaimId(row.economic_claim_id) : null,
    economicReceiptId: row.economic_receipt_id ? asEconomicReceiptId(row.economic_receipt_id) : null,
    finalizedAt: asUtcInstant(row.finalized_at.toISOString()),
  });
  return freezeProductReconciliationLink({
    linkId: asProductReconciliationLinkId(row.anchor_id),
    sourceKind: row.source_kind,
    sourceId: row.source_id,
    journalId: row.journal_id,
    chainReference,
    correlationId: row.correlation_id,
    createdAt: asUtcInstant(row.created_at.toISOString()),
  });
}

export async function loadChainReferenceAnchorsByJournal(
  pool: Pool,
  journalId: string,
): Promise<readonly ProductReconciliationLink[]> {
  const result = await pool.query<{
    anchor_id: string;
    source_kind: ProductReconciliationSourceKind;
    source_id: string;
    journal_id: string | null;
    chain_id: string;
    transaction_id: string;
    finalized_block_height: number;
    finalized_block_hash: string;
    monetary_state_root: string;
    economic_claim_id: string | null;
    economic_receipt_id: string | null;
    correlation_id: string | null;
    finalized_at: Date;
    created_at: Date;
  }>(
    `SELECT anchor_id, source_kind, source_id, journal_id, chain_id, transaction_id,
            finalized_block_height, finalized_block_hash, monetary_state_root,
            economic_claim_id, economic_receipt_id, correlation_id, finalized_at, created_at
       FROM ledger.chain_reference_anchor
      WHERE journal_id = $1
      ORDER BY created_at`,
    [journalId],
  );
  return Object.freeze(
    result.rows.map((row) => {
      const chainReference = freezeCanonicalBlockchainReference({
        chainId: asChainId(row.chain_id),
        transactionId: asChainTransactionId(row.transaction_id),
        finalizedBlockHeight: row.finalized_block_height,
        finalizedBlockHash: asBlockHash(row.finalized_block_hash),
        monetaryStateRoot: asMonetaryStateRoot(row.monetary_state_root),
        economicClaimId: row.economic_claim_id ? asEconomicClaimId(row.economic_claim_id) : null,
        economicReceiptId: row.economic_receipt_id ? asEconomicReceiptId(row.economic_receipt_id) : null,
        finalizedAt: asUtcInstant(row.finalized_at.toISOString()),
      });
      return freezeProductReconciliationLink({
        linkId: asProductReconciliationLinkId(row.anchor_id),
        sourceKind: row.source_kind,
        sourceId: row.source_id,
        journalId: row.journal_id,
        chainReference,
        correlationId: row.correlation_id,
        createdAt: asUtcInstant(row.created_at.toISOString()),
      });
    }),
  );
}

export type { CanonicalBlockchainReference, ProductReconciliationLink };
