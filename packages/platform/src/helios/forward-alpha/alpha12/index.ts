export {
  ALPHA12_CAPACITY_ENGINE_SCHEMA,
  ALPHA12_CAPACITY_ENGINE_MODULE,
  ALPHA12_CAPITAL_SCALE_MULTIPLIERS,
  ALPHA12_IMPACT_MODEL_VERSION,
  ALPHA12_CAPACITY_CLASSIFICATIONS,
  HELIOS_ALPHA12_CAPACITY_ENGINE_QUALIFIED,
  HELIOS_ALPHA12_CAPACITY_ENGINE_BLOCKED,
  type Alpha12CapitalScaleMultiplier,
  type Alpha12CapacityClassification,
} from './taxonomy.ts';

export type {
  StrategyLiquidityLeg,
  Alpha12ImpactModelConfig,
  Alpha12CapacityEngineInput,
  CapitalScaleScenario,
  ImpactAdjustedAlpha,
  LiquidityCapacityEnvelope,
  BreakEvenCapitalEstimate,
  CapacityCeilingEstimate,
  StrategyCapacityCurve,
  Alpha12CapacityEngineResult,
} from './types.ts';

export { runAlpha12CapacityEngine, buildStrategyCapacityCurve } from './engine.ts';
export {
  evaluateAlpha12CapacityQualification,
  type Alpha12QualificationChecks,
  type Alpha12QualificationResult,
} from './qualification.ts';
export {
  fixtureAlpha12MicroCapacityInput,
  fixtureAlpha12MidCapacityInput,
  DEFAULT_ALPHA12_IMPACT_MODEL,
} from './fixtures.ts';
export { estimateImpactBps, signalRetentionFactor, bpsOnNotional, bpsFromMinor } from './impact-model.ts';
export {
  buildLiquidityCapacityEnvelope,
  effectiveParticipationRate,
  liquidityPermitsScale,
} from './liquidity.ts';
export {
  estimateBreakEvenCapital,
  estimateCapacityCeiling,
  classifyCapacity,
} from './break-even.ts';
