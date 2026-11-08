/**
 * HELIOS Forward Alpha — ALPHA06 forward implementation and execution realism.
 */

export {
  ALPHA06_ENGINE_VERSION,
  ALPHA06_SCHEMA,
  ALPHA06_RULE_FLAGS,
  HELIOS_ALPHA06_EXECUTION_REALISM_QUALIFIED,
  HELIOS_ALPHA06_EXECUTION_REALISM_BLOCKED,
  type Alpha06ExecutionAlgorithmKind,
} from './taxonomy.ts';

export type {
  Alpha06ForwardScenario,
  Alpha06ForwardExecutionResult,
  Alpha06LaneReturn,
  Alpha06ImplementableExecutionBundle,
  Alpha06SignalLeg,
} from './types.ts';

export {
  runAlpha06ForwardExecutionRealism,
  alpha06SimulationPostureOk,
} from './engine.ts';

export { computeSignalOnlyReturn } from './signal-lane.ts';
export { executeImplementableReturn, alpha06ResultId } from './implementable-lane.ts';
export { computeSignalToImplementationDecay, alphaSurvivesAfterExecution, pickLane } from './decay.ts';
export { evaluateAlpha06Promotion } from './promotion-gate.ts';
export { evaluateMd15MarketDataPosture, type Md15PostureResult } from './md15-posture.ts';

export {
  ALPHA06_FIXTURE_NOW,
  ALPHA06_FIXTURE_EXIT,
  alpha06SurvivingScenario,
  alpha06DecayScenario,
  alpha06PerpFundingScenario,
} from './fixtures.ts';

export {
  buildAlpha06QualificationChecks,
  evaluateAlpha06ExecutionRealismQualification,
  type Alpha06QualificationChecks,
  type Alpha06QualificationResult,
} from './qualification.ts';
