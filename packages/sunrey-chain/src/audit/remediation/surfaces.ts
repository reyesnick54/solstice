import {
  FINDING_AFFECTED_SURFACES,
  HEIGHTENED_REVIEW_BOUNDARIES,
  SECURITY_CRITICAL_SURFACES,
  type FindingAffectedSurface,
  type HeightenedReviewBoundary,
  type ProviderSurfaceReference,
} from './types.ts';

export function isAffectedSurface(value: string): value is FindingAffectedSurface {
  return (FINDING_AFFECTED_SURFACES as readonly string[]).includes(value);
}

export function isSecurityCriticalSurface(surface: FindingAffectedSurface): boolean {
  return SECURITY_CRITICAL_SURFACES.includes(surface);
}

export function heightenedBoundaryFor(
  surface: FindingAffectedSurface,
): HeightenedReviewBoundary | null {
  if (surface === 'consensus') {
    return 'consensus';
  }
  if (surface === 'cryptography' || surface === 'PQC') {
    return 'cryptography';
  }
  if (surface === 'wallets' || surface === 'validators') {
    return 'signer_safety';
  }
  if (surface === 'native_assets' || surface === 'MoonRey_issuance' || surface === 'monetary_policy') {
    return 'native_supply';
  }
  if (surface === 'Exchange') {
    return 'DVP';
  }
  if (surface === 'custody') {
    return 'custody_signing';
  }
  if (surface === 'governance') {
    return 'governance_authority';
  }
  return null;
}

export function requiresHeightenedReview(surface: FindingAffectedSurface): boolean {
  return heightenedBoundaryFor(surface) !== null;
}

export function assertKnownHeightenedBoundary(boundary: string): asserts boundary is HeightenedReviewBoundary {
  if (!(HEIGHTENED_REVIEW_BOUNDARIES as readonly string[]).includes(boundary)) {
    throw new Error(`unknown heightened-review boundary ${boundary}`);
  }
}

/**
 * Chunk 82 provider-surface contract. Findings may reference a
 * provider surface that is in independent-review scope. This does
 * not invent a second provider registry.
 */
export function providerSurfaceReference(input: {
  readonly surfaceId: string;
  readonly providerKind: ProviderSurfaceReference['providerKind'];
  readonly inReviewScope: boolean;
}): ProviderSurfaceReference {
  if (!input.surfaceId.trim()) {
    throw new Error('provider surface reference requires a surface id');
  }
  return Object.freeze({
    surfaceId: input.surfaceId,
    providerKind: input.providerKind,
    inReviewScope: input.inReviewScope,
    chunk82Contract: true,
  });
}
