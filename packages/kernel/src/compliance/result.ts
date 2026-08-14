import type { UtcInstant } from '../../../domain/src/time.ts';
import type { ScreeningOutcome, ScreeningType, SubjectKind } from './types.ts';

/**
 * Canonical screening result. Business logic consumes this type, never a
 * vendor payload. Score/confidence are informational and cannot authorize
 * financial execution.
 */
export type ScreeningResult = {
  readonly screeningId: string;
  readonly screeningType: ScreeningType;
  readonly subjectKind: SubjectKind;
  readonly subjectRef: string;
  readonly providerRef: string;
  readonly providerModel: string | null;
  readonly outcome: ScreeningOutcome;
  readonly reasonCodes: readonly string[];
  readonly confidence: number | null;
  readonly score: number | null;
  readonly jurisdiction: string;
  readonly screenedAt: UtcInstant;
  readonly refreshBy: UtcInstant;
  readonly evidenceRefs: readonly string[];
  readonly providerHash: string;
  readonly policyVersionId: string | null;
};

export type AdverseMediaReference = {
  readonly category: string;
  readonly providerResultId: string;
  readonly riskClassification: 'LOW' | 'STANDARD' | 'ELEVATED' | 'HIGH';
  readonly observedAt: UtcInstant;
  readonly reviewRequired: boolean;
  readonly contentHash: string;
};

export function isStale(result: ScreeningResult, now: UtcInstant): boolean {
  return now >= result.refreshBy;
}

export function assertScreeningDated(result: ScreeningResult): void {
  if (!result.screenedAt || !result.refreshBy || !result.providerRef) {
    throw new Error('screening result is missing version/timestamp fields');
  }
}
