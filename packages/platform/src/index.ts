export {
  authorizeConfirmMandate,
  authorizeOperateGrowth,
  authorizeViewGrowthPlan,
  type GrowthAccessFailure,
} from './access.ts';
export {
  asEconomicMandateId,
  asGrowthActionId,
  asGrowthCycleId,
  asGrowthPlanId,
  asGrowthPlanVersion,
  asMandateConfirmationId,
  asMandateConstraintId,
  asMandateDraftId,
  asMandateGoalId,
  asMandateVersion,
  type EconomicMandateId,
  type GrowthActionId,
  type GrowthCycleId,
  type GrowthPlanId,
  type GrowthPlanVersion,
  type MandateConfirmationId,
  type MandateConstraintId,
  type MandateDraftId,
  type MandateGoalId,
  type MandateVersion,
} from './ids.ts';
export {
  compileEconomicMandate,
  mandateDraftFromInterpretation,
  type CompilerInput,
  type ProductCapabilityFacts,
} from './mandate/compiler.ts';
export { detectMandateConflicts } from './mandate/conflicts.ts';
export {
  confirmationHash,
  isHighImpactMandate,
  recordMandateConfirmation,
  requireConfirmableActor,
} from './mandate/confirmation.ts';
export {
  canTransitionMandate,
  isActiveMandate,
  isMandateState,
  isTerminalMandate,
  transitionMandate,
} from './mandate/lifecycle.ts';
export {
  COMPILER_ERROR_CODES,
  HARD_CONSTRAINT_KINDS,
  MANDATE_GOAL_KINDS,
  MANDATE_STATES,
  SOFT_PREFERENCE_KINDS,
  type CompilerErrorCode,
  type HardConstraintKind,
  type MandateGoalKind,
  type MandateState,
  type SoftPreferenceKind,
} from './mandate/taxonomy.ts';
export type {
  CompiledEconomicMandate,
  CompilerIssue,
  HardConstraint,
  MandateCompileFailure,
  MandateConfirmation,
  MandateDraft,
  MandateGoal,
  SoftPreference,
} from './mandate/types.ts';
export { generateGrowthCandidates } from './growth/candidates.ts';
export { transitionCycle } from './growth/cycle.ts';
export { explainCandidate, explainPlan } from './growth/explainability.ts';
export {
  evaluateCandidateFeasibility,
  liquidForCurrency,
} from './growth/feasibility.ts';
export { evaluateGoalFeasibility } from './growth/goal-feasibility.ts';
export { eventInvalidatesPlan, shouldInvalidatePlan } from './growth/invalidation.ts';
export { materializeGrowthAction, type MaterializeFailure } from './growth/materialize.ts';
export { planningPriorityVersion, rankCandidates } from './growth/ranking.ts';
export {
  EXECUTION_CAPABILITY_STATES,
  GROWTH_ACTION_KINDS,
  GROWTH_CYCLE_STATES,
  PLANNING_PRIORITY_VERSION,
  type ExecutionCapabilityState,
  type GrowthActionKind,
  type GrowthCycleState,
} from './growth/taxonomy.ts';
export type {
  ActionExplanation,
  FeasibilityResult,
  GoalFeasibility,
  GrowthActionCandidate,
  GrowthCycle,
  GrowthPlan,
  PlanningContext,
} from './growth/types.ts';
export {
  simulationPolicyPort,
  unevaluablePolicyPort,
  type PolicyControlPort,
} from './policy-port.ts';
export { GrowthOrchestrator, type GrowthFailure } from './service.ts';
export { InMemoryGrowthStore, type GrowthStoreSnapshot } from './store.ts';
export {
  ASSUMPTION_CATALOG_ID,
  FINANCIAL_PROPOSAL_STATUSES,
  GROW_RISK_PROFILES,
  ILLUSTRATION_DISCLAIMER,
  PRODUCT_GROWTH_PLAN_STATUSES,
  ProductGrowthService,
  actorFromVerified,
  compareAlternatives,
  conservativeOnlyPolicy,
  defaultScenarioSeed,
  explainProposal,
  getGrowthPlan,
  getProposal,
  lookupReturnAssumption,
  materialTermsHash,
  projectScenarios,
  requestProposalModification,
  simulationGrowPolicy,
  toLovableExperience,
  transitionProductProposal,
} from './growth/product/index.ts';
export type {
  CreateGrowPlanInput,
  FinancialProposal,
  GrowProductFailure,
  GrowthProductActor,
  LovableGrowExperience,
  ProductGrowthPlan,
  ProposalExplanation,
} from './growth/product/index.ts';
export {
  absentTreasuryContextPort,
  type TreasuryContextPort,
} from './treasury-port.ts';
export {
  authorizeViewEconomicValue,
  type PeveAccessFailure,
} from './value/access.ts';
export { GrowthAttributionLedger, freezeBaseline } from './value/attribution.ts';
export {
  FORMULA_V1,
  FORMULA_V2,
  FormulaRegistry,
  MODEL_V1,
  MODEL_V2,
} from './value/formula.ts';
export {
  asAttributionEntryId,
  asAttributionGroupId,
  asAttributionPeriodId,
  asCounterfactualBaselineId,
  asDataContributionReferenceId,
  asEconomicValueDimensionId,
  asEconomicValueModelVersion,
  asEconomicValueProfileId,
  asEconomicValueSnapshotId,
  asIndexPoints,
  asValuationFormulaVersion,
  type AttributionEntryId,
  type AttributionGroupId,
  type AttributionPeriodId,
  type CounterfactualBaselineId,
  type DataContributionReferenceId,
  type EconomicValueDimensionId,
  type EconomicValueModelVersion,
  type EconomicValueProfileId,
  type EconomicValueSnapshotId,
  type IndexPoints,
  type ValuationFormulaVersion,
} from './value/ids.ts';
export { PEVE_ISOLATION } from './value/isolation.ts';
export { PersonalEconomicValueEngine, type PeveFailure } from './value/service.ts';
export { InMemoryPeveStore, type PeveStoreSnapshot } from './value/store.ts';
export {
  ATTRIBUTION_TYPES,
  DATA_COMPLETENESS_STATES,
  ECONOMIC_VALUE_DIMENSIONS,
  FORMULA_LIFECYCLES,
  PEVE_NOT_CREDIT_SCORE,
  PEVE_NOT_EXECUTION,
  PEVE_NOT_HUMAN_WORTH,
  PROTECTED_TRAIT_KEYS,
  VALUE_REALIZATION_STATES,
  type AttributionType,
  type DataCompletenessState,
  type EconomicValueDimensionKind,
  type FormulaLifecycle,
  type ValueRealizationState,
} from './value/taxonomy.ts';
export type {
  AttributionEntry,
  CompositeIndicator,
  CounterfactualBaseline,
  DataContributionReference,
  DimensionExplanation,
  DimensionResult,
  EconomicValueSnapshot,
  EconomicValueVector,
  FormulaModel,
  FxValuationContext,
  IndexMeasure,
  ModelComparison,
  MoneyMeasure,
  OpportunityCapacityView,
} from './value/types.ts';
export type { PevePlanningSignals } from './growth/types.ts';
export {
  asOpportunityId,
  opportunityIdFor,
  type OpportunityId,
} from './ids.ts';
export {
  OPPORTUNITY_CATEGORIES,
  OPPORTUNITY_DETECTORS,
  OPPORTUNITY_STATUSES,
  IMPACT_KINDS,
  RANKING_VERSION,
} from './growth/opportunity/taxonomy.ts';
export type {
  OpportunityCategory,
  OpportunityDetectorKind,
  OpportunityStatus,
  ImpactKind,
} from './growth/opportunity/taxonomy.ts';
export { discoverOpportunities } from './growth/opportunity/discover.ts';
export { runOpportunityDetectors } from './growth/opportunity/detectors.ts';
export { evaluateOpportunityEligibility } from './growth/opportunity/eligibility.ts';
export { rankOpportunity, assignPriorities, rankingWeights } from './growth/opportunity/ranking.ts';
export { explanationInputFor, explanationFactsText } from './growth/opportunity/explain.ts';
export { shouldRecalculateOpportunities } from './growth/opportunity/recompute.ts';
export { defaultOpportunityPreferences, mergeOpportunityPreferences } from './growth/opportunity/preferences.ts';
export { SIMULATION_GROWTH_PRODUCTS, SIMULATION_RATE_CATALOG } from './growth/opportunity/products.ts';
export { opportunityFeed } from './growth/opportunity/feed.ts';
export { transitionOpportunity } from './growth/opportunity/lifecycle.ts';
export type {
  Opportunity,
  OpportunityFeed,
  OpportunityPreferences,
  OpportunityExplanationInput,
  OpportunityProposalReceipt,
  OpportunityDiscoveryContext,
} from './growth/opportunity/types.ts';
