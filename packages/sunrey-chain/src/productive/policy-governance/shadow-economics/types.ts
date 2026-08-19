/**
 * Chunk 126 — shadow comparison, migration, and stress types.
 *
 * GPUV is not MoonRey. A V2 candidate quantity is not an issuance.
 * Shadow evaluation never mutates canonical MoonRey supply.
 */

import type { ClaimType, ProductiveCategory } from '../../types.ts';
import type { ExactRational, RealizationState, ValueFactorType } from '../value-function/types.ts';
import type {
  GOVERNED_PRODUCTIVE_VALUE_SIMULATION_V2,
  LEGACY_ENGINEERING_SIMULATION_V1,
  PRODUCTION_VALUE_PATH,
} from './identities.ts';

export const SHADOW_REASON_CODES = [
  'V1_VALUED',
  'V2_VALUED',
  'V1_CLAIM_NOT_VALUED',
  'V2_REALIZATION_NOT_ELIGIBLE',
  'V2_CLAIM_NOT_ELIGIBLE',
  'V2_CATEGORY_NOT_ELIGIBLE',
  'V2_REQUIRED_FACTOR_MISSING',
  'V2_REQUIRED_EVIDENCE_MISSING',
  'V2_ATTRIBUTION_REQUIRED',
  'V2_ATTRIBUTION_BYPASS_REJECTED',
  'V2_FACTOR_CAP_BYPASS_REJECTED',
  'V2_CONVERSION_CAP_APPLIED',
  'V2_CONVERSION_CAP_BYPASS_REJECTED',
  'V2_FORBIDDEN_INPUT',
  'V2_FAKE_SCARCITY_REJECTED',
  'V2_FAKE_UTILIZATION_REJECTED',
  'V2_STALE_REFERENCE',
  'V2_CONFLICTING_REFERENCE_FACTS',
  'V2_UNIT_ALIAS_MANIPULATION',
  'V2_NORMALIZATION_VERSION_MISMATCH',
  'V2_DUPLICATE_CLAIM',
  'V2_RELABELING_REJECTED',
  'V2_PROVIDER_COLLUSION',
  'V2_SINGLE_PROVIDER_DOMINANCE',
  'V2_REPLAY_NO_INCREMENT',
  'V2_FEEDBACK_LOOP_REJECTED',
  'V1_CAP_APPLIED',
  'V2_CAP_APPLIED',
  'SHADOW_SUPPLY_UNCHANGED',
  'V2_PRODUCTION_INACTIVE',
  'VALUES_NOT_FABRICATED',
] as const;
export type ShadowReasonCode = (typeof SHADOW_REASON_CODES)[number];

export const ADVERSARIAL_SCENARIO_KINDS = [
  'FAKE_SCARCITY',
  'FAKE_UTILIZATION',
  'DUPLICATE_CLAIMS',
  'CROSS_CATEGORY_RELABELING',
  'OBJECT_RELABELING',
  'CONTROLLER_RELABELING',
  'BATCH_SPLITTING',
  'TIME_WINDOW_SPLITTING',
  'PROVIDER_COLLUSION',
  'SINGLE_PROVIDER_DOMINANCE',
  'STALE_REFERENCES',
  'CONFLICTING_REFERENCE_FACTS',
  'UNIT_ALIAS_MANIPULATION',
  'NORMALIZATION_VERSION_MISMATCH',
  'ATTRIBUTION_BYPASS',
  'VALUE_FACTOR_CAP_BYPASS',
  'CONVERSION_CAP_BYPASS',
  'REVALUATION_REPLAY',
  'SETTLEMENT_REPLAY',
] as const;
export type AdversarialScenarioKind = (typeof ADVERSARIAL_SCENARIO_KINDS)[number];

export type ShadowFactorEvidence = {
  readonly quality?: bigint;
  readonly freshnessAgeEpochs?: bigint;
  readonly freshnessMaxAgeEpochs?: bigint;
  readonly sourceIndependence?: bigint;
  readonly provenanceConfidence?: bigint;
  readonly utilizationActual?: bigint;
  readonly utilizationBasis?: bigint;
  readonly scarcity?: bigint;
  readonly scarcityEvidenced?: boolean;
  readonly geography?: bigint;
  readonly geographyEvidenced?: boolean;
  readonly delivery?: bigint;
  readonly category?: bigint;
  readonly concentration?: bigint;
  readonly realization?: bigint;
  readonly claimState?: bigint;
};

export type ShadowPoisonFlags = {
  readonly moonreyMarketPriceSelfReference?: boolean;
  readonly issuanceQuantityAsScarcity?: boolean;
  readonly rawHttpData?: boolean;
  readonly fabricatedScarcity?: boolean;
  readonly fabricatedUtilization?: boolean;
  readonly providerSelfReportedUtilization?: boolean;
  readonly conflictingReferenceFacts?: boolean;
  readonly unitAliasManipulation?: boolean;
  readonly normalizationVersionMismatch?: boolean;
  readonly missingAttribution?: boolean;
  readonly factorAboveCap?: boolean;
  readonly conversionAboveCap?: boolean;
  readonly staleReference?: boolean;
  readonly categoryRelabel?: ProductiveCategory;
  readonly objectRelabel?: string;
  readonly controllerRelabel?: string;
  readonly duplicateOfEventId?: string;
};

export type MoonReyShadowScenario = {
  readonly scenarioId: string;
  readonly eventId: string;
  readonly contributionId: string;
  readonly category: ProductiveCategory;
  readonly claimType: ClaimType;
  readonly realizationState: RealizationState;
  readonly objectId: string;
  readonly controllerId: string;
  readonly geographyId: string;
  readonly jurisdiction: string;
  readonly sourceProviderClass: string;
  readonly providerIds: readonly string[];
  readonly canonicalQuantity: bigint;
  readonly canonicalUnit: string;
  readonly normalizationVersion: string;
  readonly eventIdentityVersion: string;
  readonly attributionPolicyId: string;
  readonly attributionPolicyVersion: string;
  readonly attributionShare: ExactRational;
  readonly valuePolicyId: string;
  readonly valuePolicyVersion: number;
  readonly conversionPolicyId: string;
  readonly conversionPolicyVersion: number;
  readonly conversionRate: bigint;
  readonly conversionCap: bigint;
  readonly v1PolicyVersion: number;
  readonly v1MaximumIssuance: bigint;
  readonly evidence: ShadowFactorEvidence;
  readonly poison?: ShadowPoisonFlags;
  readonly batchLineage?: readonly string[];
  readonly replayAttempt?: number;
};

export type PathValuation = {
  readonly valued: boolean;
  readonly quantity: bigint | null;
  readonly reasonCodes: readonly ShadowReasonCode[];
};

export type MoonReyValuePathComparison = {
  readonly scenarioId: string;
  readonly eventId: string;
  readonly contributionId: string;
  readonly category: ProductiveCategory;
  readonly claimType: ClaimType;
  readonly canonicalMeasurement: {
    readonly quantity: bigint;
    readonly unit: string;
    readonly normalizationVersion: string;
  };
  readonly v1Path: typeof LEGACY_ENGINEERING_SIMULATION_V1;
  readonly v1PolicyVersion: number;
  readonly v1Quantity: bigint | null;
  readonly v1Valued: boolean;
  readonly v2Path: typeof GOVERNED_PRODUCTIVE_VALUE_SIMULATION_V2;
  readonly v2ValuePolicyId: string;
  readonly v2ValuePolicyVersion: number;
  readonly v2GpuvValue: bigint | null;
  readonly v2ConversionPolicyId: string;
  readonly v2ConversionPolicyVersion: number;
  readonly v2MoonReyCandidateQuantity: bigint | null;
  readonly v2Valued: boolean;
  readonly absoluteDelta: bigint | null;
  readonly relativeDeltaBps: bigint | null;
  readonly attributionShare: ExactRational;
  readonly capAppliedV1: boolean;
  readonly capAppliedV2: boolean;
  readonly reasonCodes: readonly ShadowReasonCode[];
  readonly warnings: readonly string[];
  readonly supplyMutated: false;
  readonly productionPath: typeof PRODUCTION_VALUE_PATH;
  readonly v2ProductionActive: false;
};

export type DistributionBucket = {
  readonly key: string;
  readonly v1Quantity: bigint;
  readonly v2CandidateQuantity: bigint;
  readonly count: number;
  readonly unvaluedV1: number;
  readonly unvaluedV2: number;
};

export type ConcentrationShare = {
  readonly key: string;
  readonly quantity: bigint;
  readonly shareBps: bigint;
};

export type MoonReyShadowDistributionReport = {
  readonly classification: 'ENGINEERING_ECONOMIC_SIMULATION';
  readonly marketForecast: false;
  readonly byCategory: readonly DistributionBucket[];
  readonly byObject: readonly DistributionBucket[];
  readonly byController: readonly DistributionBucket[];
  readonly byGeography: readonly DistributionBucket[];
  readonly bySourceProviderClass: readonly DistributionBucket[];
  readonly byClaimType: readonly DistributionBucket[];
  readonly byRealizationState: readonly DistributionBucket[];
  readonly topControllerConcentration: readonly ConcentrationShare[];
  readonly topObjectConcentration: readonly ConcentrationShare[];
  readonly topCategoryConcentration: readonly ConcentrationShare[];
};

export type MoonReyPathSupplyPressure = {
  readonly path: typeof LEGACY_ENGINEERING_SIMULATION_V1 | typeof GOVERNED_PRODUCTIVE_VALUE_SIMULATION_V2;
  readonly candidateIssuance: bigint;
  readonly minCandidate: bigint;
  readonly maxCandidate: bigint;
  readonly byCategory: Readonly<Record<string, bigint>>;
  readonly supplyMutated: false;
  readonly futurePriceProjection: false;
};

export type MoonReyShadowSupplyPressureReport = {
  readonly classification: 'ENGINEERING_ECONOMIC_SIMULATION';
  readonly v1: MoonReyPathSupplyPressure;
  readonly v2: MoonReyPathSupplyPressure;
  readonly rangeNote: 'Ranges are simulation observations, not promises.';
  readonly canonicalSupplyMutated: false;
};

export type AdversarialOutcome = {
  readonly kind: AdversarialScenarioKind;
  readonly rejectedOrCapped: boolean;
  readonly inflatedRelativeToHonest: boolean;
  readonly reasonCodes: readonly ShadowReasonCode[];
  readonly detail: string;
};

export type SensitivityFactorName =
  | 'scarcity'
  | 'utilization'
  | 'quality'
  | 'freshness'
  | 'geography'
  | 'concentration'
  | 'attribution';

export type SensitivityObservation = {
  readonly factor: SensitivityFactorName;
  readonly baseOutput: bigint;
  readonly perturbedOutput: bigint;
  readonly factorDeltaBps: bigint;
  readonly outputDeltaBps: bigint | null;
  readonly extremeSensitivity: boolean;
};

export type FeedbackLoopFinding = {
  readonly rejected: boolean;
  readonly loops: readonly string[];
  readonly reasonCodes: readonly ShadowReasonCode[];
};

export type MoonReyV2MigrationReadinessReport = {
  readonly canonicalUnitsReady: boolean;
  readonly sourceTaxonomyReady: boolean;
  readonly eventIdentityReady: boolean;
  readonly attributionReady: boolean;
  readonly valueEngineReady: boolean;
  readonly conversionBridgeReady: boolean;
  readonly monetaryAuthorityReady: boolean;
  readonly supplyReconciliationReady: boolean;
  readonly allCategoriesReviewed: boolean;
  readonly adversarialTestsPassing: boolean;
  readonly feedbackLoopCheckPassing: boolean;
  readonly productionParametersConfigured: false;
  readonly productionMigrationApproved: false;
};

export type LegacyV1DeprecationStatus = {
  readonly pathClass: typeof LEGACY_ENGINEERING_SIMULATION_V1;
  readonly productionEconomics: false;
  readonly deleted: false;
  readonly automaticRemovalDate: null;
  readonly deprecationRequested: boolean;
  readonly removalRequiresExplicitGovernance: true;
};

export type HistoricV1Receipt = {
  readonly schema: 'moonrey.v1.legacy-receipt.v1';
  readonly pathClass: typeof LEGACY_ENGINEERING_SIMULATION_V1;
  readonly formulaVersion: 'moonrey.issuance.formula.v1';
  readonly eligibleQuantity: bigint;
  readonly categoryWeight: bigint;
  readonly claimTypeWeight: bigint;
  readonly qualityFactor: bigint;
  readonly roundingMode: 'FLOOR' | 'CEIL' | 'ROUND_HALF_EVEN';
  readonly maximumIssuance: bigint;
  readonly moonreyQuantity: bigint;
  readonly contentHash: string;
};

export type HistoricV2Receipt = {
  readonly schema: 'moonrey.v2.shadow-receipt.v1';
  readonly pathClass: typeof GOVERNED_PRODUCTIVE_VALUE_SIMULATION_V2;
  readonly normalizationVersion: string;
  readonly eventIdentityVersion: string;
  readonly attributionPolicyId: string;
  readonly attributionPolicyVersion: string;
  readonly valuePolicyId: string;
  readonly valuePolicyVersion: number;
  readonly conversionPolicyId: string;
  readonly conversionPolicyVersion: number;
  readonly gpuvValue: bigint;
  readonly moonreyCandidateQuantity: bigint;
  readonly contentHash: string;
};

export type ShadowInvariantName =
  | 'LOWER_ATTRIBUTION_CANNOT_INCREASE_VALUE'
  | 'LOWER_QUALITY_CANNOT_INCREASE_VALUE'
  | 'STALER_EVIDENCE_CANNOT_INCREASE_FRESHNESS'
  | 'STRICTER_CAP_CANNOT_INCREASE_OUTPUT'
  | 'REPLAY_CANNOT_INCREASE_ATTRIBUTION'
  | 'SHADOW_CANNOT_CHANGE_SUPPLY'
  | 'PRODUCTION_INACTIVE_REMAINS_TRUE';

export type FactorType = ValueFactorType;
