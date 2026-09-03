/**
 * Wave 3 — Canonical Economic Claim registry with anti-double-counting.
 */

import type { CanonicalEconomicClaim, ClaimLifecycleState, EconomicDomain, ProofBoundRejection } from './types.ts';
import { ECONOMIC_CLAIM_SCHEMA } from './types.ts';
import { economicClaimCommitment } from './commitments.ts';

export type ClaimRegistry = {
  readonly claims: Map<string, CanonicalEconomicClaim>;
  readonly fingerprints: Map<string, string>;
  readonly monetizedClaimIds: Set<string>;
};

export function emptyClaimRegistry(): ClaimRegistry {
  return {
    claims: new Map(),
    fingerprints: new Map(),
    monetizedClaimIds: new Set(),
  };
}

export function registerEconomicClaim(
  registry: ClaimRegistry,
  input: {
    readonly economicClaimId: string;
    readonly economicDomain: EconomicDomain;
    readonly contributionClass: string;
    readonly fingerprint: string;
    readonly subjectCommitment: string;
    readonly registeredAtUtc: string;
    readonly lifecycleState?: ClaimLifecycleState;
  },
): { readonly ok: true; readonly claim: CanonicalEconomicClaim } | { readonly ok: false; readonly code: ProofBoundRejection } {
  if (registry.fingerprints.has(input.fingerprint)) {
    return { ok: false, code: 'CLAIM_FINGERPRINT_DUPLICATE' };
  }
  if (registry.claims.has(input.economicClaimId)) {
    return { ok: false, code: 'CLAIM_FINGERPRINT_DUPLICATE' };
  }
  const claimCommitment = economicClaimCommitment({
    economicClaimId: input.economicClaimId,
    economicDomain: input.economicDomain,
    contributionClass: input.contributionClass,
    fingerprint: input.fingerprint,
    subjectCommitment: input.subjectCommitment,
  });
  const claim: CanonicalEconomicClaim = Object.freeze({
    schema: ECONOMIC_CLAIM_SCHEMA,
    economicClaimId: input.economicClaimId,
    claimCommitment,
    economicDomain: input.economicDomain,
    contributionClass: input.contributionClass,
    fingerprint: input.fingerprint,
    lifecycleState: input.lifecycleState ?? 'REGISTERED',
    registeredAtUtc: input.registeredAtUtc,
    containsRawPersonalData: false,
  });
  registry.claims.set(input.economicClaimId, claim);
  registry.fingerprints.set(input.fingerprint, input.economicClaimId);
  return { ok: true, claim };
}

export function getClaim(registry: ClaimRegistry, economicClaimId: string): CanonicalEconomicClaim | undefined {
  return registry.claims.get(economicClaimId);
}

export function markClaimMonetized(registry: ClaimRegistry, economicClaimId: string): void {
  registry.monetizedClaimIds.add(economicClaimId);
  const claim = registry.claims.get(economicClaimId);
  if (claim) {
    registry.claims.set(
      economicClaimId,
      Object.freeze({ ...claim, lifecycleState: 'MONETIZED' }),
    );
  }
}

export function isClaimMonetized(registry: ClaimRegistry, economicClaimId: string): boolean {
  return registry.monetizedClaimIds.has(economicClaimId);
}

export function cloneClaimRegistry(registry: ClaimRegistry): ClaimRegistry {
  return {
    claims: new Map(registry.claims),
    fingerprints: new Map(registry.fingerprints),
    monetizedClaimIds: new Set(registry.monetizedClaimIds),
  };
}

export function serializeClaimRegistry(registry: ClaimRegistry): string {
  return JSON.stringify({
    claims: [...registry.claims.entries()],
    fingerprints: [...registry.fingerprints.entries()],
    monetizedClaimIds: [...registry.monetizedClaimIds],
  });
}

export function deserializeClaimRegistry(json: string): ClaimRegistry {
  const parsed = JSON.parse(json) as {
    claims: [string, CanonicalEconomicClaim][];
    fingerprints: [string, string][];
    monetizedClaimIds: string[];
  };
  return {
    claims: new Map(parsed.claims),
    fingerprints: new Map(parsed.fingerprints),
    monetizedClaimIds: new Set(parsed.monetizedClaimIds),
  };
}
