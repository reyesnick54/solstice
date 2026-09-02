/**
 * Wave 5 — Productive claim challenge lifecycle.
 *
 * Extends Wave 3 economic proof challenge architecture for productive
 * economic claims. Challenge state is recorded separately from finalized
 * history and may block future monetization progression.
 */

import { err, ok, type Result } from '../../../../domain/src/result.ts';
import { asUtcInstant, type UtcInstant } from '../../../../domain/src/time.ts';
import type {
  ProductiveChallengeReason,
  ProductiveChallengeStatus,
  ProductiveClaimChallenge,
  ProductiveOperationsRejection,
} from './types.ts';
import { PRODUCTIVE_OPERATIONS_SCHEMA_VERSION } from './types.ts';

const VALID_TRANSITIONS: Readonly<Record<ProductiveChallengeStatus, readonly ProductiveChallengeStatus[]>> =
  Object.freeze({
    OPEN: ['UNDER_REVIEW', 'REJECTED', 'SUPERSEDED'],
    UNDER_REVIEW: ['UPHELD', 'REJECTED', 'CORRECTED', 'SUPERSEDED'],
    UPHELD: [],
    REJECTED: [],
    CORRECTED: [],
    SUPERSEDED: [],
  });

export function challengeTransitionAllowed(
  from: ProductiveChallengeStatus,
  to: ProductiveChallengeStatus,
): boolean {
  return VALID_TRANSITIONS[from].includes(to);
}

export function createProductiveClaimChallenge(input: {
  readonly challengeId: string;
  readonly claimId: string;
  readonly reason: ProductiveChallengeReason;
  readonly challengerId: string;
  readonly evidenceCommitment: string;
  readonly openedAtUtc?: UtcInstant;
  readonly postFinality?: boolean;
}): ProductiveClaimChallenge {
  return Object.freeze({
    schemaVersion: PRODUCTIVE_OPERATIONS_SCHEMA_VERSION,
    challengeId: input.challengeId,
    claimId: input.claimId,
    status: 'OPEN',
    reason: input.reason,
    challengerId: input.challengerId,
    evidenceCommitment: input.evidenceCommitment,
    openedAtUtc: input.openedAtUtc ?? asUtcInstant(new Date().toISOString()),
    resolvedAtUtc: null,
    resolutionNote: null,
    postFinality: input.postFinality ?? false,
    supersedingClaimId: null,
    correctingClaimId: null,
  });
}

export function transitionChallenge(
  challenge: ProductiveClaimChallenge,
  to: ProductiveChallengeStatus,
  input: {
    readonly resolutionNote?: string;
    readonly resolvedAtUtc?: UtcInstant;
    readonly supersedingClaimId?: string;
    readonly correctingClaimId?: string;
  } = {},
): Result<ProductiveClaimChallenge, ProductiveOperationsRejection> {
  if (!challengeTransitionAllowed(challenge.status, to)) {
    return err({
      code: 'INVALID_CHALLENGE_TRANSITION',
      detail: `Cannot transition challenge ${challenge.challengeId} from ${challenge.status} to ${to}`,
    });
  }
  const resolved = to === 'UPHELD' || to === 'REJECTED' || to === 'CORRECTED' || to === 'SUPERSEDED';
  return ok(
    Object.freeze({
      ...challenge,
      status: to,
      resolvedAtUtc: resolved
        ? (input.resolvedAtUtc ?? asUtcInstant(new Date().toISOString()))
        : challenge.resolvedAtUtc,
      resolutionNote: input.resolutionNote ?? challenge.resolutionNote,
      supersedingClaimId: input.supersedingClaimId ?? challenge.supersedingClaimId,
      correctingClaimId: input.correctingClaimId ?? challenge.correctingClaimId,
    }),
  );
}

export function challengeBlocksFutureMonetization(challenge: ProductiveClaimChallenge): boolean {
  return (
    challenge.status === 'OPEN' ||
    challenge.status === 'UNDER_REVIEW' ||
    challenge.status === 'UPHELD'
  );
}

export function challengeRequiresReview(challenge: ProductiveClaimChallenge): boolean {
  return challenge.status === 'OPEN' || challenge.status === 'UNDER_REVIEW';
}
