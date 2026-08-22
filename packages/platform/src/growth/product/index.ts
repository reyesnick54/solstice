export {
  ALTERNATIVE_KINDS,
  ASSUMPTION_AVAILABILITY,
  FEE_CERTAINTY,
  FINANCIAL_PROPOSAL_ACTION_TYPES,
  FINANCIAL_PROPOSAL_STATUSES,
  GROW_EXECUTION_METHODS,
  GROW_PLAN_COMPONENT_KINDS,
  GROW_RISK_PROFILES,
  ILLUSTRATION_DISCLAIMER,
  POLICY_DECISIONS,
  PRODUCT_GROWTH_PLAN_STATUSES,
  REQUIRED_APPROVALS,
  SCENARIO_KINDS,
  SUITABILITY_DECISIONS,
  isFinancialProposalStatus,
  isGrowRiskProfile,
  isProductGrowthPlanStatus,
} from './taxonomy.ts';
export type {
  AlternativeKind,
  AssumptionAvailability,
  FeeCertainty,
  FinancialProposalActionType,
  FinancialProposalStatus,
  GrowExecutionMethod,
  GrowPlanComponentKind,
  GrowPolicyDecision,
  GrowRequiredApproval,
  GrowRiskProfile,
  ProductGrowthPlanStatus,
  ScenarioKind,
  SuitabilityDecision,
} from './taxonomy.ts';
export {
  asAssumptionSetId,
  asFinancialProposalId,
  asFinancialProposalVersion,
  asGrowMoneyPlanId,
  asGrowMoneyPlanVersion,
  asGrowPlanComponentId,
  asScenarioRunId,
  asSuitabilitySnapshotId,
  financialProposalIdFor,
  growMoneyPlanIdFor,
} from './ids.ts';
export type {
  AssumptionSetId,
  FinancialProposalId,
  GrowMoneyPlanId,
  GrowPlanComponentId,
  ScenarioRunId,
  SuitabilitySnapshotId,
} from './ids.ts';
export type {
  CreateGrowPlanInput,
  ExpectedEffect,
  FinancialProposal,
  GrowMoneyAmount,
  GrowPlanComponent,
  GrowProductFailure,
  GrowthProductActor,
  KnownFee,
  LovableGrowExperience,
  ModifyProposalInput,
  MonteCarloPercentiles,
  ProductGrowthPlan,
  ProposalAlternative,
  ProposalExplanation,
  ReturnAssumption,
  ScenarioAnalysis,
  ScenarioProjection,
  StartingFinancialSnapshot,
  SuitabilitySnapshot,
} from './types.ts';
export { ASSUMPTION_CATALOG_ID, lookupReturnAssumption } from './assumptions.ts';
export { projectScenarios, defaultScenarioSeed, rollForward } from './scenarios.ts';
export { buildProductGrowthPlan } from './plan.ts';
export { buildProposalFromComponent } from './proposal.ts';
export { transitionProductProposal, PRODUCT_TO_APPROVAL, isMateriallyFrozen } from './proposal-lifecycle.ts';
export { materialTermsHash, assertUnchangedMaterialTerms } from './immutability.ts';
export { toLovableExperience } from './lovable-contract.ts';
export {
  compareAlternatives,
  explainProposal,
  getGrowthPlan,
  getProposal,
  requestProposalModification,
} from './agent-tools.ts';
export { ProductGrowthService, actorFromVerified } from './service.ts';
export { InMemoryProductGrowthStore } from './store.ts';
export { conservativeOnlyPolicy, simulationGrowPolicy } from './policy.ts';
