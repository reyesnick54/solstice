import type { GeographyRef, MeasurementPeriod, ProductiveCategory } from '../../../sunrey-chain/src/productive/types.ts';
import type { UnitCode } from '../../../sunrey-chain/src/oracle/types.ts';
import type {
  CapacityFreshnessState,
  CapacityQueryKind,
  CapacityRejectionCode,
  CapacitySourceClass,
  CapacityVerificationStatus,
  ServiceQualityClass,
} from './taxonomy.ts';

export type CapacityRightsRestriction = {
  readonly restrictionId: string;
  readonly description: string;
  readonly jurisdiction: string;
};

export type CapacityProvenanceRef = {
  readonly provenanceId: string;
  readonly sourceClass: CapacitySourceClass;
  readonly oracleFactId?: string;
  readonly claimId?: string;
  readonly objectId?: string;
  readonly evidenceVaultRef?: string;
};

export type CapacityFreshness = {
  readonly state: CapacityFreshnessState;
  readonly observedAtUnixSeconds: bigint;
  readonly validUntilUnixSeconds: bigint;
  readonly maxAgeSeconds: bigint;
};

export type CapacityUtilization = {
  readonly utilizedAmount: bigint;
  readonly basisAmount: bigint;
  readonly ratioScaled: bigint;
  readonly independentlyEvidenced: boolean;
};

/**
 * Queryable read model for productive capacity availability.
 * Access Fabric projects this from canonical owners; it is not authoritative.
 */
export type CapacitySlice = {
  readonly sliceId: string;
  readonly productiveObjectRef: string;
  readonly economicCategory: ProductiveCategory;
  readonly capacityAmount: bigint;
  readonly canonicalUnit: UnitCode;
  readonly availabilityStartUnixSeconds: bigint;
  readonly availabilityEndUnixSeconds: bigint;
  readonly geography: GeographyRef;
  readonly serviceLocation: string;
  readonly serviceQualityClass: ServiceQualityClass;
  readonly utilization: CapacityUtilization | null;
  readonly availabilityAmount: bigint;
  readonly providerOperatorRef: string;
  readonly rightsRestrictions: readonly CapacityRightsRestriction[];
  readonly provenance: CapacityProvenanceRef;
  readonly freshness: CapacityFreshness;
  readonly verificationStatus: CapacityVerificationStatus;
};

export type CapacitySliceQuery = {
  readonly kind: CapacityQueryKind;
  readonly economicCategory?: ProductiveCategory;
  readonly serviceQualityClass?: ServiceQualityClass;
  readonly geographyId?: string;
  readonly serviceLocation?: string;
  readonly windowStartUnixSeconds: bigint;
  readonly windowEndUnixSeconds: bigint;
  readonly minAvailabilityAmount?: bigint;
  readonly minQualityClass?: ServiceQualityClass;
  readonly nowUnixSeconds: bigint;
  readonly rejectStaleEvidence?: boolean;
  readonly requireProvenance?: boolean;
};

export type CapacitySliceQueryResult = {
  readonly ok: true;
  readonly slices: readonly CapacitySlice[];
  readonly queriedAtUnixSeconds: bigint;
  readonly sourceCount: number;
};

export type CapacityQueryFailure = {
  readonly ok: false;
  readonly code: CapacityRejectionCode;
  readonly message: string;
};

export type CapacityQueryOutcome = CapacitySliceQueryResult | CapacityQueryFailure;

export type UtilizationQuery = {
  readonly productiveObjectRef: string;
  readonly measurementPeriod: MeasurementPeriod;
  readonly nowUnixSeconds: bigint;
};

export type UtilizationQueryResult = {
  readonly ok: true;
  readonly utilization: CapacityUtilization;
  readonly sliceId: string;
  readonly provenance: CapacityProvenanceRef;
};

export type UtilizationQueryOutcome = UtilizationQueryResult | CapacityQueryFailure;

export type ProductiveCapacityPortSnapshot = {
  readonly sliceCount: number;
  readonly sourceClass: CapacitySourceClass;
};
