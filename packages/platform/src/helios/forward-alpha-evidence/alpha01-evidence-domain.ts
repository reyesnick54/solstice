/**
 * ALPHA01 — canonical forward-alpha evidence domain (decision-time discipline).
 */

import type { UtcInstant } from '@solstice/domain';

import type { AlphaEvidenceSourceKind } from './taxonomy.ts';
import type { ForwardAlphaDecisionRecord } from './types.ts';

export const HELIOS_ALPHA01_EVIDENCE_DOMAIN = 'HELIOS_ALPHA01_EVIDENCE_DOMAIN' as const;

export function assertChronologicalForwardRecord(record: ForwardAlphaDecisionRecord): void {
  if (record.knowableAt < record.recordedAt) {
    throw new Error('forward evidence: knowableAt must not precede recordedAt');
  }
  if (record.notionalMinor < 0n) {
    throw new Error('forward evidence: notionalMinor must be non-negative');
  }
}

export function isGenuineForwardSource(kind: AlphaEvidenceSourceKind): boolean {
  return kind === 'GENUINE_FORWARD_CAMPAIGN' || kind === 'REGULATED_LIVE_CAPITAL';
}

export function normalizeForwardDecisionId(strategyId: string, recordedAt: UtcInstant, seq: number): string {
  return `fwd-alpha:${strategyId}@${recordedAt}#${seq}`;
}
