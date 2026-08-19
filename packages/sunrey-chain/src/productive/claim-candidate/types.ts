import type { UnitCode, VerifiedEconomicFact } from '../../oracle/types.ts';
import type {
  AttributionState,
  SourceProductiveMapping,
} from '../../oracle/source-taxonomy/types.ts';
import type { CanonicalProductiveMeasurement } from '../../units/measurement.ts';
import type { ExactQuantity, NormalizationReceipt, ResourceClass, SemanticQualifier } from '../../units/index.ts';
import type { ProductiveEconomicObject } from '../objects.ts';
import type { ClaimType, GeographyRef, MeasurementPeriod, ProductiveCategory } from '../types.ts';

export const CLAIM_CANDIDATE_SCHEMA_VERSION = 2 as const;

export type ProductiveClaimCandidate = {
  readonly schemaVersion: typeof CLAIM_CANDIDATE_SCHEMA_VERSION;
  readonly candidateId: string;
  readonly objectId: string;
  readonly factId: string;
  readonly mappingId: string;
  readonly mappingVersion: number;
  readonly productiveCategory: ProductiveCategory;
  readonly proposedClaimType: ClaimType;
  readonly quantity: bigint;
  readonly sourceUnit: UnitCode;
  readonly sourceQuantity: ExactQuantity;
  readonly canonicalUnit: string;
  readonly canonicalQuantity: ExactQuantity;
  readonly normalizationReceiptId: string;
  readonly normalizationReceiptDigest: string;
  readonly normalizationConstitutionVersion: string;
  readonly canonicalMeasurement: CanonicalProductiveMeasurement;
  readonly measurementPeriod: MeasurementPeriod;
  readonly geography: GeographyRef;
  readonly rightsReferences: readonly string[];
  readonly oracleReferences: {
    readonly feedId: string;
    readonly factId: string;
    readonly sourceObservationIds: readonly string[];
    readonly sourceId: string | null;
  };
  readonly automaticIssuance: false;
  readonly verified: false;
  readonly issued: false;
  readonly attributionState: AttributionState;
  readonly attributionPolicyRef: string | null;
  readonly lineageAssetIds: readonly string[];
};

export type ClaimCandidateBuildInput = {
  readonly object: ProductiveEconomicObject;
  readonly fact: VerifiedEconomicFact;
  readonly mapping: SourceProductiveMapping;
  readonly sourceCategory: string;
  readonly factType: string;
  readonly proposedClaimType: ClaimType;
  readonly nowUnix: bigint;
  readonly measurementPeriod: MeasurementPeriod | null;
  readonly geography: GeographyRef | null;
  readonly rightsReferences: readonly string[];
  readonly sourceId: string | null;
  readonly attributionPolicyRef: string | null;
  readonly requireApprovedAttributionPolicy: boolean;
  readonly quorumCount: number | null;
  readonly resourceClass?: ResourceClass;
  readonly semanticQualifier?: SemanticQualifier;
  readonly durationSeconds?: bigint;
  readonly providedMeasurement?: CanonicalProductiveMeasurement;
  readonly substitutedCanonicalQuantity?: ExactQuantity;
  readonly providedReceipt?: NormalizationReceipt;
};

export function candidateCannotVerify(candidate: ProductiveClaimCandidate): false {
  void candidate;
  return false;
}

export function candidateCannotIssue(candidate: ProductiveClaimCandidate): false {
  void candidate;
  return false;
}

export function candidateAutomaticIssuance(): false {
  return false;
}
