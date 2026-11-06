import type {
  CrossModelMethod,
  TerminalValueDependenceSeverity,
  ValuationConfidenceLevel,
  ValuationUncertaintySourceId,
  VAL10_UNCERTAINTY_ENGINE_SCHEMA,
} from './taxonomy.ts';

export type { ValuationConfidenceLevel, TerminalValueDependenceSeverity } from './taxonomy.ts';

export type ValuationUncertaintySource = {
  readonly source: ValuationUncertaintySourceId;
  readonly label: string;
  readonly varianceShare: number;
  readonly rankCorrelation: number;
  readonly partialRankCorrelation: number | null;
  readonly notes: readonly string[];
};

export type AssumptionSensitivity = {
  readonly assumptionKey: string;
  readonly uncertaintySource: ValuationUncertaintySourceId;
  readonly rankCorrelation: number;
  readonly partialRankCorrelation: number | null;
  readonly elasticityAtMedian: number | null;
};

export type VarianceContribution = {
  readonly source: ValuationUncertaintySourceId;
  readonly fractionOfExplainedVariance: number;
  readonly absoluteVarianceShare: number;
  readonly method: 'RANK_CORRELATION' | 'SOBOL_FIRST_ORDER';
};

export type TerminalValueDependence = {
  readonly terminalValueShareOfEnterpriseValue: number;
  readonly severity: TerminalValueDependenceSeverity;
  readonly medianPathShare: number;
  readonly distributionP05Share: number;
  readonly distributionP95Share: number;
};

export type FragilityDimension = {
  readonly dimension:
    | 'WACC'
    | 'GROWTH'
    | 'MARGIN'
    | 'ROIC'
    | 'REINVESTMENT'
    | 'PEER_SET'
    | 'TERMINAL_METHODOLOGY';
  readonly bumpDescription: string;
  readonly baseEnterpriseValue: number;
  readonly stressedEnterpriseValue: number;
  readonly relativeChange: number;
};

export type ValuationFragilityIndex = {
  readonly index: number;
  readonly dimensions: readonly FragilityDimension[];
};

export type ValuationFragilityState = {
  readonly fragility: ValuationFragilityIndex;
  readonly plausibleBumpPolicy: string;
};

export type AccountingValuationStateInput = {
  readonly stateId: string;
  readonly label: string;
  readonly revenueMultiplier: number;
  readonly marginAdjustment: number;
  readonly reinvestmentRateAdjustment: number;
  readonly rationale: readonly string[];
};

export type AccountingUncertaintySpread = {
  readonly states: readonly { readonly stateId: string; readonly enterpriseValue: number }[];
  readonly minEnterpriseValue: number;
  readonly maxEnterpriseValue: number;
  readonly spreadRatio: number;
};

export type CrossModelValueInput = {
  readonly method: CrossModelMethod;
  readonly enterpriseValue: number;
  readonly consistentWithReverseDcf: boolean | null;
};

export type CrossModelDispersion = {
  readonly values: readonly CrossModelValueInput[];
  readonly medianEnterpriseValue: number;
  readonly minEnterpriseValue: number;
  readonly maxEnterpriseValue: number;
  readonly coefficientOfVariation: number;
  readonly disagreementSeverity: 'LOW' | 'MODERATE' | 'HIGH';
  readonly reverseDcfConsistencyFailures: readonly CrossModelMethod[];
};

export type ModelRiskState = {
  readonly crossModel: CrossModelDispersion | null;
  readonly accountingSpread: AccountingUncertaintySpread | null;
};

export type ValuationConfidenceEnvelope = {
  readonly level: ValuationConfidenceLevel;
  readonly policyVersion: 'val10-confidence-v1';
  readonly drivers: readonly string[];
  readonly highConfidenceResearchBlocked: boolean;
};

export type ValuationUncertaintyState = {
  readonly totalEnterpriseValueVariance: number;
  readonly enterpriseValueStdDev: number;
  readonly sources: readonly ValuationUncertaintySource[];
  readonly assumptionSensitivities: readonly AssumptionSensitivity[];
  readonly varianceContributions: readonly VarianceContribution[];
  readonly sobolFirstOrder: readonly VarianceContribution[] | null;
};

export type Val10UncertaintyEngineInput = {
  readonly valuationId: string;
  readonly entityLabel: string;
  readonly probabilisticDcf: import('../val04-probabilistic-dcf/types.ts').ProbabilisticDcfInput;
  readonly crossModelValues?: readonly CrossModelValueInput[];
  readonly accountingStates?: readonly AccountingValuationStateInput[];
  readonly segmentUncertaintyNotes?: readonly string[];
  readonly macroUncertaintyNotes?: readonly string[];
  readonly dataQualityFlags?: readonly string[];
  readonly entityResolutionFlags?: readonly string[];
  readonly monteCarloPaths?: number;
  readonly seed?: number;
  readonly enableSobolSensitivity?: boolean;
};

export type Val10UncertaintyEngineResult = {
  readonly schema: typeof VAL10_UNCERTAINTY_ENGINE_SCHEMA;
  readonly valuationId: string;
  readonly entityLabel: string;
  readonly grantsExecutionAuthority: false;
  readonly researchOnly: true;
  readonly seed: number;
  readonly pathCount: number;
  readonly uncertainty: ValuationUncertaintyState;
  readonly terminalDependence: TerminalValueDependence;
  readonly fragility: ValuationFragilityState;
  readonly modelRisk: ModelRiskState;
  readonly confidence: ValuationConfidenceEnvelope;
  readonly qualificationMarker: 'HELIOS_VAL10_UNCERTAINTY_ENGINE_QUALIFIED';
};
