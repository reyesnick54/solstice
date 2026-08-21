import type { ApprovalRequirement, ConsumerActionStatus } from './types.ts';

export type ActionStatusResource = {
  readonly actionId: string;
  readonly kind: string;
  readonly status: ConsumerActionStatus;
  readonly approvalRequirement: ApprovalRequirement;
  readonly regulated: boolean;
  readonly title: string;
  readonly detail: string;
  readonly createdAt: string;
};

/**
 * Map internal workflow / Kernel-adjacent states onto client-safe action
 * statuses. Regulated states are preserved, not collapsed for UI simplicity.
 */
export function mapInternalActionStatus(internal: string): {
  readonly status: ConsumerActionStatus;
  readonly approvalRequirement: ApprovalRequirement;
} {
  switch (internal) {
    case 'HOLD':
    case 'DEFER':
      return { status: 'PENDING', approvalRequirement: 'KERNEL_HOLD' };
    case 'REQUIRE_MANUAL_REVIEW':
      return { status: 'AWAITING_APPROVAL', approvalRequirement: 'MANUAL_REVIEW' };
    case 'BLOCK':
    case 'REFUSE':
      return { status: 'FAILED', approvalRequirement: 'NONE' };
    case 'ACTION_REQUIRED':
    case 'STEP_UP':
      return { status: 'ACTION_REQUIRED', approvalRequirement: 'STEP_UP_AUTHENTICATION' };
    case 'AWAITING_APPROVAL':
    case 'CUSTOMER_CONFIRMATION':
      return { status: 'AWAITING_APPROVAL', approvalRequirement: 'CUSTOMER_CONFIRMATION' };
    case 'PROCESSING':
    case 'SUBMITTED':
    case 'ACCEPTED':
      return { status: 'PROCESSING', approvalRequirement: 'NONE' };
    case 'ALLOW':
    case 'COMPLETED':
    case 'POSTED':
    case 'OPENED':
      return { status: 'COMPLETED', approvalRequirement: 'NONE' };
    case 'CANCELLED':
    case 'CANCELED':
      return { status: 'CANCELLED', approvalRequirement: 'NONE' };
    case 'FAILED':
    case 'EXPIRED':
      return { status: 'FAILED', approvalRequirement: 'NONE' };
    default:
      return { status: 'PENDING', approvalRequirement: 'NONE' };
  }
}
