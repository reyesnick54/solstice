/**
 * HELIOS MARKET DATA MD03 — feed sequence recovery taxonomy.
 */

export const FEED_RECOVERY_PHASES = [
  'INITIALIZING',
  'SYNCHRONIZED',
  'GAP_DETECTED',
  'RECOVERING',
  'SNAPSHOT_REQUIRED',
  'RESYNCHRONIZING',
  'FAILED_SAFE',
] as const;

export type FeedRecoveryPhase = (typeof FEED_RECOVERY_PHASES)[number];

export const BOOK_AUTHORITY_CLASSES = ['AUTHORITATIVE', 'NON_AUTHORITATIVE'] as const;

export type BookAuthorityClass = (typeof BOOK_AUTHORITY_CLASSES)[number];

export const SEQUENCE_ANOMALY_KINDS = [
  'MISSING_SEQUENCE',
  'DUPLICATE_SEQUENCE',
  'OUT_OF_ORDER_SEQUENCE',
  'SEQUENCE_RESET',
  'SESSION_RESET',
  'STALE_SNAPSHOT',
  'CHECKSUM_MISMATCH',
] as const;

export type SequenceAnomalyKind = (typeof SEQUENCE_ANOMALY_KINDS)[number];

export const RECOVERY_ADAPTER_KINDS = [
  'NASDAQ_SNAPSHOT_RETRANSMISSION',
  'CBOE_GAP_REQUEST',
  'CME_RECOVERY_FEED',
  'WEBSOCKET_SNAPSHOT_DELTA',
  'CHECKSUM_CRYPTO_RECOVERY',
] as const;

export type RecoveryAdapterKind = (typeof RECOVERY_ADAPTER_KINDS)[number];

export const RECOVERY_REQUEST_STATUSES = [
  'NONE',
  'PENDING',
  'IN_FLIGHT',
  'COMPLETED',
  'FAILED',
  'ABANDONED',
] as const;

export type RecoveryRequestStatus = (typeof RECOVERY_REQUEST_STATUSES)[number];

export const HELIOS_MD03 = 'HELIOS_MD03' as const;
