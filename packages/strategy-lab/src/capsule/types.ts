import type { UtcInstant } from '../../../domain/src/time.ts';
import type { ModelId, ModelVersion } from '../../../model-registry/src/ids.ts';
import type {
  StrategyCapsuleId,
  StrategyCapsuleVersion,
  StrategyFamilyId,
} from './ids.ts';

export const STRATEGY_CAPSULE_SCOPES = ['GLOBAL', 'CUSTOMER_SCOPED'] as const;
export type StrategyCapsuleScope = (typeof STRATEGY_CAPSULE_SCOPES)[number];

export const STRATEGY_CAPSULE_ENVIRONMENTS = ['simulation', 'PAPER'] as const;
export type StrategyCapsuleEnvironment = (typeof STRATEGY_CAPSULE_ENVIRONMENTS)[number];

/** Qualification state owned by Strategy Lab. H18 owns promotion behavior. */
export const STRATEGY_CAPSULE_QUALIFICATION_STATES = [
  'DRAFT',
  'RESEARCH_ONLY',
  'EVALUATION_PENDING',
  'EVALUATING',
  'EVALUATION_FAILED',
  'SHADOW_ELIGIBLE',
  'SHADOW_ACTIVE',
  'PAPER_ELIGIBLE',
  'PAPER_ACTIVE',
  'PAUSED',
  'REVIEW_REQUIRED',
  'EXPIRED',
  'REVOKED',
] as const;

export type StrategyCapsuleQualificationState =
  (typeof STRATEGY_CAPSULE_QUALIFICATION_STATES)[number];

export const TERMINAL_CAPSULE_QUALIFICATION_STATES = [
  'EVALUATION_FAILED',
  'EXPIRED',
  'REVOKED',
] as const;

export type StrategyCapsuleDescription = {
  readonly strategyName: string;
  readonly hypothesis: string;
  readonly economicRationale: string;
  readonly intendedEdge: string;
  readonly expectedOperatingRegime: string;
  readonly knownFailureModes: readonly string[];
};

export type InstrumentUniverseSpec = {
  readonly supportedInstrumentClasses: readonly string[];
  readonly instrumentIds: readonly string[];
  readonly universeSelectionRules: readonly string[];
  readonly venues: readonly string[];
  readonly currencies: readonly string[];
  readonly liquidityRequirements: readonly string[];
  readonly eligibilityRestrictions: readonly string[];
};

export type FeatureSpecification = {
  readonly featureIds: readonly string[];
  readonly dataDependencies: readonly string[];
  readonly observationTypes: readonly string[];
  readonly lookbackWindows: readonly string[];
  readonly normalizationRules: readonly string[];
  readonly transformationVersions: readonly string[];
  readonly sourceProviderRequirements: readonly string[];
  readonly freshnessRequirements: readonly string[];
};

export type GrokModelDependency = {
  readonly modelId: string;
  readonly version: string;
  readonly role: 'research_only';
};

export type S3mProfileDependency = {
  readonly profileId: string;
  readonly version: string;
};

export type QuantitativeModelDependency = {
  readonly modelId: ModelId;
  readonly version: ModelVersion;
};

export type StrategyCapsuleModelDependencies = {
  readonly grok: readonly GrokModelDependency[];
  readonly s3m: readonly S3mProfileDependency[];
  readonly quantitative: readonly QuantitativeModelDependency[];
  readonly deterministicRuleId: string;
  readonly deterministicRuleVersion: string;
  readonly featureEngineVersion: string;
};

export type DeterministicDecisionRule = {
  readonly ruleType: string;
  readonly entryRule: Record<string, unknown>;
  readonly noActionRule: Record<string, unknown>;
  readonly exitRule: Record<string, unknown>;
  readonly invalidationRule: Record<string, unknown>;
  readonly positionSizingRule: Record<string, unknown>;
  readonly maximumExposureAssumptions: Record<string, unknown>;
  readonly minimumEvidenceRequirements: Record<string, unknown>;
};

export type OperatingAssumptions = {
  readonly marketHours: readonly string[];
  readonly minimumLiquidity: string;
  readonly quoteRequirements: readonly string[];
  readonly spreadLimitsBps: number;
  readonly dataDelayAssumptionMs: number;
  readonly maximumObservationAgeMs: number;
  readonly orderTypeAssumptions: readonly string[];
  readonly executionModelAssumptions: readonly string[];
  readonly accountSizeLimits: Record<string, string>;
  readonly capacityAssumptions: readonly string[];
};

export type StrategyCapsuleCostModel = {
  readonly commissionMinorPerShare: string;
  readonly spreadBps: number;
  readonly slippageBps: number;
  readonly exchangeFeesBps: number;
  readonly fundingBorrowCostBps: number;
  readonly marketDataCostAllocation: string;
  readonly inferenceResearchCostAllocation: string;
  readonly zeroCostForbidden: true;
};

export type StrategyCapsuleEvidence = {
  readonly researchResultRefs: readonly string[];
  readonly observationRefs: readonly string[];
  readonly provenanceRefs: readonly string[];
  readonly sourceIndependenceNotes: readonly string[];
  readonly knownContradictions: readonly string[];
  readonly rejectedEvidenceRefs: readonly string[];
  readonly evidenceVaultRefs: readonly string[];
};

export type StrategyCapsuleValidity = {
  readonly validFrom: UtcInstant | null;
  readonly expiresAt: UtcInstant | null;
  readonly regimeConstraints: readonly string[];
  readonly invalidatingConditions: readonly string[];
  readonly modelVersionCompatibility: readonly string[];
  readonly dataVersionCompatibility: readonly string[];
};

/** M13 market regime gating — strategies declare allowed/prohibited/preferred regime dimensions. */
export type MarketRegimePreferences = {
  readonly permittedRegimes: readonly string[];
  readonly prohibitedRegimes: readonly string[];
  readonly preferredRegimes: readonly string[];
};

/** Fixed limits established during qualification. Runtime may narrow, never widen. */
export type FixedQualifiedParameters = {
  readonly maximumPortfolioAllocationPct: string;
  readonly maximumPositionSizeUnits: string;
  readonly maximumConcurrentPositions: number;
  readonly horizonDays: number;
};

export type StrategyCapsuleLineage = {
  readonly workOrderId: string | null;
  readonly researchLineageRefs: readonly string[];
  readonly parentProposalIds: readonly string[];
};

export type StrategyCapsuleMaterial = {
  readonly description: StrategyCapsuleDescription;
  readonly instrumentUniverse: InstrumentUniverseSpec;
  readonly featureSpecification: FeatureSpecification;
  readonly modelDependencies: StrategyCapsuleModelDependencies;
  readonly decisionRule: DeterministicDecisionRule;
  readonly operatingAssumptions: OperatingAssumptions;
  readonly costModel: StrategyCapsuleCostModel;
  readonly validity: StrategyCapsuleValidity;
  readonly marketRegimePreferences: MarketRegimePreferences;
  readonly fixedQualifiedParameters: FixedQualifiedParameters;
};

export type StrategyCapsuleRecord = {
  readonly strategyCapsuleId: StrategyCapsuleId;
  readonly strategyFamilyId: StrategyFamilyId;
  readonly version: StrategyCapsuleVersion;
  readonly parentVersion: StrategyCapsuleVersion | null;
  readonly scope: StrategyCapsuleScope;
  readonly customerId: string | null;
  readonly environment: StrategyCapsuleEnvironment;
  readonly createdAt: UtcInstant;
  readonly createdBy: string;
  readonly lineage: StrategyCapsuleLineage;
  readonly material: StrategyCapsuleMaterial;
  readonly evidence: StrategyCapsuleEvidence;
  readonly qualificationState: StrategyCapsuleQualificationState;
  readonly qualificationAt: UtcInstant | null;
  readonly materialHash: string;
  readonly frozen: boolean;
  readonly evaluationRefs: readonly string[];
  readonly simulationOnly: true;
  readonly llmDeployable: false;
};

export type StrategyCapsuleFailure = {
  readonly code:
    | 'INVALID_SCOPE'
    | 'CUSTOMER_LEAKAGE'
    | 'FROZEN_IMMUTABLE'
    | 'INVALID_TRANSITION'
    | 'REVOKED'
    | 'EXPIRED'
    | 'PROMOTION_REQUIRES_REVIEW'
    | 'ACTIVATION_FORBIDDEN'
    | 'MATERIAL_UNCHANGED'
    | 'NOT_FOUND'
    | 'LLM_DEPLOYMENT_FORBIDDEN';
  readonly message: string;
};

export type StrategyCapsuleComparison = {
  readonly leftVersion: StrategyCapsuleVersion;
  readonly rightVersion: StrategyCapsuleVersion;
  readonly materialHashEqual: boolean;
  readonly qualificationEqual: boolean;
  readonly changedSections: readonly string[];
};
