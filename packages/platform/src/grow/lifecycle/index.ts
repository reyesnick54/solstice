export {
  EXECUTION_CAPABILITIES,
  LIFECYCLE_STAGE_STATUSES,
  DATA_FRESHNESS_STATUSES,
  CANONICAL_EXECUTION_LIFECYCLE_STATES,
  GROW_FINANCIAL_AGENT_IDS,
  GROW_AUDIT_EVENT_KINDS,
  FINANCIAL_RISK_DIMENSIONS,
} from './taxonomy.ts';
export type {
  ExecutionCapability,
  LifecycleStageStatus,
  DataFreshnessStatus,
  CanonicalExecutionLifecycleState,
  GrowFinancialAgentId,
  GrowAuditEventKind,
  FinancialRiskDimension,
} from './taxonomy.ts';

export { assessFreshness, sourcedFact, staleDataBlocksProposal } from './data-freshness.ts';
export type { SourcedFact } from './data-freshness.ts';

export { buildFinancialRiskProfile, riskFromOpportunityLevel } from './risk-model.ts';
export type { FinancialRiskProfile, RiskLevel } from './risk-model.ts';

export { normalizeFinancialOpportunity } from './financial-opportunity.ts';
export type { FinancialOpportunity, ExpectedReturnData } from './financial-opportunity.ts';

export { canonicalFinancialProposalFrom, materialProposalTermsChanged } from './financial-proposal-model.ts';
export type { CanonicalFinancialProposal } from './financial-proposal-model.ts';

export { userGrowConstraintsFrom } from './user-constraints.ts';
export type { UserGrowConstraints } from './user-constraints.ts';

export {
  UnavailableGrowExecutionAdapter,
  SimulationGrowExecutionAdapter,
  idempotentExecutionKey,
} from './execution-adapter.ts';
export type {
  GrowExecutionAdapter,
  ExecutionPrepareResult,
  ExecutionValidateResult,
  ExecutionSubmitResult,
  ExecutionStatusResult,
} from './execution-adapter.ts';

export { mapCanonicalExecutionState, submittedIsNotCompleted, providerConfirmedState } from './execution-states.ts';

export { projectedVsRealized, presentOutcomeToUser } from './outcome-attribution.ts';
export type { OutcomeAttribution } from './outcome-attribution.ts';

export { shouldReassess, monitoringToReassessmentLoop } from './reassessment.ts';
export type { ReassessmentDecision } from './reassessment.ts';

export { growAuditEvent, GROW_AUDIT_EVENT_TO_EVIDENCE_KIND } from './audit-events.ts';
export type { GrowAuditEvent } from './audit-events.ts';

export { evaluateGrowComplianceCheckpoint } from './compliance-checkpoint.ts';
export type { GrowComplianceCheckpointInput, GrowComplianceCheckpointResult } from './compliance-checkpoint.ts';

export {
  allocationWeightBps,
  cashFlowDelta,
  feeImpactMinorUnits,
  interestAccruedMinorUnits,
  ANALYSIS_ENGINE_KIND,
} from './analysis-engine.ts';

export { assertAiRuntimeIsolation, scanAgentContext, agentContextContainsForbiddenCredential } from './credential-isolation.ts';
export type { CredentialIsolationReport } from './credential-isolation.ts';

export {
  GROW_FINANCIAL_AGENT_MATRIX,
  GROW_BUILD_STATUS,
  deriveCapabilityMatrixJson,
  growAgentById,
} from './agent-inventory.ts';
export type { GrowAgentCapabilityMatrixRow, GrowAgentCapabilityStage, GrowBuildStatusRow } from './agent-inventory.ts';
