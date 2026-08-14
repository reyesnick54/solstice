import type { UtcInstant } from '../../../domain/src/time.ts';
import { isUtcInstant } from '../../../domain/src/time.ts';
import type { PolicyPackId, PolicyVersionRecord } from './types.ts';

/**
 * Instant comparison uses the canonical UTC string. ISO-8601 instants
 * ending in Z compare lexicographically as timeline order. No local time.
 */
export function compareUtc(left: UtcInstant, right: UtcInstant): number {
  if (left === right) {
    return 0;
  }
  return left < right ? -1 : 1;
}

export function isEffectiveAt(version: PolicyVersionRecord, at: UtcInstant): boolean {
  if (compareUtc(at, version.effectiveFrom) < 0) {
    return false;
  }
  if (version.effectiveUntil && compareUtc(at, version.effectiveUntil) >= 0) {
    return false;
  }
  return true;
}

export function resolvePolicyVersion(input: {
  readonly packId: PolicyPackId;
  readonly versions: readonly PolicyVersionRecord[];
  readonly at: UtcInstant;
  readonly pinVersionId?: string;
}): PolicyVersionRecord | { readonly fail: 'POLICY_VERSION_MISSING' | 'POLICY_VERSION_NOT_EFFECTIVE' | 'POLICY_VERSION_RETIRED' } {
  if (!isUtcInstant(input.at)) {
    return { fail: 'POLICY_VERSION_MISSING' };
  }
  if (input.pinVersionId) {
    const pinned = input.versions.find((row) => row.versionId === input.pinVersionId);
    if (!pinned) {
      return { fail: 'POLICY_VERSION_MISSING' };
    }
    if (pinned.packId !== input.packId) {
      return { fail: 'POLICY_VERSION_MISSING' };
    }
    if (pinned.lifecycle === 'RETIRED' && !isEffectiveAt(pinned, input.at)) {
      return { fail: 'POLICY_VERSION_RETIRED' };
    }
    if (!isEffectiveAt(pinned, input.at) && pinned.lifecycle !== 'RETIRED') {
      return { fail: 'POLICY_VERSION_NOT_EFFECTIVE' };
    }
    return pinned;
  }

  const candidates = input.versions.filter(
    (row) =>
      row.packId === input.packId &&
      row.lifecycle === 'ACTIVE_SIMULATION' &&
      isEffectiveAt(row, input.at),
  );
  if (candidates.length === 0) {
    const retired = input.versions.filter(
      (row) => row.packId === input.packId && row.lifecycle === 'RETIRED' && isEffectiveAt(row, input.at),
    );
    if (retired.length > 0) {
      return { fail: 'POLICY_VERSION_RETIRED' };
    }
    const known = input.versions.filter((row) => row.packId === input.packId);
    if (known.length === 0) {
      return { fail: 'POLICY_VERSION_MISSING' };
    }
    return { fail: 'POLICY_VERSION_NOT_EFFECTIVE' };
  }
  candidates.sort((a, b) => {
    const byStart = compareUtc(b.effectiveFrom, a.effectiveFrom);
    if (byStart !== 0) {
      return byStart;
    }
    return a.versionId < b.versionId ? 1 : -1;
  });
  return candidates[0]!;
}

export function assertImmutableVersion(
  existing: PolicyVersionRecord,
  next: PolicyVersionRecord,
): void {
  if (existing.contentHash !== next.contentHash || existing.versionId !== next.versionId) {
    throw new Error(
      `policy version ${existing.versionId} is immutable; create a new version instead of editing`,
    );
  }
}
