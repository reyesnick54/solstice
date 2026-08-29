import type { Money } from '../../../money/src/money.ts';
import type { UtcInstant } from '../../../domain/src/time.ts';
import type { AccessRight } from './access-right.ts';
import type { CapacityReservation } from './capacity-reservation.ts';

/** User/workflow policy for partial failure handling. */
export const BUNDLE_FAILURE_POLICIES = [
  'ALL_OR_NOTHING',
  'PARTIAL_WITH_APPROVAL',
  'BEST_EFFORT',
] as const;
export type BundleFailurePolicy = (typeof BUNDLE_FAILURE_POLICIES)[number];

export const BUNDLE_COMPLETION_STATES = [
  'DRAFT',
  'PROPOSED',
  'AWAITING_USER_APPROVAL',
  'AUTHORIZED',
  'RESERVING',
  'PARTIALLY_RESERVED',
  'COMMITTING',
  'COMPLETED',
  'PARTIALLY_COMPLETED',
  'COMPENSATING',
  'FAILED',
  'CANCELLED',
] as const;
export type BundleCompletionState = (typeof BUNDLE_COMPLETION_STATES)[number];

export const COMPONENT_MANDATORY = ['MANDATORY', 'OPTIONAL'] as const;
export type ComponentMandatory = (typeof COMPONENT_MANDATORY)[number];

export type BundleComponentQuote = {
  readonly quoteId: string;
  readonly consideration: Money;
  readonly quotedAt: UtcInstant;
  readonly validUntil: UtcInstant;
};

export type ReservationWindow = {
  readonly start: UtcInstant;
  readonly end: UtcInstant;
};

export type BundleComponent = {
  readonly componentId: string;
  readonly label: string;
  readonly providerId: string;
  readonly resourceKind: import('./access-right.ts').AccessResourceKind;
  readonly unit: string;
  readonly mandatory: ComponentMandatory;
  readonly dependsOn: readonly string[];
  readonly alternativeGroup: string | null;
  readonly quote: BundleComponentQuote;
  readonly reservationWindow: ReservationWindow;
  readonly accessRight: AccessRight | null;
  readonly reservation: CapacityReservation | null;
  readonly entitlementConsumption: number;
  readonly state: 'PENDING' | 'HELD' | 'COMMITTED' | 'FAILED' | 'RELEASED' | 'SKIPPED';
  readonly failureReason: string | null;
};

export type BundleAlternative = {
  readonly alternativeGroup: string;
  readonly componentIds: readonly string[];
  readonly label: string;
};

export type UserApproval = {
  readonly approvalId: string;
  readonly approvedBy: string;
  readonly approvedAt: UtcInstant;
  readonly scope: 'BUNDLE_CONFIRMATION' | 'PARTIAL_COMPLETION';
  readonly approvedComponentIds: readonly string[] | null;
};

export type RollbackPolicy = {
  readonly releaseHolds: boolean;
  readonly refundCommitted: boolean;
  readonly surfaceAlternatives: boolean;
};

export type ExperienceBundle = {
  readonly bundleId: string;
  readonly subjectRef: string;
  readonly intentSummary: string;
  readonly failurePolicy: BundleFailurePolicy;
  readonly rollbackPolicy: RollbackPolicy;
  readonly completionState: BundleCompletionState;
  readonly components: readonly BundleComponent[];
  readonly alternatives: readonly BundleAlternative[];
  readonly totalConsideration: Money;
  readonly quoteValidUntil: UtcInstant;
  readonly userApprovals: readonly UserApproval[];
  readonly proposedBy: 'AI' | 'USER' | 'SYSTEM';
  readonly confirmedBy: string | null;
  readonly authorizationEvidenceId: string | null;
  readonly workflowEvidenceIds: readonly string[];
  readonly createdAt: UtcInstant;
  readonly updatedAt: UtcInstant;
};

export type ExperienceIntent = {
  readonly intentId: string;
  readonly subjectRef: string;
  readonly naturalLanguageRequest: string;
  readonly scenarioKey: string | null;
  readonly constraints: Readonly<Record<string, string>>;
  readonly requestedAt: UtcInstant;
};
