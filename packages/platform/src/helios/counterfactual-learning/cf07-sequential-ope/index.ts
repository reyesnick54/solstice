/**
 * HELIOS CF07 — sequential off-policy and trajectory evaluation (simulation / research).
 */

export {
  HELIOS_CF07_SEQUENTIAL_OPE_SCHEMA_VERSION,
  HELIOS_CF07_SEQUENTIAL_OPE_QUALIFIED,
  HELIOS_CF07_SEQUENTIAL_OPE_BLOCKED,
} from './taxonomy.ts';

export type {
  BehaviorHistoryContext,
  DecisionTrajectory,
  DecisionTrajectoryStep,
  PortfolioState,
  PortfolioStateTransition,
  PortfolioConstraintSpec,
  PortfolioConstraintViolation,
  ConstraintViolationKind,
  SequentialPolicyEstimate,
  TrajectorySupportAssessment,
  FittedQEvaluationState,
  OpeDiagnostics,
  SequentialOpeResult,
} from './types.ts';

export {
  evaluateSequentialOpe,
  discountedReturnMinor,
  perStepImportanceRatios,
  type TrajectoryWithPortfolio,
  type SequentialOpeInput,
  type FqeConfig,
  type EvaluationPolicyPmf,
  type QValueFunction,
  type ValueFunction,
} from './evaluation.ts';

export {
  evaluateCf07SequentialOpeQualification,
  type Cf07SequentialOpeQualificationResult,
} from './qualification.ts';
