import { err, ok, type Result } from '../../../domain/src/result.ts';
import type { UtcInstant } from '../../../domain/src/time.ts';
import type { IdentityRecoveryId, UniquenessProofId } from './ids.ts';
import { identityRecoveryIdFor } from './ids.ts';
import type {
  BeginIdentityRecoveryInput,
  CompleteIdentityRecoveryInput,
  IdentityFailure,
  IdentityRecoverySession,
} from './types.ts';
import { uniquenessProofIsFresh } from './uniqueness.ts';
import type { UniquenessProofReceipt } from './types.ts';

export function beginIdentityRecovery(input: BeginIdentityRecoveryInput): IdentityRecoverySession {
  return Object.freeze({
    recoveryId: identityRecoveryIdFor(`${input.humanActorId}:${input.targetControllerRef}:${input.createdAt}`),
    humanActorId: input.humanActorId,
    state: 'REQUESTED',
    targetControllerKind: input.targetControllerKind,
    targetControllerRef: input.targetControllerRef,
    priorControllerRef: input.priorControllerRef ?? null,
    evidenceRefs: Object.freeze([]),
    uniquenessProofRef: null,
    createdAt: input.createdAt,
    updatedAt: input.createdAt,
  });
}

export function completeIdentityRecovery(
  session: IdentityRecoverySession,
  input: CompleteIdentityRecoveryInput,
  uniquenessProof: UniquenessProofReceipt | null,
): Result<IdentityRecoverySession, IdentityFailure> {
  if (session.recoveryId !== input.recoveryId) {
    return err({ code: 'RECOVERY_MISMATCH', message: 'recovery session id mismatch' });
  }
  if (session.state === 'APPROVED' || session.state === 'DENIED' || session.state === 'EXPIRED') {
    return err({ code: 'RECOVERY_TERMINAL', message: 'recovery session is already terminal' });
  }
  if (input.evidenceRefs.length === 0) {
    return err({ code: 'RECOVERY_EVIDENCE_REQUIRED', message: 'recovery requires recorded evidence' });
  }
  if (input.uniquenessProofRef) {
    if (!uniquenessProof || uniquenessProof.proofId !== input.uniquenessProofRef) {
      return err({ code: 'RECOVERY_UNIQUENESS_REQUIRED', message: 'matching uniqueness proof required for recovery' });
    }
    if (uniquenessProof.humanActorId !== session.humanActorId) {
      return err({
        code: 'RECOVERY_HIJACK_DENIED',
        message: 'uniqueness proof does not match the target human economic identity',
      });
    }
    if (!uniquenessProofIsFresh(uniquenessProof, input.completedAt)) {
      return err({ code: 'RECOVERY_UNIQUENESS_EXPIRED', message: 'uniqueness proof is expired' });
    }
  } else if (session.priorControllerRef !== null) {
    return err({ code: 'RECOVERY_UNIQUENESS_REQUIRED', message: 'credential change recovery requires uniqueness proof' });
  }

  return ok(
    Object.freeze({
      ...session,
      state: 'APPROVED',
      evidenceRefs: Object.freeze([...input.evidenceRefs]),
      uniquenessProofRef: input.uniquenessProofRef ?? null,
      updatedAt: input.completedAt,
    }),
  );
}

export function recoveryPreservesEconomicHistory(session: IdentityRecoverySession): boolean {
  return session.state === 'APPROVED';
}
