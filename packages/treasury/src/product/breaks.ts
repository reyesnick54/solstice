import type { UtcInstant } from '../../../domain/src/time.ts';
import type { ReconciliationBreakId } from '../ids.ts';
import type { ReconciliationConclusion } from './reconciliation-engine.ts';
import type { SettlementDomain } from './settlement.ts';

export const BREAK_SEVERITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;
export type BreakSeverity = (typeof BREAK_SEVERITIES)[number];

export const BREAK_STATUSES = [
  'OPEN',
  'INVESTIGATING',
  'RESOLVED',
  'ACCEPTED_TIMING_DIFFERENCE',
  'ESCALATED',
] as const;
export type BreakStatus = (typeof BREAK_STATUSES)[number];

export type ReconciliationBreak = {
  readonly breakId: ReconciliationBreakId;
  readonly runId: string;
  readonly type: ReconciliationConclusion;
  readonly severity: BreakSeverity;
  readonly domain: SettlementDomain | 'TREASURY';
  readonly amountMinor: bigint | null;
  readonly currency: string | null;
  readonly provider: string;
  readonly internalReferences: readonly string[];
  readonly externalReferences: readonly string[];
  readonly status: BreakStatus;
  readonly owner: string | null;
  readonly createdAt: UtcInstant;
  readonly resolvedAt: UtcInstant | null;
  readonly resolutionEvidence: string | null;
};

export function severityForConclusion(type: ReconciliationConclusion): BreakSeverity {
  switch (type) {
    case 'AMOUNT_MISMATCH':
    case 'CURRENCY_MISMATCH':
    case 'DUPLICATE_EXTERNAL_RECORD':
      return 'HIGH';
    case 'MISSING_INTERNAL_RECORD':
    case 'MISSING_EXTERNAL_RECORD':
      return 'CRITICAL';
    case 'TIMING_DIFFERENCE':
      return 'MEDIUM';
    case 'UNMATCHED':
    case 'UNKNOWN':
      return 'HIGH';
    case 'MATCHED':
      return 'LOW';
    default:
      return 'HIGH';
  }
}

export function freezeReconciliationBreak(input: ReconciliationBreak): ReconciliationBreak {
  return Object.freeze({
    ...input,
    internalReferences: Object.freeze([...input.internalReferences]),
    externalReferences: Object.freeze([...input.externalReferences]),
  });
}

export function withBreakStatus(
  row: ReconciliationBreak,
  status: BreakStatus,
  now: UtcInstant,
  resolutionEvidence: string | null = null,
): ReconciliationBreak {
  const resolved =
    status === 'RESOLVED' || status === 'ACCEPTED_TIMING_DIFFERENCE' ? now : row.resolvedAt;
  return freezeReconciliationBreak({
    ...row,
    status,
    resolvedAt: resolved,
    resolutionEvidence: resolutionEvidence ?? row.resolutionEvidence,
  });
}
