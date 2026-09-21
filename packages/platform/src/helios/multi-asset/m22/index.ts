/**
 * HELIOS Multi-Asset M22 — Intelligent Order Planning and Execution Tactics.
 */

export {
  EXECUTION_TACTIC_METHODOLOGY_VERSION,
  EXECUTION_ORDER_TYPES,
  EXECUTION_TIME_IN_FORCE,
  EXECUTION_TACTIC_TYPES,
  COST_CERTAINTY_LEVELS,
  TACTIC_PLANNING_OUTCOMES,
  TACTIC_REFUSAL_REASONS,
  type ExecutionOrderType,
  type ExecutionTimeInForce,
  type ExecutionTacticType,
  type CostCertaintyLevel,
  type TacticPlanningOutcome,
  type TacticRefusalReason,
} from './taxonomy.ts';

export type {
  CostEstimate,
  ProviderOrderCapabilities,
  TransactionCostModel,
  CustomerRiskConstraints,
  TacticScheduleSlice,
  TacticCondition,
  ExecutionResearchRecommendation,
  ExecutionTactic,
  OrderPlanningInput,
  OrderPlanningResult,
  TransactionCostAnalysisInput,
  TransactionCostAnalysis,
  OrderPlanningStoreSnapshot,
} from './types.ts';

export { buildCostEstimate, computeTransactionCostAnalysis } from './transaction-cost.ts';

export {
  envelopePermitsPlanning,
  marketPermitsPlanning,
  providerSupportsOrder,
  planPermitsExecution,
  customerPermitsPlanning,
  validateExecutionTactic,
  researchRecommendationAdmissible,
} from './validation.ts';

export {
  synthesizeExecutionResearchRecommendation,
  executionResearchRouteLabel,
} from './execution-research-bridge.ts';

export {
  resolveRemainingQuantity,
  continuationTacticType,
  buildCancelReplaceConditions,
  buildPartialFillConditions,
} from './continuation.ts';

export { planExecutionTactic } from './planner.ts';

export { createOrderPlanningStore, type OrderPlanningStore } from './store.ts';

export {
  FIXTURE_NOW,
  equityTightSpreadMarketState,
  equityWideSpreadMarketState,
  volatileBtcMarketState,
  futuresMarketState,
  staleMarketState,
  fullProviderCapabilities,
  limitedProviderCapabilities,
  baseTransactionCostModel,
  baseCustomerConstraints,
  baseExecutionPlan,
  orderPlanningFixture,
} from './fixtures.ts';

export {
  HELIOS_MULTI_ASSET_M22_ORDER_PLANNING_QUALIFIED,
  HELIOS_MULTI_ASSET_M22_ORDER_PLANNING_BLOCKED,
  evaluateM22OrderPlanningQualification,
  type M22QualificationChecks,
  type M22QualificationResult,
} from './qualification.ts';
