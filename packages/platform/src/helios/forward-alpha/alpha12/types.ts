import type {
  ALPHA12_CAPACITY_ENGINE_SCHEMA,
  ALPHA12_CAPITAL_SCALE_MULTIPLIERS,
  Alpha12CapacityClassification,
  Alpha12CapitalScaleMultiplier,
} from './taxonomy.ts';

export type StrategyLiquidityLeg = {
  readonly legId: string;
  readonly instrumentId: string;
  readonly venueId: string;
  readonly weightBps: number;
  readonly advNotionalMinor: string;
  readonly marketDepthNotionalMinor: string;
  readonly spreadBps: number;
  readonly maxParticipationRateBps: number;
  readonly venueAdvNotionalMinor: string;
};

export type Alpha12ImpactModelConfig = {
  readonly version: string;
  readonly sqrtImpactCoeffBps: number;
  readonly temporaryImpactDecay: number;
  readonly permanentImpactCoeffBps: number;
  readonly maxImpactBps: number;
};

export type Alpha12CapacityEngineInput = {
  readonly strategyId: string;
  readonly campaignShadowCapitalMinor: string;
  readonly currency: string;
  /** Gross edge at shadow capital — bps on deployed notional, not dollar-linear at scale. */
  readonly baselineGrossAlphaBps: number;
  readonly annualTurnoverRatio: number;
  readonly executionDurationHours: number;
  readonly commissionBpsPerSide: number;
  readonly legs: readonly StrategyLiquidityLeg[];
  readonly impactModel: Alpha12ImpactModelConfig;
};

export type CapitalScaleScenario = {
  readonly scaleMultiplier: Alpha12CapitalScaleMultiplier;
  readonly liquidityPermitted: boolean;
  readonly deployedCapitalMinor: string;
  readonly effectiveParticipationRateBps: number;
  readonly grossAlphaMinor: string;
  readonly grossAlphaBps: number;
  readonly estimatedTradingCostMinor: string;
  readonly estimatedTradingCostBps: number;
  readonly estimatedImpactMinor: string;
  readonly estimatedImpactBps: number;
  readonly netAlphaMinor: string;
  readonly netAlphaBps: number;
  readonly signalRetentionFactor: number;
  readonly notes: readonly string[];
};

export type ImpactAdjustedAlpha = {
  readonly scaleMultiplier: Alpha12CapitalScaleMultiplier;
  readonly grossAlphaBps: number;
  readonly grossAlphaMinor: string;
  readonly impactBps: number;
  readonly impactMinor: string;
  readonly tradingCostBps: number;
  readonly tradingCostMinor: string;
  readonly netAlphaBps: number;
  readonly netAlphaMinor: string;
};

export type LiquidityCapacityEnvelope = {
  readonly liquidityConcentrationHhi: number;
  readonly topLegWeightBps: number;
  readonly singleNameCapacityMinor: string;
  readonly portfolioCapacityMinor: string;
  readonly venueCapacityMinor: string;
  readonly bindingConstraint:
    | 'SINGLE_NAME'
    | 'PORTFOLIO'
    | 'VENUE'
    | 'PARTICIPATION_POLICY'
    | 'DEPTH'
    | 'NONE';
};

export type BreakEvenCapitalEstimate = {
  readonly breakEvenCapitalMinorLow: string;
  readonly breakEvenCapitalMinorMid: string;
  readonly breakEvenCapitalMinorHigh: string;
  readonly uncertaintyBps: number;
  readonly method: 'INTERPOLATED_SCALE_CURVE';
  readonly netAlphaCrossesZero: boolean;
};

export type CapacityCeilingEstimate = {
  readonly maxViableScaleMultiplier: Alpha12CapitalScaleMultiplier | null;
  readonly maxViableCapitalMinor: string | null;
  readonly ceilingCapitalMinorLow: string;
  readonly ceilingCapitalMinorHigh: string;
  readonly uncertaintyBps: number;
  readonly netEdgeApproachesZero: boolean;
};

export type StrategyCapacityCurve = {
  readonly strategyId: string;
  readonly shadowCapitalMinor: string;
  readonly currency: string;
  readonly scenarios: readonly CapitalScaleScenario[];
  readonly impactAdjusted: readonly ImpactAdjustedAlpha[];
  readonly liquidity: LiquidityCapacityEnvelope;
  readonly breakEven: BreakEvenCapitalEstimate;
  readonly ceiling: CapacityCeilingEstimate;
  readonly classification: Alpha12CapacityClassification;
  readonly nonLinearReturnsEnforced: true;
};

export type Alpha12CapacityEngineResult = {
  readonly schema: typeof ALPHA12_CAPACITY_ENGINE_SCHEMA;
  readonly strategyId: string;
  readonly grantsExecutionAuthority: false;
  readonly researchOnly: true;
  readonly curve: StrategyCapacityCurve;
  readonly scaleMultipliersRequested: typeof ALPHA12_CAPITAL_SCALE_MULTIPLIERS;
  readonly qualificationMarker: string;
};
