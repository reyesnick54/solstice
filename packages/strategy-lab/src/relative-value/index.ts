export {
  M12_SPY_QQQ_PAIR_ID,
  M12_BTC_ETH_PAIR_ID,
  M12_GLD_GC_RESEARCH_PAIR_ID,
  M12_PAIR_UNIVERSE,
  M12_PAIR_DEFINITIONS,
  M12_BAR_INTERVAL,
  resolveM12PairDefinition,
} from './ids.ts';
export type { M12PairId, M12PairDefinition } from './ids.ts';
export {
  HELIOS_M12_RULE_ID,
  HELIOS_M12_RULE_VERSION,
  HELIOS_M12_FAMILY_ID,
  HELIOS_M12_CAPSULE_ID,
  HELIOS_MULTI_ASSET_M12_RELATIVE_VALUE_STAT_ARB_QUALIFIED,
  HELIOS_MULTI_ASSET_M12_RELATIVE_VALUE_STAT_ARB_BLOCKED,
  M12_Z_SCORE_SCALE,
  M12_CORRELATION_SCALE,
} from './constants.ts';
export {
  M12_PARAMETERS_V1,
  M12_PARAMETERS_V2,
  resolveM12Parameters,
  parameterFingerprint,
  freezeM12ParameterRecord,
} from './parameters.ts';
export type { M12ParameterVersion, M12StrategyParameters, M12ParameterRecord } from './parameters.ts';
export {
  discoverRelationship,
  constructSpreadMinor,
  estimateHedgeRatioScaled,
  rollingCorrelationScaled,
  cointegrationTestHook,
  barsForInstrument,
  indexAtOrBefore,
} from './relationship.ts';
export { validatePair } from './validation.ts';
export { evaluateM12RelativeValueStatArb } from './rule.ts';
export { buildM12StrategyProposal, buildM12ProposalId } from './proposal.ts';
export { recommendPairAllocation } from './allocation.ts';
export {
  syntheticM12BarSeries,
  m12ChronologicalManifest,
  barsFromManifest,
  buildM12Bar,
} from './fixtures.ts';
export type { M12FixtureScenario } from './fixtures.ts';
export {
  initialM12LifecycleState,
  promoteM12ToShadow,
  promoteM12ToPaper,
  demoteM12,
  restartM12Lifecycle,
} from './lifecycle.ts';
export type { M12LifecycleMode, M12LifecycleState } from './lifecycle.ts';
export { evaluateM12Qualification } from './qualification.ts';
export type { M12QualificationChecks, M12QualificationResult } from './qualification.ts';
export { runM12ChronologicalEvaluation } from './evaluation.ts';
export type { M12ChronologicalEvaluationResult } from './evaluation.ts';
export type {
  M12BarObservation,
  M12RelationshipSnapshot,
  M12PairValidationResult,
  M12PairValidationOutcome,
  M12StrategyProposal,
  M12StrategyLeg,
  M12OpenSpreadPosition,
  M12EvaluationContext,
  M12ProposalAction,
  M12ExitReason,
  M12CointegrationOutcome,
} from './types.ts';
