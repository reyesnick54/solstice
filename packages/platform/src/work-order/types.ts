import type { UtcInstant } from '../../../domain/src/time.ts';
import type { EconomicMandateId, GrowthPlanId, GrowthPlanVersion, MandateVersion } from '../ids.ts';
import type { SerializedMoney, TimeHorizon } from '../mandate/types.ts';
import {
  asWorkOrderRevision,
  type EconomicWorkOrderId,
  type WorkOrderRevision,
  type WorkOrderTransitionId,
} from './ids.ts';
import type {
  PermittedActionCategory,
  ResearchModelClass,
  ResearchToolClass,
  WorkOrderBlockReason,
  WorkOrderDisposition,
  WorkOrderObjectiveType,
  WorkOrderState,
} from './taxonomy.ts';

export type WorkOrderMoney = SerializedMoney;

/** Authorization ceiling — not a balance or reservation. */
export type CapitalBoundary = {
  readonly maxCapitalEnvelope: WorkOrderMoney;
  readonly accountId: string | null;
  readonly portfolioId: string | null;
  readonly liquidityRetentionReference: string | null;
  readonly isBalance: false;
  readonly isAuthorizationEnvelope: true;
};

export type ResearchBoundary = {
  readonly budgetReference: string | null;
  readonly budgetUnits: readonly string[];
  readonly deadline: UtcInstant | null;
  readonly permittedCategories: readonly string[];
  readonly permittedToolClasses: readonly ResearchToolClass[];
  readonly permittedModelClasses: readonly ResearchModelClass[];
  readonly maxConcurrency: number;
  readonly stopConditions: readonly string[];
};

export type ActionBoundary = {
  readonly permittedActionCategories: readonly PermittedActionCategory[];
  readonly unrestrictedFinancialMutation: false;
  readonly agentAuthorityEscalation: false;
};

export type WorkOrderObjective = {
  readonly description: string;
  readonly objectiveType: WorkOrderObjectiveType;
  readonly horizon: TimeHorizon | null;
  readonly completionCriteria: readonly string[];
  readonly terminationCriteria: readonly string[];
  readonly priority: number | null;
};

export type WorkOrderAuthorityReferences = {
  readonly mandateId: EconomicMandateId;
  readonly mandateVersion: MandateVersion;
  readonly approvalReference: string | null;
  readonly capabilityContextReference: string | null;
  readonly jurisdiction: string | null;
  readonly legalEntityId: string | null;
};

export type WorkOrderCompletion = {
  readonly completionCriteria: readonly string[];
  readonly expirationAt: UtcInstant | null;
  readonly disposition: WorkOrderDisposition | null;
  readonly blockReason: WorkOrderBlockReason | null;
};

export type WorkOrderTransition = {
  readonly transitionId: WorkOrderTransitionId;
  readonly workOrderId: EconomicWorkOrderId;
  readonly revision: WorkOrderRevision;
  readonly previousState: WorkOrderState;
  readonly nextState: WorkOrderState;
  readonly actorId: string;
  readonly actorSource: 'CUSTOMER' | 'SYSTEM' | 'OPERATOR';
  readonly reason: string;
  readonly occurredAt: UtcInstant;
  readonly eventReference: string | null;
};

export type EconomicWorkOrder = {
  readonly workOrderId: EconomicWorkOrderId;
  readonly subjectId: string;
  readonly customerId: string;
  readonly planId: GrowthPlanId | null;
  readonly planVersion: GrowthPlanVersion | null;
  readonly objectiveReference: string | null;
  readonly revision: WorkOrderRevision;
  readonly environment: 'simulation';
  readonly state: WorkOrderState;
  readonly createdAt: UtcInstant;
  readonly updatedAt: UtcInstant;
  readonly idempotencyKey: string;
  readonly objective: WorkOrderObjective;
  readonly authorityReferences: WorkOrderAuthorityReferences;
  readonly capitalBoundary: CapitalBoundary;
  readonly researchBoundary: ResearchBoundary;
  readonly actionBoundary: ActionBoundary;
  readonly completion: WorkOrderCompletion;
  readonly transitions: readonly WorkOrderTransition[];
  readonly createsFinancialAuthority: false;
  readonly postsLedger: false;
};

export type WorkOrderFailure = {
  readonly code: import('./taxonomy.ts').WorkOrderFailureCode;
  readonly message: string;
};

export type CreateEconomicWorkOrderInput = {
  readonly subjectId: string;
  readonly customerId: string;
  readonly idempotencyKey: string;
  readonly planId?: GrowthPlanId | null;
  readonly planVersion?: GrowthPlanVersion | null;
  readonly objectiveReference?: string | null;
  readonly objective: WorkOrderObjective;
  readonly authorityReferences: WorkOrderAuthorityReferences;
  readonly capitalBoundary: CapitalBoundary;
  readonly researchBoundary: ResearchBoundary;
  readonly actionBoundary: ActionBoundary;
  readonly completion: Pick<WorkOrderCompletion, 'completionCriteria' | 'expirationAt'>;
};

export function initialRevision(): WorkOrderRevision {
  return asWorkOrderRevision(1);
}

export function nextRevision(current: WorkOrderRevision): WorkOrderRevision {
  return asWorkOrderRevision(current + 1);
}
