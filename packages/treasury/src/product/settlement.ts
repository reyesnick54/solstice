import type { UtcInstant } from '../../../domain/src/time.ts';
import type { SettlementRecordId } from '../ids.ts';

export const SETTLEMENT_DOMAINS = ['PAYMENTS', 'CARDS', 'FX', 'CUSTODY', 'EXCHANGE'] as const;
export type SettlementDomain = (typeof SETTLEMENT_DOMAINS)[number];

export const SETTLEMENT_RECORD_STATUSES = [
  'EXPECTED',
  'SUBMITTED',
  'SETTLED',
  'FAILED',
  'OVERDUE',
  'PARTIAL',
] as const;
export type SettlementRecordStatus = (typeof SETTLEMENT_RECORD_STATUSES)[number];

export type SettlementRecord = {
  readonly settlementId: SettlementRecordId;
  readonly domain: SettlementDomain;
  readonly provider: string;
  readonly currency: string;
  readonly grossMinor: bigint;
  readonly feesMinor: bigint;
  readonly netMinor: bigint;
  readonly expectedDate: UtcInstant;
  readonly actualDate: UtcInstant | null;
  readonly status: SettlementRecordStatus;
  readonly providerReferences: readonly string[];
  readonly ledgerReferences: readonly string[];
};

export function freezeSettlementRecord(input: SettlementRecord): SettlementRecord {
  if (input.netMinor !== input.grossMinor - input.feesMinor) {
    throw new Error('settlement net must equal gross minus fees');
  }
  return Object.freeze({
    ...input,
    providerReferences: Object.freeze([...input.providerReferences]),
    ledgerReferences: Object.freeze([...input.ledgerReferences]),
  });
}
