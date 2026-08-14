import type { UtcInstant } from '../../domain/src/time.ts';
import type { RecoveryRequestId, SolsticeIdentityId } from './ids.ts';

export const RECOVERY_STATES = [
  'REQUESTED',
  'EVIDENCE_REQUIRED',
  'STEP_UP_REQUIRED',
  'APPROVED',
  'DENIED',
  'EXPIRED',
] as const;

export type RecoveryState = (typeof RECOVERY_STATES)[number];

/**
 * Account recovery. There is no support-agent reset bypass.
 * Completion requires recorded evidence and a step-up authentication.
 */
export type RecoveryRequest = {
  readonly id: RecoveryRequestId;
  readonly identityId: SolsticeIdentityId;
  readonly state: RecoveryState;
  readonly evidenceRefs: readonly string[];
  readonly stepUpCompletedAt: UtcInstant | null;
  readonly reasonCodes: readonly string[];
  readonly createdAt: UtcInstant;
  readonly updatedAt: UtcInstant;
  readonly version: number;
};
