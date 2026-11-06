import type { UtcInstant } from '@solstice/domain';

import type { ValuationMethod } from '../taxonomy.ts';
import { HELIOS_VALUATION_INTELLIGENCE_SCHEMA } from '../taxonomy.ts';
import type { Val05ReverseDcfArtifact } from '../val05/types.ts';

export type ValuationDistributionSummary = {
  readonly p10Minor: bigint;
  readonly p50Minor: bigint;
  readonly p90Minor: bigint;
  readonly sampleCount: number;
};

export type ValuationGapSummary = {
  readonly medianValueGapMinor: bigint;
  readonly p10ValueGapMinor: bigint;
  readonly p90ValueGapMinor: bigint;
  readonly modelImpliedProbabilityValueAbovePrice: number;
  readonly modelImpliedProbabilityValueBelowPrice: number;
  readonly notObjectiveMispricingProbability: true;
  readonly researchEvidenceOnly: true;
};

export type ModelImpliedMarginOfSafety = {
  readonly probabilityValueAboveMarketPrice: number;
  readonly probabilityValueAboveMarketPrice120Pct: number;
  readonly probabilityValueBelowMarketPrice80Pct: number;
  readonly notGuaranteedReturnProbability: true;
  readonly researchEvidenceOnly: true;
};

export type ValuationAafQualification = {
  readonly pointInTimeCertified: boolean;
  readonly coverageOk: boolean;
  readonly missingnessOk: boolean;
  readonly biasSentinelOk: boolean;
  readonly lineageOk: boolean;
  readonly simulationOnly: true;
  readonly grantsExecutionAuthority: false;
};

export type ValuationResearchMonitorTrigger = {
  readonly monitorId: string;
  readonly reason: string;
  readonly severity: 'LOW' | 'MEDIUM' | 'HIGH';
  readonly routesTo: 'AGENT_RESEARCH';
  readonly grantsExecutionAuthority: false;
};

export type ValuationExtendedModelEvidence = {
  readonly schema: 'sunrey.helios.valuation-extended-model-evidence.v1';
  readonly val07ResidualIncomeRef: string;
  readonly val08ComparablesRef: string;
  readonly val09SotpRef: string;
  readonly val10UncertaintyRef: string;
  readonly val11EnsembleRef: string;
  readonly compiledAt: UtcInstant;
};

export type HeliosValuationState = {
  readonly schema: typeof HELIOS_VALUATION_INTELLIGENCE_SCHEMA;
  readonly stateId: string;
  readonly canonicalEntityId: string;
  readonly valuationTime: UtcInstant;
  readonly independentIntrinsicValueDistribution: ValuationDistributionSummary;
  readonly marketReferencedValueDistribution: ValuationDistributionSummary | null;
  readonly reverseDcfExpectations: Val05ReverseDcfArtifact | null;
  readonly segmentValueDistribution: Readonly<Record<string, ValuationDistributionSummary>>;
  readonly residualIncomeValueDistribution: ValuationDistributionSummary;
  readonly comparableValueDistribution: ValuationDistributionSummary;
  readonly crossModelDispersion: number;
  readonly valuationUncertainty: number;
  readonly fragility: number;
  readonly modelApplicability: Readonly<Record<string, number>>;
  readonly modelWeights: Readonly<Record<string, number>>;
  readonly marketPriceMinor: bigint | null;
  readonly valuationGap: ValuationGapSummary | null;
  readonly modelImpliedMarginOfSafety: ModelImpliedMarginOfSafety | null;
  readonly evidenceRefs: readonly string[];
  readonly extendedModelEvidence: ValuationExtendedModelEvidence;
  readonly AAFQualification: ValuationAafQualification;
  readonly confidence: number;
  readonly expirationTime: UtcInstant;
  readonly valuationQualityNotInvestmentAlpha: true;
  readonly grantsExecutionAuthority: false;
  readonly grantsFinancialMutation: false;
  readonly autoPromoteStrategyCandidates: false;
};

export type ValuationStrategyGenomeFeatureRow = {
  readonly featureId:
    | 'intrinsic_value_gap'
    | 'reverse_dcf_growth_gap'
    | 'reverse_dcf_margin_gap'
    | 'valuation_uncertainty'
    | 'valuation_fragility'
    | 'cross_model_dispersion'
    | 'residual_income_gap'
    | 'peer_relative_gap';
  readonly ratioDecimal: string | null;
  readonly valueMinor: bigint | null;
  readonly knowableAt: UtcInstant;
  readonly aafCertified: boolean;
  readonly coverageOk: boolean;
  readonly missingnessOk: boolean;
  readonly biasOk: boolean;
  readonly lineageOk: boolean;
};

export type ValuationBenchmarkRow = {
  readonly model: string;
  readonly forecastInputErrorBps: number;
  readonly valuationStabilityScore: number;
  readonly crossModelDispersion: number;
  readonly fundamentalAccuracyScore: number;
};

export type ValuationValidationReport = {
  readonly schema: typeof HELIOS_VALUATION_INTELLIGENCE_SCHEMA;
  readonly generatedAt: UtcInstant;
  readonly gitSha: string;
  readonly benchmarks: readonly ValuationBenchmarkRow[];
  readonly heliosVsSimpleDcfImprovementBps: number;
  readonly valuationQualityGate: ValuationRealityGateStatus;
  readonly investmentAlphaClaimed: false;
  readonly knowableAtViolations: number;
};

export type ValuationRealityGateStatus =
  | 'ARCHITECTURALLY_QUALIFIED'
  | 'VALUATION_QUALITY_QUALIFIED'
  | 'RESEARCH_ONLY';

export type ValuationPipelineStageResult = {
  readonly stage: string;
  readonly ok: boolean;
  readonly detail: string;
};

export type ValuationPipelineResult = {
  readonly ok: boolean;
  readonly stages: readonly ValuationPipelineStageResult[];
  readonly state: HeliosValuationState | null;
  readonly validationReport: ValuationValidationReport | null;
  readonly researchMonitors: readonly ValuationResearchMonitorTrigger[];
  readonly strategyGenomeFeatures: readonly ValuationStrategyGenomeFeatureRow[];
  readonly evidenceRef: string | null;
};

export type ValuationMethodMedians = Readonly<Partial<Record<ValuationMethod, number>>>;
