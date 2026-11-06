import type { UtcInstant } from '@solstice/domain';

import type {
  HELIOS_VALUATION_INTELLIGENCE_AUTHORITY,
  HELIOS_VALUATION_INTELLIGENCE_SCHEMA,
} from '../taxonomy.ts';
import type {
  CompanyCharacteristicTag,
  IntrinsicEnsembleMethod,
  MarketReferencedEnsembleMethod,
  ValuationEnsembleLane,
  VAL11_ENSEMBLE_SCHEMA,
} from './taxonomy.ts';

export type EnsembleValueQuantile = {
  readonly quantile: string;
  readonly equityValuePerShareMinor: bigint | null;
  readonly enterpriseValueMinor: bigint | null;
};

export type IntrinsicModelCandidate = {
  readonly candidateId: string;
  readonly lane: 'INTRINSIC';
  readonly method: IntrinsicEnsembleMethod;
  readonly applicable: boolean;
  readonly applicabilityScore: number;
  readonly uncertaintyScore: number;
  readonly equityValuePerShareMinor: bigint | null;
  readonly enterpriseValueMinor: bigint | null;
  readonly quantiles: readonly EnsembleValueQuantile[];
  readonly inputKeysUsed: readonly string[];
  readonly grantsExecutionAuthority: false;
  readonly researchOnly: true;
  readonly notAFact: true;
};

export type MarketReferencedModelCandidate = {
  readonly candidateId: string;
  readonly lane: 'MARKET_REFERENCED';
  readonly method: MarketReferencedEnsembleMethod;
  readonly applicable: boolean;
  readonly applicabilityScore: number;
  readonly uncertaintyScore: number;
  readonly equityValuePerShareMinor: bigint | null;
  readonly enterpriseValueMinor: bigint | null;
  readonly quantiles: readonly EnsembleValueQuantile[];
  readonly inputKeysUsed: readonly string[];
  readonly grantsExecutionAuthority: false;
  readonly researchOnly: true;
  readonly notAFact: true;
};

export type ModelApplicabilityState = {
  readonly method: IntrinsicEnsembleMethod | MarketReferencedEnsembleMethod;
  readonly lane: ValuationEnsembleLane;
  readonly economicallyValid: boolean;
  readonly applicabilityScore: number;
  readonly reasons: readonly string[];
  readonly characteristicDrivers: readonly CompanyCharacteristicTag[];
};

export type ModelReliabilityMetrics = {
  readonly inputForecastAccuracy: number | null;
  readonly cashFlowForecastAccuracy: number | null;
  readonly marginForecastAccuracy: number | null;
  readonly modelStability: number | null;
  readonly terminalDependence: number | null;
  readonly dataQuality: number | null;
  readonly assumptionPlausibility: number | null;
  readonly historicalSampleCount: number;
  /** Explicitly not trained on future stock returns. */
  readonly trainedOnFutureReturns: false;
};

export type ModelReliabilityState = {
  readonly method: IntrinsicEnsembleMethod | MarketReferencedEnsembleMethod;
  readonly lane: ValuationEnsembleLane;
  readonly metrics: ModelReliabilityMetrics;
  readonly compositeReliability: number;
  readonly shrinkageApplied: number;
  readonly evidenceAsOf: UtcInstant;
};

export type ModelWeight = {
  readonly method: IntrinsicEnsembleMethod | MarketReferencedEnsembleMethod;
  readonly lane: ValuationEnsembleLane;
  readonly priorWeight: number;
  readonly posteriorWeight: number;
  readonly rationale: readonly string[];
};

export type ModelDisagreement = {
  readonly lane: ValuationEnsembleLane;
  readonly methodSpreadMinor: bigint | null;
  readonly coefficientOfVariation: number | null;
  readonly pairwiseDivergence: readonly {
    readonly methodA: string;
    readonly methodB: string;
    readonly divergenceRatio: number | null;
  }[];
  readonly interpretation: readonly string[];
};

export type IndependentIntrinsicValueDistribution = {
  readonly distributionId: string;
  readonly lane: 'INTRINSIC';
  readonly currency: string;
  readonly meanEquityPerShareMinor: bigint | null;
  readonly medianEquityPerShareMinor: bigint | null;
  readonly quantiles: readonly EnsembleValueQuantile[];
  readonly modelWeights: readonly ModelWeight[];
  readonly contributingMethods: readonly IntrinsicEnsembleMethod[];
  readonly notAFact: true;
  readonly researchOnly: true;
  readonly grantsExecutionAuthority: false;
  readonly noMarketPriceInput: true;
};

export type MarketReferencedValueDistribution = {
  readonly distributionId: string;
  readonly lane: 'MARKET_REFERENCED';
  readonly currency: string;
  readonly meanEquityPerShareMinor: bigint | null;
  readonly medianEquityPerShareMinor: bigint | null;
  readonly quantiles: readonly EnsembleValueQuantile[];
  readonly modelWeights: readonly ModelWeight[];
  readonly contributingMethods: readonly MarketReferencedEnsembleMethod[];
  readonly notAFact: true;
  readonly researchOnly: true;
  readonly grantsExecutionAuthority: false;
};

export type ValuationReconciliation = {
  readonly reconciliationId: string;
  readonly intrinsicMedianMinor: bigint | null;
  readonly marketReferencedMedianMinor: bigint | null;
  readonly gapMinor: bigint | null;
  readonly gapDirection: 'INTRINSIC_ABOVE_MARKET' | 'MARKET_ABOVE_INTRINSIC' | 'ALIGNED' | 'UNKNOWN';
  readonly explanatoryFactors: readonly string[];
  readonly lanesAveraged: false;
  readonly notAFact: true;
  readonly researchOnly: true;
  readonly grantsExecutionAuthority: false;
};

export type ModelChallengerCase = {
  readonly caseId: string;
  readonly prompt: string;
  readonly perturbedAssumption: string;
  readonly intrinsicDistribution: IndependentIntrinsicValueDistribution;
  readonly marketReferencedDistribution: MarketReferencedValueDistribution;
};

export type ValuationEnsembleState = {
  readonly schema: typeof VAL11_ENSEMBLE_SCHEMA;
  readonly valuationSchema: typeof HELIOS_VALUATION_INTELLIGENCE_SCHEMA;
  readonly authority: typeof HELIOS_VALUATION_INTELLIGENCE_AUTHORITY;
  readonly ensembleId: string;
  readonly entityId: string;
  readonly evaluationTime: UtcInstant;
  readonly compiledAt: UtcInstant;
  readonly characteristicTags: readonly CompanyCharacteristicTag[];
  readonly intrinsicCandidates: readonly IntrinsicModelCandidate[];
  readonly marketReferencedCandidates: readonly MarketReferencedModelCandidate[];
  readonly applicabilityStates: readonly ModelApplicabilityState[];
  readonly reliabilityStates: readonly ModelReliabilityState[];
  readonly modelWeights: readonly ModelWeight[];
  readonly disagreement: readonly ModelDisagreement[];
  readonly intrinsicDistribution: IndependentIntrinsicValueDistribution;
  readonly marketReferencedDistribution: MarketReferencedValueDistribution;
  readonly reconciliation: ValuationReconciliation;
  readonly challengerCases: readonly ModelChallengerCase[];
  readonly grantsExecutionAuthority: false;
  readonly researchOnly: true;
  readonly notAFact: true;
  readonly opaqueAiPriceTarget: false;
};

export type ModelTrustLedgerEntry = {
  readonly entryId: string;
  readonly method: IntrinsicEnsembleMethod | MarketReferencedEnsembleMethod;
  readonly lane: ValuationEnsembleLane;
  readonly evaluationTime: UtcInstant;
  readonly reliability: ModelReliabilityState;
  readonly applicability: ModelApplicabilityState;
  readonly sealedAt: UtcInstant;
  readonly selfModifying: false;
};

export type ModelTrustLedger = {
  readonly ledgerId: string;
  readonly entityId: string;
  readonly entries: readonly ModelTrustLedgerEntry[];
  readonly appendOnly: true;
  readonly grantsExecutionAuthority: false;
  readonly researchOnly: true;
};
