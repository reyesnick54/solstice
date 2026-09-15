export {
  asEconomicWorkOrderId,
  asHeliosProgramId,
  asHeliosTaskId,
  asResearchBudgetReservationId,
  asResearchSpendRecordId,
  taskIdFor,
  workOrderIdFor,
} from './ids.ts';
export {
  AUTHORITY_REVALIDATION,
  BUDGET_UNIT_KINDS,
  HELIOS_AUDIT_EVENT_KINDS,
  HELIOS_CAPABILITIES,
  HELIOS_TASK_TYPES,
  MODEL_CLASSES,
  SPEND_COST_STATUS,
  TASK_FAILURE_CATEGORIES,
  TASK_STATES,
  WORK_ORDER_STATES,
} from './taxonomy.ts';
export type {
  AuthorityRevalidationState,
  BudgetUnitKind,
  HeliosAuditEventKind,
  HeliosCapability,
  HeliosTaskType,
  ModelClass,
  SpendCostStatus,
  TaskFailureCategory,
  TaskState,
  WorkOrderState,
} from './taxonomy.ts';
export type {
  EconomicWorkOrder,
  HeliosAuditEvent,
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
} from './types.ts';
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
export { heliosAuditEvent } from './evidence.ts';
export { HeliosTaskWorker, restartWorker } from './executor.ts';
export { collectHeliosMetrics } from './metrics.ts';
export { HeliosWorkOrchestrator } from './orchestrator.ts';
export {
  classifyTaskError,
  HeliosTaskError,
  initialRetryMetadata,
  isRetryableCategory,
  nextBackoffMs,
} from './retry.ts';
export { InMemoryHeliosWorkStore, type HeliosStoreSnapshot } from './store.ts';

export const HELIOS_PHASE_2_DURABLE_CONTROL_TRUSTED = 'HELIOS_PHASE_2_DURABLE_CONTROL_TRUSTED' as const;
export const HELIOS_PHASE_2_BLOCKED = 'HELIOS_PHASE_2_BLOCKED' as const;
