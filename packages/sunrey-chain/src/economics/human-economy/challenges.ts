/**
 * Wave 6 — Human Economic Claim challenge lifecycle.
 *
 * Supports post-registration challenges without rewriting finalized history.
 */

import { createHash } from 'node:crypto';

import type { ClaimChallengeReason, ClaimChallengeRecord, ClaimChallengeState } from './types.ts';

export type ClaimChallengeRegistry = {
  readonly challenges: ReadonlyMap<string, ClaimChallengeRecord>;
  readonly byClaimId: ReadonlyMap<string, readonly string[]>;
};

export function emptyClaimChallengeRegistry(): ClaimChallengeRegistry {
  return {
    challenges: new Map(),
    byClaimId: new Map(),
  };
}

export function registerClaimChallenge(
  registry: ClaimChallengeRegistry,
  input: {
    readonly economicClaimId: string;
    readonly reason: ClaimChallengeReason;
    readonly filedBy: ClaimChallengeRecord['filedBy'];
    readonly relatedTransactionId?: string | null;
    readonly filedAtUtc: string;
  },
): { readonly ok: true; readonly challenge: ClaimChallengeRecord } {
  const challengeId = createHash('sha256')
    .update(`challenge:${input.economicClaimId}:${input.reason}:${input.filedAtUtc}`)
    .digest('hex');
  const challenge: ClaimChallengeRecord = Object.freeze({
    challengeId,
    economicClaimId: input.economicClaimId,
    reason: input.reason,
    state: 'FILED',
    filedAtUtc: input.filedAtUtc,
    filedBy: input.filedBy,
    relatedTransactionId: input.relatedTransactionId ?? null,
    appendOnly: true,
  });
  registry.challenges.set(challengeId, challenge);
  const existing = registry.byClaimId.get(input.economicClaimId) ?? [];
  registry.byClaimId.set(input.economicClaimId, [...existing, challengeId]);
  return { ok: true, challenge };
}

export function transitionClaimChallenge(
  registry: ClaimChallengeRegistry,
  challengeId: string,
  nextState: ClaimChallengeState,
): ClaimChallengeRecord | null {
  const existing = registry.challenges.get(challengeId);
  if (!existing) {
    return null;
  }
  const updated: ClaimChallengeRecord = Object.freeze({
    ...existing,
    state: nextState,
  });
  registry.challenges.set(challengeId, updated);
  return updated;
}

export function getChallengesForClaim(
  registry: ClaimChallengeRegistry,
  economicClaimId: string,
): readonly ClaimChallengeRecord[] {
  const ids = registry.byClaimId.get(economicClaimId) ?? [];
  return ids
    .map((id) => registry.challenges.get(id))
    .filter((row): row is ClaimChallengeRecord => row !== undefined);
}

export function hasActiveChallenge(registry: ClaimChallengeRegistry, economicClaimId: string): boolean {
  return getChallengesForClaim(registry, economicClaimId).some(
    (row) => row.state === 'FILED' || row.state === 'UNDER_REVIEW',
  );
}
