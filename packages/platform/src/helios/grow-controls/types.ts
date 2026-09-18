import type { UtcInstant } from '@solstice/domain';
import type {
  DegradedSeverity,
  GrowCloseMode,
  GrowCloseStatus,
  GrowOperationalDegradedCode,
  GrowPauseState,
  GrowWithdrawalStatus,
} from './taxonomy.ts';
import type { GrowControlNotificationKind } from './taxonomy.ts';

export type GrowControlMoney = {
  readonly minorUnits: string;
  readonly currency: string;
};

export type GrowPauseControl = {
  readonly state: GrowPauseState;
  readonly deploymentPaused: boolean;
  readonly inFlightExecutionIds: readonly string[];
  readonly inFlightProposalIds: readonly string[];
  readonly blockedReason: string | null;
  readonly updatedAt: UtcInstant;
  readonly evidenceRef: string | null;
};

export type GrowCloseRequest = {
  readonly closeRequestId: string;
  readonly customerId: string;
  readonly subjectId: string;
  readonly mode: GrowCloseMode;
  readonly instrumentIds: readonly string[];
  readonly status: GrowCloseStatus;
  readonly positionIds: readonly string[];
  readonly executionIds: readonly string[];
  readonly idempotencyKey: string;
  readonly requestedAt: UtcInstant;
  readonly updatedAt: UtcInstant;
  readonly failureCode: string | null;
  readonly evidenceRef: string | null;
};

export type GrowWithdrawalRequest = {
  readonly withdrawalId: string;
  readonly customerId: string;
  readonly subjectId: string;
  readonly amount: GrowControlMoney;
  readonly destinationAccountId: string;
  readonly sourceAccountId: string;
  readonly status: GrowWithdrawalStatus;
  readonly idempotencyKey: string;
  readonly requestedAt: UtcInstant;
  readonly updatedAt: UtcInstant;
  readonly journalId: string | null;
  readonly failureCode: string | null;
  readonly evidenceRef: string | null;
};

export type GrowMandateChangeRequest = {
  readonly changeId: string;
  readonly customerId: string;
  readonly subjectId: string;
  readonly sourceText: string;
  readonly appliedAt: UtcInstant;
  readonly requiresReview: boolean;
  readonly autoPauseDeployment: boolean;
  readonly evidenceRef: string | null;
};

export type GrowDegradedStateContract = {
  readonly code: GrowOperationalDegradedCode;
  readonly severity: DegradedSeverity;
  readonly affectedCapability: string;
  readonly customerImpact: string;
  readonly fundsAffected: boolean;
  readonly newDeploymentPaused: boolean;
  readonly withdrawalsAvailable: boolean;
  readonly customerActionRequired: boolean;
  readonly message: string;
  readonly evidenceRef: string | null;
  readonly observedAt: UtcInstant;
};

export type GrowControlNotification = {
  readonly notificationId: string;
  readonly kind: GrowControlNotificationKind;
  readonly customerId: string;
  readonly subjectId: string;
  readonly message: string;
  readonly evidenceRef: string | null;
  readonly createdAt: UtcInstant;
  readonly material: boolean;
};

export type GrowControlsStatusResponse = {
  readonly schema: 'sunrey.consumer.grow.controls.status.v1';
  readonly customerId: string;
  readonly subjectId: string;
  readonly pause: GrowPauseControl;
  readonly degradedStates: readonly GrowDegradedStateContract[];
  readonly pendingCloseRequests: readonly GrowCloseRequest[];
  readonly pendingWithdrawals: readonly GrowWithdrawalRequest[];
  readonly recentNotifications: readonly GrowControlNotification[];
  readonly serverOwned: true;
};

export type GrowControlFailure = {
  readonly code:
    | 'CUSTOMER_MISMATCH'
    | 'ACTOR_UNAUTHORIZED'
    | 'ALREADY_PAUSED'
    | 'NOT_PAUSED'
    | 'RESUME_BLOCKED'
    | 'DEPLOYMENT_PAUSED'
    | 'INSUFFICIENT_AVAILABLE_CASH'
    | 'RESERVED_CASH'
    | 'INVALID_DESTINATION'
    | 'WITHDRAWAL_IN_FLIGHT'
    | 'CLOSE_NOT_SUPPORTED'
    | 'POSITION_NOT_FOUND'
    | 'MANDATE_INVALID'
    | 'IDEMPOTENCY_CONFLICT'
    | 'PROVIDER_UNAVAILABLE'
    | 'ACCOUNT_RESTRICTED';
  readonly message: string;
};

export type GrowCashAvailability = {
  readonly settled: GrowControlMoney;
  readonly reconciled: GrowControlMoney;
  readonly available: GrowControlMoney;
  readonly unreserved: GrowControlMoney;
  readonly reserved: GrowControlMoney;
  readonly unsettled: GrowControlMoney;
  readonly deployed: GrowControlMoney;
};

export type ResumeRevalidationInput = {
  readonly mandateActive: boolean;
  readonly accountStatus: 'ACTIVE' | 'RESTRICTED' | 'PENDING';
  readonly providerCapable: boolean;
  readonly strategyEligible: boolean;
  readonly systemCapable: boolean;
  readonly jurisdictionPermitted: boolean;
  readonly complianceClear: boolean;
  readonly workOrderActive: boolean;
};

export type DegradedEvaluationInput = {
  readonly now: UtcInstant;
  readonly marketDataStale: boolean;
  readonly researchProviderDown: boolean;
  readonly s3mUnavailable: boolean;
  readonly executionProviderDown: boolean;
  readonly providerActionRequired: boolean;
  readonly reconciliationPending: boolean;
  readonly reconciliationMismatch: boolean;
  readonly settlementDelayed: boolean;
  readonly valuationStale: boolean;
  readonly capabilityReviewRequired: boolean;
  readonly regulatoryRestriction: boolean;
  readonly strategyReviewRequired: boolean;
  readonly systemMaintenance: boolean;
  readonly deploymentPaused: boolean;
};
