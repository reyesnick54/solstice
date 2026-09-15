import type { UtcInstant } from '../../../domain/src/time.ts';
import type { EconomicMandateId, MandateVersion } from '../ids.ts';
import type {
  EconomicWorkOrderId,
  HeliosProgramId,
  HeliosTaskId,
  ResearchBudgetReservationId,
  ResearchSpendRecordId,
} from './ids.ts';
import type {
  AuthorityRevalidationState,
  BudgetUnitKind,
  HeliosCapability,
  HeliosTaskType,
  ModelClass,
  SpendCostStatus,
  TaskFailureCategory,
  TaskState,
  WorkOrderState,
} from './taxonomy.ts';

export type SerializedMoney = {
  readonly minorUnits: string;
  readonly currency: string;
};

export type BudgetCeiling = {
  readonly unitKind: BudgetUnitKind;
  readonly ceilingAmount: string;
  readonly currency?: string;
};

export type ResearchBudgetSnapshot = {
  readonly authorizedCeiling: string;
  readonly unitKind: BudgetUnitKind;
  readonly currency: string | null;
  readonly reservedAmount: string;
  readonly recordedSpend: string;
  readonly estimatedAccrued: string;
  readonly releasedReservation: string;
  readonly remainingBudget: string;
};

export type WorkOrderAuthorityBinding = {
  readonly mandateId: EconomicMandateId;
  readonly mandateVersion: MandateVersion;
  readonly approvalRef: string | null;
  readonly capability: HeliosCapability;
  readonly revalidationState: AuthorityRevalidationState;
  readonly customerId: string;
  readonly subjectId: string;
  readonly agentMayExpandAuthority: false;
  readonly agentMayIncreaseBudget: false;
};

export type EconomicWorkOrder = {
  readonly workOrderId: EconomicWorkOrderId;
  readonly programId: HeliosProgramId;
  readonly customerId: string;
  readonly subjectId: string;
  readonly state: WorkOrderState;
  readonly objective: string;
  readonly authority: WorkOrderAuthorityBinding;
  readonly researchBudget: ResearchBudgetSnapshot;
  readonly maxConcurrentTasks: number;
  readonly priority: number;
  readonly createdAt: UtcInstant;
  readonly updatedAt: UtcInstant;
  readonly version: number;
};

export type TaskLease = {
  readonly taskId: HeliosTaskId;
  readonly workerId: string;
  readonly acquiredAt: UtcInstant;
  readonly expiresAt: UtcInstant;
  readonly attemptNumber: number;
  readonly leaseGeneration: number;
};

export type TaskRetryMetadata = {
  readonly attemptCount: number;
  readonly lastFailureAt: UtcInstant | null;
  readonly nextEligibleAt: UtcInstant | null;
  readonly failureCategory: TaskFailureCategory | null;
  readonly backoffMs: number;
  readonly terminalThreshold: number;
};

export type HeliosWorkTask = {
  readonly taskId: HeliosTaskId;
  readonly workOrderId: EconomicWorkOrderId;
  readonly customerId: string;
  readonly operationIdentity: string;
  readonly taskType: HeliosTaskType;
  readonly version: number;
  readonly state: TaskState;
  readonly requiredCapability: HeliosCapability;
  readonly permittedTools: readonly string[];
  readonly permittedModelClass: ModelClass;
  readonly requestedObjective: string;
  readonly dependencyTaskIds: readonly HeliosTaskId[];
  readonly deadline: UtcInstant | null;
  readonly priority: number;
  readonly authority: WorkOrderAuthorityBinding;
  readonly budgetReservationId: ResearchBudgetReservationId | null;
  readonly reservedBudgetAmount: string | null;
  readonly accumulatedSpend: string;
  readonly budgetUnitKind: BudgetUnitKind;
  readonly resultRef: string | null;
  readonly evidenceRefs: readonly string[];
  readonly failureReason: string | null;
  readonly completedAt: UtcInstant | null;
  readonly lease: TaskLease | null;
  readonly retry: TaskRetryMetadata;
  readonly createdAt: UtcInstant;
  readonly updatedAt: UtcInstant;
};

export type ResearchBudgetReservation = {
  readonly reservationId: ResearchBudgetReservationId;
  readonly workOrderId: EconomicWorkOrderId;
  readonly taskId: HeliosTaskId;
  readonly customerId: string;
  readonly unitKind: BudgetUnitKind;
  readonly reservedAmount: string;
  readonly reconciledAmount: string | null;
  readonly releasedAmount: string | null;
  readonly state: 'ACTIVE' | 'RECONCILED' | 'RELEASED';
  readonly createdAt: UtcInstant;
  readonly updatedAt: UtcInstant;
};

export type ResearchSpendRecord = {
  readonly spendId: ResearchSpendRecordId;
  readonly workOrderId: EconomicWorkOrderId;
  readonly taskId: HeliosTaskId;
  readonly customerId: string;
  readonly programId: HeliosProgramId;
  readonly providerId: string | null;
  readonly modelId: string | null;
  readonly toolId: string | null;
  readonly budgetCategory: BudgetUnitKind;
  readonly reservedAmount: string;
  readonly actualAmount: string | null;
  readonly estimatedAmount: string | null;
  readonly costStatus: SpendCostStatus;
  readonly currency: string | null;
  readonly attemptNumber: number;
  readonly retryCausedAdditionalCost: boolean;
  readonly succeeded: boolean;
  readonly recordedAt: UtcInstant;
};

export type HeliosFailureCode =
  | 'WORK_ORDER_NOT_FOUND'
  | 'TASK_NOT_FOUND'
  | 'CUSTOMER_MISMATCH'
  | 'WORK_ORDER_NOT_ACTIVE'
  | 'AUTHORITY_REVOKED'
  | 'CAPABILITY_DENIED'
  | 'BUDGET_EXHAUSTED'
  | 'BUDGET_SELF_INCREASE_FORBIDDEN'
  | 'LEASE_LOST'
  | 'LEASE_NOT_EXPIRED'
  | 'DEPENDENCY_NOT_MET'
  | 'TASK_ALREADY_COMPLETED'
  | 'CONCURRENCY_LIMIT'
  | 'AUTHORITY_EXPANSION_FORBIDDEN'
  | 'INVALID_STATE_TRANSITION'
  | 'RESERVATION_FAILED';

export type HeliosFailure = {
  readonly code: HeliosFailureCode;
  readonly message: string;
};

export type HeliosAuditEvent = {
  readonly kind: import('./taxonomy.ts').HeliosAuditEventKind;
  readonly occurredAt: UtcInstant;
  readonly workOrderId?: EconomicWorkOrderId;
  readonly taskId?: HeliosTaskId;
  readonly customerId: string;
  readonly detail: string;
};

export type HeliosMetricsSnapshot = {
  readonly queueDepth: number;
  readonly activeLeases: number;
  readonly expiredLeases: number;
  readonly retryCount: number;
  readonly taskSuccessCount: number;
  readonly taskFailureCount: number;
  readonly budgetReservations: number;
  readonly researchSpendTotal: string;
  readonly budgetExhaustionCount: number;
  readonly cancelledWorkCount: number;
  readonly blockedAuthorityCount: number;
};
