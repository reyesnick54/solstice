/**
 * Bridge adapter projecting canonical productive/oracle records into CapacitySlice
 * read models. Access Fabric consumes truth; it does not own the registry.
 */

import type { VerifiedEconomicFact } from '../../../sunrey-chain/src/oracle/types.ts';
import type { ProductiveClaim } from '../../../sunrey-chain/src/productive/claims.ts';
import type { ProductiveEconomicObject } from '../../../sunrey-chain/src/productive/objects.ts';
import { assessFreshness, filterCapacitySlices, sortSlicesByAvailability, validateQueryWindow } from './query.ts';
import type { ProductiveCapacityPort } from './port.ts';
import type {
  CapacityQueryOutcome,
  CapacitySlice,
  CapacitySliceQuery,
  UtilizationQuery,
  UtilizationQueryOutcome,
} from './types.ts';

export type CanonicalProductiveCapacitySources = {
  readonly objects: readonly ProductiveEconomicObject[];
  readonly claims: readonly ProductiveClaim[];
  readonly facts: readonly VerifiedEconomicFact[];
};

function claimToSlice(
  claim: ProductiveClaim,
  object: ProductiveEconomicObject,
  fact: VerifiedEconomicFact | undefined,
  usageClaim: ProductiveClaim | undefined,
  nowUnixSeconds: bigint,
): CapacitySlice | null {
  if (claim.claimType !== 'CAPACITY') {
    return null;
  }
  if (claim.status !== 'VERIFIED') {
    return null;
  }
  if (claim.quantity <= 0n) {
    return null;
  }
  const observedAt = fact?.observationWindow.startUnix ?? claim.measurementPeriod.validFromUnixSeconds;
  const validUntil = fact?.validUntilUnix ?? claim.measurementPeriod.validUntilUnixSeconds;
  const utilization = usageClaim
    ? {
        utilizedAmount: usageClaim.quantity,
        basisAmount: claim.quantity,
        ratioScaled: claim.quantity === 0n ? 0n : (usageClaim.quantity * 1_000_000n) / claim.quantity,
        independentlyEvidenced: true as const,
      }
    : null;
  const availabilityAmount = utilization
    ? claim.quantity > utilization.utilizedAmount
      ? claim.quantity - utilization.utilizedAmount
      : 0n
    : claim.quantity;

  return Object.freeze({
    sliceId: `canonical_slice_${claim.claimId}`,
    productiveObjectRef: object.objectId,
    economicCategory: claim.category,
    capacityAmount: claim.quantity,
    canonicalUnit: (claim.unit as import('../../../sunrey-chain/src/oracle/types.ts').UnitCode) ?? 'service_hour',
    availabilityStartUnixSeconds: claim.measurementPeriod.validFromUnixSeconds,
    availabilityEndUnixSeconds: claim.measurementPeriod.validUntilUnixSeconds,
    geography: claim.geography,
    serviceLocation: object.capacityMetadata.location ?? object.geography.geographyId,
    serviceQualityClass: mapQualityFromMetadata(object.capacityMetadata),
    utilization,
    availabilityAmount,
    providerOperatorRef: object.operator,
    rightsRestrictions: Object.freeze(
      claim.rightsReferences.map((ref, index) => ({
        restrictionId: ref,
        description: `Canonical rights reference ${index + 1}`,
        jurisdiction: claim.geography.jurisdiction,
      })),
    ),
    provenance: Object.freeze({
      provenanceId: `canonical_prov_${claim.claimId}`,
      sourceClass: 'CANONICAL_PRODUCTIVE_REGISTRY' as const,
      claimId: claim.claimId,
      objectId: object.objectId,
      ...(fact ? { oracleFactId: fact.factId } : {}),
    }),
    freshness: assessFreshness(observedAt, validUntil, nowUnixSeconds),
    verificationStatus: fact?.qualityStatus === 'STALE' ? 'STALE' : 'VERIFIED',
  });
}

function mapQualityFromMetadata(metadata: Readonly<Record<string, string>>): import('./taxonomy.ts').ServiceQualityClass {
  const quality = metadata.qualityClass;
  const allowed = [
    'STANDARD',
    'PREMIUM',
    'BUSINESS',
    'ECONOMY',
    'GPU_A100',
    'GPU_H100',
    'ROBOT_INDUSTRIAL',
    'ROBOT_COLLABORATIVE',
    'PASSENGER_VEHICLE',
    'HOTEL_ROOM_NIGHT',
    'AIRLINE_SEAT',
    'FOOD_DELIVERY',
    'FOOD_PRODUCTION',
    'ENERGY_GRID',
  ] as const;
  if (quality && (allowed as readonly string[]).includes(quality)) {
    return quality as import('./taxonomy.ts').ServiceQualityClass;
  }
  return 'STANDARD';
}

export function projectCanonicalCapacitySlices(
  sources: CanonicalProductiveCapacitySources,
  nowUnixSeconds: bigint,
): readonly CapacitySlice[] {
  const objectById = new Map(sources.objects.map((row) => [row.objectId, row]));
  const factById = new Map(sources.facts.map((row) => [row.factId, row]));
  const usageByObject = new Map<string, ProductiveClaim>();
  for (const claim of sources.claims) {
    if (claim.claimType === 'USAGE' && claim.status === 'VERIFIED') {
      usageByObject.set(claim.objectId, claim);
    }
  }
  const slices: CapacitySlice[] = [];
  for (const claim of sources.claims) {
    const object = objectById.get(claim.objectId);
    if (!object) {
      continue;
    }
    const fact = claim.oracleFactIds.map((id) => factById.get(id)).find(Boolean);
    const usageClaim = usageByObject.get(claim.objectId);
    const slice = claimToSlice(claim, object, fact, usageClaim, nowUnixSeconds);
    if (slice) {
      slices.push(slice);
    }
  }
  return Object.freeze(slices);
}

/**
 * Read-only adapter over canonical productive registry and oracle facts.
 */
export class CanonicalProductiveCapacityAdapter implements ProductiveCapacityPort {
  readonly sourceClass = 'CANONICAL_PRODUCTIVE_REGISTRY' as const;
  readonly #slices: readonly CapacitySlice[];

  constructor(sources: CanonicalProductiveCapacitySources, nowUnixSeconds: bigint) {
    this.#slices = projectCanonicalCapacitySlices(sources, nowUnixSeconds);
  }

  queryAvailability(query: CapacitySliceQuery): CapacityQueryOutcome {
    const window = validateQueryWindow(query);
    if (!window.ok) {
      return { ok: false, code: 'INVALID_TIME_WINDOW', message: window.message };
    }
    const filtered = sortSlicesByAvailability(filterCapacitySlices(this.#slices, query));
    return {
      ok: true,
      slices: filtered,
      queriedAtUnixSeconds: query.nowUnixSeconds,
      sourceCount: filtered.length,
    };
  }

  queryUtilization(query: UtilizationQuery): UtilizationQueryOutcome {
    const slice = this.#slices.find((row) => row.productiveObjectRef === query.productiveObjectRef);
    if (!slice?.utilization) {
      return { ok: false, code: 'UNKNOWN_SLICE', message: 'no independently evidenced utilization for object' };
    }
    return {
      ok: true,
      utilization: slice.utilization,
      sliceId: slice.sliceId,
      provenance: slice.provenance,
    };
  }

  snapshot() {
    return Object.freeze({
      sliceCount: this.#slices.length,
      sourceClass: this.sourceClass,
    });
  }
}
