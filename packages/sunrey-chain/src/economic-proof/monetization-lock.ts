import { asUtcInstant, type UtcInstant } from '../../../domain/src/time.ts';
import { economicProofDigest } from './hash.ts';
import type {
  ChallengeState,
  ChallengeStatus,
  ClaimFingerprint,
  MonetizationConsumptionCommitment,
  MonetizationContextId,
  MonetizationLock,
  MonetizationLockStatus,
  MonetizationPolicy,
} from './types.ts';

export function asMonetizationContextId(value: string): MonetizationContextId {
  return value as MonetizationContextId;
}

export function asMonetizationConsumptionCommitment(value: string): MonetizationConsumptionCommitment {
  return value as MonetizationConsumptionCommitment;
}

export function emptyMonetizationLock(now: UtcInstant): MonetizationLock {
  return Object.freeze({
    status: 'UNMONETIZED',
    contextId: null,
    consumptionCommitment: null,
    replayKey: null,
    updatedAtUtc: now,
  });
}

export function deriveConsumptionCommitment(input: {
  readonly claimFingerprint: ClaimFingerprint;
  readonly contextId: MonetizationContextId;
  readonly replayKey: string;
}): MonetizationConsumptionCommitment {
  return asMonetizationConsumptionCommitment(
    economicProofDigest(['consumption', input.claimFingerprint, input.contextId, input.replayKey]),
  );
}

export function initialChallengeState(): ChallengeState {
  return Object.freeze({
    status: 'NONE',
    reason: null,
    openedAtUtc: null,
    resolvedAtUtc: null,
  });
}

export function openChallenge(
  state: ChallengeState,
  reason: string,
  now: UtcInstant,
  material = false,
): ChallengeState {
  return Object.freeze({
    status: material ? 'MATERIAL_DISPUTE' : 'OPEN',
    reason,
    openedAtUtc: now,
    resolvedAtUtc: null,
  });
}

export function resolveChallenge(
  state: ChallengeState,
  upheld: boolean,
  now: UtcInstant,
): ChallengeState {
  return Object.freeze({
    ...state,
    status: upheld ? 'RESOLVED_UPHELD' : 'RESOLVED_INVALIDATED',
    resolvedAtUtc: now,
  });
}

export function challengeBlocksMonetization(
  challenge: ChallengeState,
  policy: MonetizationPolicy,
): boolean {
  if (challenge.status === 'NONE' || challenge.status === 'RESOLVED_INVALIDATED') {
    return false;
  }
  if (challenge.status === 'RESOLVED_UPHELD') {
    return true;
  }
  if (policy.allowProgressionUnderChallenge) {
    return false;
  }
  return challenge.status === 'OPEN' || challenge.status === 'MATERIAL_DISPUTE';
}

export type MonetizationTransitionResult =
  | { readonly ok: true; readonly lock: MonetizationLock }
  | { readonly ok: false; readonly code: string; readonly message: string };

function transition(
  lock: MonetizationLock,
  status: MonetizationLockStatus,
  now: UtcInstant,
  extras?: Partial<Pick<MonetizationLock, 'contextId' | 'consumptionCommitment' | 'replayKey'>>,
): MonetizationLock {
  return Object.freeze({
    status,
    contextId: extras?.contextId ?? lock.contextId,
    consumptionCommitment: extras?.consumptionCommitment ?? lock.consumptionCommitment,
    replayKey: extras?.replayKey ?? lock.replayKey,
    updatedAtUtc: now,
  });
}

export function proposeMonetization(
  lock: MonetizationLock,
  contextId: MonetizationContextId,
  challenge: ChallengeState,
  policy: MonetizationPolicy,
  now: UtcInstant,
): MonetizationTransitionResult {
  if (lock.status !== 'UNMONETIZED' && lock.status !== 'REJECTED') {
    return { ok: false, code: 'INVALID_LOCK_TRANSITION', message: `Cannot propose from ${lock.status}` };
  }
  if (challengeBlocksMonetization(challenge, policy)) {
    return { ok: false, code: 'CHALLENGE_BLOCKS_MONETIZATION', message: 'Claim is under challenge' };
  }
  return {
    ok: true,
    lock: transition(lock, 'PROPOSED', now, { contextId }),
  };
}

export function authorizeMonetization(
  lock: MonetizationLock,
  contextId: MonetizationContextId,
  challenge: ChallengeState,
  policy: MonetizationPolicy,
  now: UtcInstant,
): MonetizationTransitionResult {
  if (lock.status !== 'PROPOSED' && lock.status !== 'UNMONETIZED') {
    return { ok: false, code: 'INVALID_LOCK_TRANSITION', message: `Cannot authorize from ${lock.status}` };
  }
  if (challengeBlocksMonetization(challenge, policy)) {
    return { ok: false, code: 'CHALLENGE_BLOCKS_MONETIZATION', message: 'Claim is under challenge' };
  }
  return {
    ok: true,
    lock: transition(lock, 'AUTHORIZED', now, { contextId }),
  };
}

export function consumeMonetization(input: {
  readonly lock: MonetizationLock;
  readonly claimFingerprint: ClaimFingerprint;
  readonly contextId: MonetizationContextId;
  readonly replayKey: string;
  readonly challenge: ChallengeState;
  readonly policy: MonetizationPolicy;
  readonly now?: UtcInstant;
}): MonetizationTransitionResult {
  const now = input.now ?? asUtcInstant(new Date().toISOString());
  if (input.lock.status === 'CONSUMED') {
    return { ok: false, code: 'ALREADY_CONSUMED', message: 'Claim already crossed monetary boundary' };
  }
  if (input.lock.status !== 'AUTHORIZED' && input.lock.status !== 'PROPOSED') {
    return { ok: false, code: 'NOT_AUTHORIZED_FOR_CONSUMPTION', message: `Cannot consume from ${input.lock.status}` };
  }
  if (challengeBlocksMonetization(input.challenge, input.policy)) {
    return { ok: false, code: 'CHALLENGE_BLOCKS_MONETIZATION', message: 'Claim is under challenge' };
  }
  const commitment = deriveConsumptionCommitment({
    claimFingerprint: input.claimFingerprint,
    contextId: input.contextId,
    replayKey: input.replayKey,
  });
  return {
    ok: true,
    lock: transition(input.lock, 'CONSUMED', now, {
      contextId: input.contextId,
      consumptionCommitment: commitment,
      replayKey: input.replayKey,
    }),
  };
}

export function rejectMonetization(lock: MonetizationLock, now: UtcInstant): MonetizationLock {
  return transition(lock, 'REJECTED', now);
}

export function revokeMonetization(lock: MonetizationLock, now: UtcInstant): MonetizationLock {
  return transition(lock, 'REVOKED', now);
}

export function markChallenged(lock: MonetizationLock, now: UtcInstant): MonetizationLock {
  return transition(lock, 'CHALLENGED', now);
}
