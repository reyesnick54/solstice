/**
 * HELIOS EXECUTION CONNECTIVITY — EXEC06 bounded execution algorithm engine.
 */

export {
  EXEC06_ENGINE_VERSION,
  EXECUTION_ALGORITHM_KINDS,
  PARENT_ORDER_STATUSES,
  CHILD_ORDER_STATUSES,
  EXECUTION_ALGORITHM_MODES,
  MARKET_DATA_UNTRUSTED_POLICIES,
  AUTHORITATIVE_MARKET_TRUST,
  EXECUTION_ALGORITHM_VIOLATION_CODES,
  type ExecutionAlgorithmKind,
  type ParentOrderStatus,
  type ChildOrderStatus,
  type ExecutionAlgorithmMode,
  type MarketDataUntrustedPolicy,
  type AuthoritativeMarketTrust,
  type ExecutionAlgorithmViolationCode,
} from './taxonomy.ts';

export {
  asParentOrderId,
  asChildOrderId,
  asExecutionScheduleId,
  parentOrderIdFor,
  childOrderIdFor,
  executionScheduleIdFor,
  type ParentOrderId,
  type ChildOrderId,
  type ExecutionScheduleId,
} from './ids.ts';

export type {
  AuthorizedLimitConstraints,
  ExecutionTimeHorizon,
  ExecutionParticipationLimits,
  GovernedParentOrderAuthorization,
  ParentOrder,
  ChildOrder,
  ExecutionScheduleSlice,
  ExecutionSchedule,
  ExecutionAlgorithmState,
  RegisterParentOrderInput,
  AlgorithmMarketContext,
  AlgorithmRiskPort,
  ChildOrderProposal,
  RegisterParentResult,
  AlgorithmTickResult,
  ReplaceChildInput,
  ReplaceChildResult,
  ApplyFillInput,
  ExecutionAlgorithmStoreSnapshot,
} from './types.ts';

export { buildExecutionSchedule, algorithmKindUsesLimit } from './schedule.ts';
export { createExecutionAlgorithmStore, type ExecutionAlgorithmStore } from './store.ts';
export {
  BoundedExecutionAlgorithmEngine,
  HELIOS_EXEC06_BOUNDED_EXECUTION_ALGOS,
  permissiveAlgorithmRiskPort,
  refusingAlgorithmRiskPort,
} from './engine.ts';

export {
  EXEC06_FIXTURE_NOW,
  exec06MarketState,
  exec06UntrustedMarketState,
  baseExec06Authorization,
  baseExec06LimitConstraints,
  baseExec06Participation,
  baseExec06Horizon,
  registerParentFixture,
  algorithmMarketContext,
  marketContextAt,
} from './fixtures.ts';

export {
  HELIOS_EXEC06_EXECUTION_ALGOS_QUALIFIED,
  HELIOS_EXEC06_EXECUTION_ALGOS_BLOCKED,
  evaluateExec06ExecutionAlgosQualification,
  type Exec06QualificationChecks,
  type Exec06QualificationResult,
} from './qualification.ts';
