// @ts-nocheck
import type { UtcInstant } from '../../../../domain/src/time.ts';
import type { ConsentGrantId, RightsGrantId, RightsRevocationId } from './ids.ts';
import type { RightsGrant, RightsGrantState, RightsRevocation } from './types.ts';

export function isInstantBefore(left: UtcInstant, right: UtcInstant): boolean {
  return left < right;
}

export function isInstantAfter(left: UtcInstant, right: UtcInstant): boolean {
  return left > right;
}

export function grantEffectiveWindow(
  effectiveFrom: UtcInstant,
  effectiveUntil: UtcInstant | null,
): { readonly from: UtcInstant; readonly until: UtcInstant | null } {
  return Object.freeze({ from: effectiveFrom, until: effectiveUntil });
}

export function grantActiveAt(
  effectiveFrom: UtcInstant,
  effectiveUntil: UtcInstant | null,
  at: UtcInstant,
): boolean {
  if (isInstantBefore(at, effectiveFrom)) {
    return false;
  }
  if (effectiveUntil !== null && !isInstantBefore(at, effectiveUntil)) {
    return false;
  }
  return true;
}

export function findRevocationForTarget(
  revocations: readonly RightsRevocation[],
  targetGrantId: RightsGrantId | ConsentGrantId,
): RightsRevocation | null {
  const match = revocations.find((revocation) => revocation.targetGrantId === targetGrantId);
  return match ?? null;
}

export function wasRevokedBefore(
  revocation: RightsRevocation | null,
  at: UtcInstant,
): boolean {
  if (!revocation) {
    return false;
  }
  return !isInstantAfter(revocation.revokedAt, at);
}

export function resolveGrantState(
  grant: RightsGrant,
  at: UtcInstant,
  revocations: readonly RightsRevocation[],
): RightsGrantState {
  const revocation = findRevocationForTarget(revocations, grant.rightsGrantId);
  if (revocation && wasRevokedBefore(revocation, at)) {
    return 'REVOKED';
  }
  if (!grantActiveAt(grant.effectiveFrom, grant.effectiveUntil, at)) {
    return isInstantBefore(at, grant.effectiveFrom) ? 'EXPIRED' : 'EXPIRED';
  }
  return 'ACTIVE';
}

/**
 * Historical finalized transactions retain the authorization that was relied upon
 * at execution time. Revocation blocks future use without rewriting history.
 */
export function evaluateRevocationSemantics(input: {
  readonly executionAt: UtcInstant;
  readonly evaluatedAt: UtcInstant;
  readonly revocation: RightsRevocation | null;
}): {
  readonly validAtExecutionTime: boolean;
  readonly blockedForFutureUse: boolean;
  readonly reliedUponRevocationRef: RightsRevocationId | null;
} {
  if (!input.revocation) {
    return Object.freeze({
      validAtExecutionTime: true,
      blockedForFutureUse: false,
      reliedUponRevocationRef: null,
    });
  }

  const revokedBeforeExecution = wasRevokedBefore(input.revocation, input.executionAt);
  const revokedBeforeEvaluation = wasRevokedBefore(input.revocation, input.evaluatedAt);

  return Object.freeze({
    validAtExecutionTime: !revokedBeforeExecution,
    blockedForFutureUse: revokedBeforeEvaluation,
    reliedUponRevocationRef: input.revocation.revocationId,
  });
}

export function attachRevocationRef<T extends { readonly revocationRef: RightsRevocationId | null }>(
  grant: T,
  revocation: RightsRevocation,
): T {
  return Object.freeze({
    ...grant,
    revocationRef: revocation.revocationId,
  });
}
