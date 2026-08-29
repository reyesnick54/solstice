import type { ProductiveCategory } from '../../../sunrey-chain/src/productive/types.ts';
import type { CapacityFreshness, CapacitySlice, CapacitySliceQuery } from './types.ts';
import type { CapacityFreshnessState, CapacityVerificationStatus } from './taxonomy.ts';

const FRESHNESS_AGING_SECONDS = 3_600n;
const FRESHNESS_STALE_SECONDS = 86_400n;

export function assessFreshness(
  observedAtUnixSeconds: bigint,
  validUntilUnixSeconds: bigint,
  nowUnixSeconds: bigint,
): CapacityFreshness {
  const age = nowUnixSeconds - observedAtUnixSeconds;
  let state: CapacityFreshnessState;
  if (nowUnixSeconds >= validUntilUnixSeconds) {
    state = 'EXPIRED';
  } else if (age > FRESHNESS_STALE_SECONDS) {
    state = 'STALE';
  } else if (age > FRESHNESS_AGING_SECONDS) {
    state = 'AGING';
  } else {
    state = 'FRESH';
  }
  return {
    state,
    observedAtUnixSeconds,
    validUntilUnixSeconds,
    maxAgeSeconds: FRESHNESS_STALE_SECONDS,
  };
}

export function isStaleFreshness(freshness: CapacityFreshness): boolean {
  return freshness.state === 'STALE' || freshness.state === 'EXPIRED';
}

export function windowsOverlap(
  sliceStart: bigint,
  sliceEnd: bigint,
  queryStart: bigint,
  queryEnd: bigint,
): boolean {
  return sliceStart < queryEnd && sliceEnd > queryStart;
}

export function validateQueryWindow(query: CapacitySliceQuery): { ok: true } | { ok: false; message: string } {
  if (query.windowEndUnixSeconds <= query.windowStartUnixSeconds) {
    return { ok: false, message: 'query window end must be after start' };
  }
  return { ok: true };
}

export function validateSliceCapacity(slice: CapacitySlice): { ok: true } | { ok: false; code: 'ZERO_CAPACITY' | 'NEGATIVE_CAPACITY' } {
  if (slice.capacityAmount < 0n) {
    return { ok: false, code: 'NEGATIVE_CAPACITY' };
  }
  if (slice.capacityAmount === 0n) {
    return { ok: false, code: 'ZERO_CAPACITY' };
  }
  if (slice.availabilityAmount < 0n) {
    return { ok: false, code: 'NEGATIVE_CAPACITY' };
  }
  return { ok: true };
}

export function isExhausted(slice: CapacitySlice): boolean {
  return slice.availabilityAmount === 0n;
}

export function matchesGeography(slice: CapacitySlice, geographyId?: string, serviceLocation?: string): boolean {
  if (geographyId && slice.geography.geographyId !== geographyId) {
    return false;
  }
  if (serviceLocation && !slice.serviceLocation.toLowerCase().includes(serviceLocation.toLowerCase())) {
    return false;
  }
  return true;
}

export function matchesCategory(slice: CapacitySlice, category?: ProductiveCategory): boolean {
  return !category || slice.economicCategory === category;
}

export function matchesQuality(slice: CapacitySlice, quality?: import('./taxonomy.ts').ServiceQualityClass): boolean {
  return !quality || slice.serviceQualityClass === quality;
}

export function hasProvenance(slice: CapacitySlice): boolean {
  if (slice.verificationStatus === 'MARKETING_UNPROVENANCED') {
    return false;
  }
  const prov = slice.provenance;
  return Boolean(
    prov.provenanceId &&
      (prov.oracleFactId || prov.claimId || prov.objectId || prov.evidenceVaultRef),
  );
}

export function isAcceptableVerification(status: CapacityVerificationStatus): boolean {
  return status === 'VERIFIED' || status === 'PENDING';
}

export function filterCapacitySlices(
  slices: readonly CapacitySlice[],
  query: CapacitySliceQuery,
): readonly CapacitySlice[] {
  const windowValid = validateQueryWindow(query);
  if (!windowValid.ok) {
    return [];
  }

  return slices.filter((slice) => {
    const capacityValid = validateSliceCapacity(slice);
    if (!capacityValid.ok) {
      return false;
    }
    if (!windowsOverlap(
      slice.availabilityStartUnixSeconds,
      slice.availabilityEndUnixSeconds,
      query.windowStartUnixSeconds,
      query.windowEndUnixSeconds,
    )) {
      return false;
    }
    if (!matchesGeography(slice, query.geographyId, query.serviceLocation)) {
      return false;
    }
    if (!matchesCategory(slice, query.economicCategory)) {
      return false;
    }
    if (!matchesQuality(slice, query.serviceQualityClass)) {
      return false;
    }
    if (query.rejectStaleEvidence !== false && isStaleFreshness(slice.freshness)) {
      return false;
    }
    if (query.requireProvenance !== false && !hasProvenance(slice)) {
      return false;
    }
    if (!isAcceptableVerification(slice.verificationStatus)) {
      return false;
    }
    if (query.kind === 'AVAILABILITY' && isExhausted(slice)) {
      return false;
    }
    if (query.minAvailabilityAmount !== undefined && slice.availabilityAmount < query.minAvailabilityAmount) {
      return false;
    }
    return true;
  });
}

export function sortSlicesByAvailability(slices: readonly CapacitySlice[]): readonly CapacitySlice[] {
  return [...slices].sort((left, right) => {
    if (left.availabilityAmount === right.availabilityAmount) {
      return left.sliceId.localeCompare(right.sliceId);
    }
    return left.availabilityAmount > right.availabilityAmount ? -1 : 1;
  });
}
