export {
  asAuthorityBindingDecisionId,
  asEconomicWorkOrderId,
  asHeliosProgramId,
  asHeliosTaskId,
  asResearchBudgetReservationId,
  asResearchSpendRecordId,
  asWorkOrderApprovalBindingId,
  approvalBindingIdFor,
  bindingDecisionIdFor,
  taskIdFor,
  workOrderIdFor,
  type AuthorityBindingDecisionId,
  type EconomicWorkOrderId,
  type HeliosProgramId,
  type HeliosTaskId,
  type ResearchBudgetReservationId,
  type ResearchSpendRecordId,
  type WorkOrderApprovalBindingId,
} from './ids.ts';
export {
  ACTIVITY_CLASSES,
  APPROVAL_CLASSES,
  AUTHORITY_REVALIDATION,
  BINDING_CHECKPOINTS,
  BINDING_DECISION_OUTCOMES,
  BINDING_REASON_CODES,
  BUDGET_UNIT_KINDS,
  CAPABILITY_RESOLUTION_STATES,
  HELIOS_AUDIT_EVENT_KINDS,
  HELIOS_CAPABILITIES,
  HELIOS_TASK_TYPES,
  MODEL_CLASSES,
  OBJECTIVE_CLASSES,
  PRODUCT_CLASSES,
  SPEND_COST_STATUS,
  TASK_FAILURE_CATEGORIES,
  TASK_STATES,
  WORK_ORDER_STATES,
  type ActivityClass,
  type ApprovalClass,
  type AuthorityRevalidationState,
  type BindingCheckpoint,
  type BindingDecisionOutcome,
  type BindingReasonCode,
  type BudgetUnitKind,
  type CapabilityResolutionState,
  type HeliosAuditEventKind,
  type HeliosCapability,
  type HeliosTaskType,
  type ModelClass,
  type ObjectiveClass,
  type ProductClass,
  type SpendCostStatus,
  type TaskFailureCategory,
  type TaskState,
  type WorkOrderState,
} from './taxonomy.ts';
export type {
  AuthorityBindingDecision,
  BindingFailure,
  CapabilityBindingContext,
  EconomicWorkOrder,
  MandateBindingRef,
  MandatePermittedScope,
  ScopeNarrowing,
  ToolModelCapabilityGrant,
  WorkOrderApprovalRef,
  WorkOrderScope,
} from './types.ts';
export type {
  HeliosAuditEvent,
  HeliosExecutionWorkOrder,
  HeliosFailure,
  HeliosFailureCode,
  HeliosMetricsSnapshot,
  HeliosWorkTask,
  ResearchBudgetReservation,
  ResearchBudgetSnapshot,
  ResearchSpendRecord,
  TaskLease,
  TaskRetryMetadata,
  WorkOrderAuthorityBinding,
} from './execution-types.ts';
export { HeliosWorkOrderBindingService } from './binding-service.ts';
export { createWorkOrderApprovalRef, validateApprovalBinding } from './approval-binding.ts';
export {
  capabilityPermittedScope,
  platformPermittedScope,
  validateCapabilityForScope,
} from './capability-binding.ts';
export {
  mandateBindingRefFromCompiled,
  mandatePermittedScopeFromCompiled,
  requestedScopeWithinMandate,
  validateMandateBinding,
} from './mandate-binding.ts';
export { detectMaterialScopeChange, isHarmlessMetadataChange } from './material-change.ts';
export { applyRevocationToWorkOrder, revocationEffectForMandate } from './revocation.ts';
export { intersectWorkOrderScope, scopeHash } from './scope.ts';
export { InMemoryHeliosWorkOrderStore } from './store.ts';
export { createEconomicWorkOrderDraft, workOrderContentHash } from './work-order.ts';
export { heliosAuditEvent, sealAuthorityBindingDecision } from './evidence.ts';
export {
  authorityPermitsDispatch,
  bindWorkOrderAuthority,
  revalidateAuthority,
  rejectAuthorityExpansion,
} from './authority-binding.ts';
export {
  applyReservation,
  applySpend,
  canReserveBudget,
  computeRemainingBudget,
  createReservation,
  createSpendRecord,
  initialBudgetSnapshot,
  rejectBudgetSelfIncrease,
  releaseUnusedReservation,
} from './budget.ts';
export { HeliosTaskWorker, restartWorker } from './executor.ts';
export { collectHeliosMetrics } from './metrics.ts';
export { HeliosWorkOrchestrator } from './orchestrator.ts';
export {
<<<<<<< HEAD
  HeliosResearchBudgetPort,
  recordHeliosInferenceSpend,
  type HeliosResearchBudgetPortContract,
  type HeliosResearchBudgetReconciliation,
  type HeliosResearchBudgetReservationRequest,
} from './inference-bridge.ts';
export {
=======
>>>>>>> 05a44d9c (fix(helios): resolve H10 package boundary violations for CI)
  classifyTaskError,
  HeliosTaskError,
  initialRetryMetadata,
  isRetryableCategory,
  nextBackoffMs,
} from './retry.ts';
export { InMemoryHeliosWorkStore, type HeliosStoreSnapshot } from './execution-store.ts';

export {
  HELIOS_MARKET_OBSERVATION_SCHEMA,
  HeliosObservationFabric,
  assessHeliosFreshness,
  buildInformationTime,
  buildObservationEntitlement,
  createHeliosObservationStore,
  isKnowableAt,
  isEntitlementUsable,
  isFreshnessDegraded,
  type HeliosMarketObservationEnvelope,
  type HeliosObservationFabricOptions,
  type HeliosObservationStore,
  type HeliosObservationStoreSnapshot,
  type InformationTime,
  type ObservationEntitlement,
  type ObservationType,
  type QualityState,
} from './observation/index.ts';

export const HELIOS_PHASE_2_DURABLE_CONTROL_TRUSTED = 'HELIOS_PHASE_2_DURABLE_CONTROL_TRUSTED' as const;
export const HELIOS_PHASE_2_BLOCKED = 'HELIOS_PHASE_2_BLOCKED' as const;

export * from './executable-opportunity/index.ts';
