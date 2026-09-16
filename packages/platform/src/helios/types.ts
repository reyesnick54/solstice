import type { CustomerId } from '../../../domain/src/customer.ts';
import type { Jurisdiction } from '../../../domain/src/jurisdiction.ts';
import type { UtcInstant } from '../../../domain/src/time.ts';
import type { IdentityCapability } from '../../../identity/src/capability.ts';
import type { EconomicMandateId, MandateVersion } from '../ids.ts';
import type { MandateState } from '../mandate/taxonomy.ts';
import type { SerializedMoney } from '../mandate/types.ts';
import type {
  ActivityClass,
  ApprovalClass,
  BindingCheckpoint,
  BindingDecisionOutcome,
  BindingReasonCode,
  CapabilityResolutionState,
  ObjectiveClass,
  ProductClass,
  WorkOrderState,
} from './taxonomy.ts';
import type {
  AuthorityBindingDecisionId,
  EconomicWorkOrderId,
  WorkOrderApprovalBindingId,
} from './ids.ts';

export type WorkOrderScope = {
  readonly objectiveClasses: readonly ObjectiveClass[];
  readonly activityClasses: readonly ActivityClass[];
  readonly productClasses: readonly ProductClass[];
  readonly capitalCeiling: SerializedMoney | null;
  readonly accountIds: readonly string[];
  readonly jurisdiction: Jurisdiction;
  readonly horizonDays: number | null;
  readonly toolIds: readonly string[];
  readonly modelIds: readonly string[];
};

export type MandateBindingRef = {
  readonly mandateId: EconomicMandateId;
  readonly mandateVersion: MandateVersion;
  readonly mandateOwnerCustomerId: CustomerId;
  readonly mandateSubjectId: string;
  readonly mandateState: MandateState;
  readonly effectiveAt: UtcInstant;
  readonly expiresAt: UtcInstant | null;
  readonly snapshotHash: string;
};

export type CapabilityBindingContext = {
  readonly customerId: CustomerId;
  readonly jurisdiction: Jurisdiction;
  readonly legalEntityId: string | null;
  readonly environment: 'simulation';
  readonly grantedCapabilities: readonly IdentityCapability[];
  readonly capabilityStates: Readonly<Record<string, CapabilityResolutionState>>;
  readonly contextVersion: string;
};

export type WorkOrderApprovalRef = {
  readonly approvalBindingId: WorkOrderApprovalBindingId;
  readonly approvalId: string;
  readonly customerId: CustomerId;
  readonly actorId: string;
  readonly actorKind: 'CUSTOMER' | 'HUMAN_OPERATOR';
  readonly approvalClass: ApprovalClass;
  readonly scopeHash: string;
  readonly effectiveAt: UtcInstant;
  readonly expiresAt: UtcInstant | null;
};

export type EconomicWorkOrder = {
  readonly workOrderId: EconomicWorkOrderId;
  readonly customerId: CustomerId;
  readonly subjectId: string;
  readonly growObjectiveId: string;
  readonly state: WorkOrderState;
  readonly requestedScope: WorkOrderScope;
  readonly effectiveScope: WorkOrderScope | null;
  readonly mandateRef: MandateBindingRef;
  readonly approvalRef: WorkOrderApprovalRef | null;
  readonly requiredApprovalClass: ApprovalClass;
  readonly createdAt: UtcInstant;
  readonly updatedAt: UtcInstant;
  readonly activatedAt: UtcInstant | null;
  readonly contentHash: string;
  readonly grantsExecutionAuthority: false;
  readonly authorizesFinancialExecution: false;
};

export type ScopeNarrowing = {
  readonly dimension: string;
  readonly requested: string;
  readonly allowed: string;
  readonly reasonCode: BindingReasonCode;
};

export type AuthorityBindingDecision = {
  readonly decisionId: AuthorityBindingDecisionId;
  readonly workOrderId: EconomicWorkOrderId;
  readonly customerId: CustomerId;
  readonly checkpoint: BindingCheckpoint;
  readonly outcome: BindingDecisionOutcome;
  readonly requestedScope: WorkOrderScope;
  readonly effectiveScope: WorkOrderScope | null;
  readonly narrowedElements: readonly ScopeNarrowing[];
  readonly reasonCodes: readonly BindingReasonCode[];
  readonly mandateRef: MandateBindingRef;
  readonly capabilityContextVersion: string | null;
  readonly approvalRef: WorkOrderApprovalRef | null;
  readonly decidedAt: UtcInstant;
  readonly actorId: string;
  readonly environment: 'simulation';
};

export type BindingFailure = {
  readonly code: BindingReasonCode;
  readonly message: string;
};

export type MandatePermittedScope = {
  readonly objectiveClasses: readonly ObjectiveClass[];
  readonly activityClasses: readonly ActivityClass[];
  readonly productClasses: readonly ProductClass[];
  readonly capitalCeiling: SerializedMoney | null;
  readonly prohibitedProductClasses: readonly ProductClass[];
  readonly prohibitedActivityClasses: readonly ActivityClass[];
  readonly jurisdictions: readonly Jurisdiction[];
};

export type PlatformCapabilityScope = {
  readonly activityClasses: readonly ActivityClass[];
  readonly productClasses: readonly ProductClass[];
  readonly objectiveClasses: readonly ObjectiveClass[];
};

export type ToolModelCapabilityGrant = {
  readonly grantId: string;
  readonly workOrderId: EconomicWorkOrderId;
  readonly customerId: CustomerId;
  readonly toolIds: readonly string[];
  readonly modelIds: readonly string[];
  readonly revocable: true;
  readonly issuedAt: UtcInstant;
  readonly revokedAt: UtcInstant | null;
};
