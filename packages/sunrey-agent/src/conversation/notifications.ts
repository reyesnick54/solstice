import { contentHash } from '../ids.ts';
import type { ActionCardStatus } from './taxonomy.ts';
import type { SafeNotification } from './types.ts';

export function notificationForStatus(input: {
  readonly actionId: string;
  readonly status: ActionCardStatus;
}): SafeNotification | null {
  const kind = kindFor(input.status);
  if (!kind) {
    return null;
  }
  return Object.freeze({
    notificationId: `ntf_${contentHash({ actionId: input.actionId, status: input.status }).slice(0, 16)}`,
    kind,
    title: titleFor(kind),
    body: bodyFor(kind),
    actionId: input.actionId,
    sensitiveDataIncluded: false,
    channelSafe: true,
  });
}

function kindFor(status: ActionCardStatus): SafeNotification['kind'] | null {
  switch (status) {
    case 'AWAITING_APPROVAL':
    case 'PROPOSAL_CREATED':
      return 'PROPOSAL_AWAITING_APPROVAL';
    case 'COMPLETED':
      return 'EXECUTION_COMPLETED';
    case 'FAILED':
      return 'EXECUTION_FAILED';
    case 'REQUIRES_REVIEW':
      return 'COMPLIANCE_REVIEW_REQUIRED';
    default:
      return null;
  }
}

function titleFor(kind: SafeNotification['kind']): string {
  switch (kind) {
    case 'PROPOSAL_AWAITING_APPROVAL':
      return 'An action is awaiting your approval';
    case 'EXECUTION_COMPLETED':
      return 'An action completed';
    case 'EXECUTION_FAILED':
      return 'An action failed';
    case 'COMPLIANCE_REVIEW_REQUIRED':
      return 'An action needs review';
    case 'PLAN_MONITORING_OPPORTUNITY':
      return 'A new growth opportunity is available';
    default: {
      const exhaustive: never = kind;
      return exhaustive;
    }
  }
}

function bodyFor(kind: SafeNotification['kind']): string {
  switch (kind) {
    case 'PROPOSAL_AWAITING_APPROVAL':
      return 'Open the Action Center to review a proposal. Amounts are not included in this notification.';
    case 'EXECUTION_COMPLETED':
      return 'Open Activity or the Action Center for the outcome. This message does not include balances.';
    case 'EXECUTION_FAILED':
      return 'Open the Action Center for the failure state. This message does not include balances.';
    case 'COMPLIANCE_REVIEW_REQUIRED':
      return 'A proposal is held for review. Open the Action Center.';
    case 'PLAN_MONITORING_OPPORTUNITY':
      return 'A monitoring cycle found something to review. This is not a trade.';
    default: {
      const exhaustive: never = kind;
      return exhaustive;
    }
  }
}
