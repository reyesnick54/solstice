import { SEARCH_MAX_QUERY_BYTES, SEARCH_MAX_RESULTS } from './taxonomy.ts';
import type { CanonicalProjection, SearchHit } from './types.ts';

const ALLOWED = /^[A-Za-z0-9_.:-]+$/;
const SQL_FORBIDDEN = /(\b(select|insert|update|delete|drop|union|or|and)\b)|(['";\\])|(\/\*)|(--)/i;

export type SearchError = {
  readonly code: 'QUERY_REJECTED';
  readonly message: string;
};

export function sanitizeSearchQuery(raw: string): { readonly ok: true; readonly query: string } | SearchError {
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return { code: 'QUERY_REJECTED', message: 'empty query' };
  }
  if (Buffer.byteLength(trimmed, 'utf8') > SEARCH_MAX_QUERY_BYTES) {
    return { code: 'QUERY_REJECTED', message: 'query exceeds bound' };
  }
  if (SQL_FORBIDDEN.test(trimmed) || !ALLOWED.test(trimmed)) {
    return { code: 'QUERY_REJECTED', message: 'query is not a bounded identifier' };
  }
  return { ok: true, query: trimmed };
}

export function searchProjection(projection: CanonicalProjection, raw: string): SearchHit[] | SearchError {
  const sanitized = sanitizeSearchQuery(raw);
  if (!('ok' in sanitized)) {
    return sanitized;
  }
  const query = sanitized.query;
  const hits: SearchHit[] = [];
  const height = /^\d+$/.test(query) ? Number.parseInt(query, 10) : null;

  if (height !== null) {
    const block = projection.blocks.find((row) => row.height === height);
    if (block) {
      hits.push({ kind: 'BLOCK', id: String(block.height), label: block.blockId });
    }
  }

  pushExact(hits, 'BLOCK', projection.blocks, (row) => row.blockId, query, (row) => `height ${row.height}`);
  pushExact(hits, 'TRANSACTION', projection.transactions, (row) => row.transactionId, query, (row) => row.type);
  pushExact(hits, 'ACCOUNT', projection.accounts, (row) => row.address, query, (row) => row.accountClass);
  pushExact(hits, 'ASSET', projection.assets, (row) => row.assetId, query, (row) => row.displayName);
  pushExact(hits, 'ASSET', projection.assets, (row) => row.internalAssetId, query, (row) => row.displayName);
  pushExact(hits, 'VALIDATOR', projection.validators, (row) => row.validatorId, query, (row) => row.status);
  pushExact(hits, 'ORACLE_FACT', projection.oracleFacts, (row) => row.factId, query, (row) => row.factType);
  pushExact(hits, 'PRODUCTIVE_OBJECT', projection.productiveObjects, (row) => row.objectId, query, (row) => row.category);
  pushExact(hits, 'MOONREY_ISSUANCE', projection.moonrey, (row) => row.issuanceId, query, (row) => row.productiveCategory);
  pushExact(hits, 'INTEROP_PACKET', projection.interopPackets, (row) => row.packetId, query, (row) => row.lifecycle);
  pushExact(hits, 'GOVERNANCE', projection.governance, (row) => row.proposalId, query, (row) => row.upgradeKind);
  pushExact(hits, 'EXCHANGE_SETTLEMENT', projection.settlements, (row) => row.settlementId, query, (row) => row.instrument);

  return hits.slice(0, SEARCH_MAX_RESULTS);
}

function pushExact<T>(
  hits: SearchHit[],
  kind: SearchHit['kind'],
  rows: readonly T[],
  idOf: (row: T) => string,
  query: string,
  labelOf: (row: T) => string,
): void {
  for (const row of rows) {
    if (idOf(row) === query) {
      hits.push({ kind, id: idOf(row), label: labelOf(row) });
    }
  }
}
