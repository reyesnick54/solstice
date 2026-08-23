import type { UtcInstant } from '../../../domain/src/time.ts';
import type { DataKind } from './kinds.ts';

export const CORRECTION_KINDS = ['USER_CORRECTION', 'DERIVED_CHALLENGE', 'PROVIDER_REVIEW'] as const;
export type CorrectionKind = (typeof CORRECTION_KINDS)[number];

export const CORRECTION_STATUSES = [
  'REQUESTED',
  'APPLIED',
  'REVIEW_PENDING',
  'REJECTED',
  'WITHDRAWN',
] as const;
export type CorrectionStatus = (typeof CORRECTION_STATUSES)[number];

export type VaultCorrectionRequest = {
  readonly correctionId: string;
  readonly dataRecordId: string;
  readonly subjectId: string;
  readonly kind: CorrectionKind;
  readonly status: CorrectionStatus;
  readonly reason: string;
  readonly proposedPayload: unknown | null;
  readonly requestedAt: UtcInstant;
  readonly resolvedAt: UtcInstant | null;
  readonly outcome: string | null;
};

export function correctionKindFor(dataKind: DataKind): CorrectionKind {
  if (dataKind === 'USER_DECLARATION') {
    return 'USER_CORRECTION';
  }
  if (dataKind === 'DERIVED_DATA' || dataKind === 'AI_INFERENCE') {
    return 'DERIVED_CHALLENGE';
  }
  return 'PROVIDER_REVIEW';
}

export function userMayOverwrite(dataKind: DataKind): boolean {
  return dataKind === 'USER_DECLARATION';
}
