// @ts-nocheck
import type { UtcInstant } from '../../../domain/src/time.ts';
import { subscriptionApprovalIdFor } from './ids.ts';
import type { SubscriptionActionProposal, SubscriptionApproval } from './models.ts';
import type { ActionLifecycleState } from './taxonomy.ts';

export type AuthorizationFailure = {
  readonly code:
    | 'ACTION_NOT_FOUND'
    | 'ALREADY_AUTHORIZED'
    | 'ALREADY_COMPLETED'
    | 'ADVISORY_ONLY'
    | 'ACTOR_MISMATCH'
    | 'STEP_UP_REQUIRED';
  readonly message: string;
};

const LEGAL: Readonly<Record<ActionLifecycleState, readonly ActionLifecycleState[]>> = Object.freeze({
  PROPOSED: Object.freeze(['USER_REVIEW', 'FAILED']),
  USER_REVIEW: Object.freeze(['AUTHORIZED', 'FAILED']),
  AUTHORIZED: Object.freeze(['EXECUTING', 'FAILED']),
  EXECUTING: Object.freeze(['CONFIRMED', 'FAILED']),
  CONFIRMED: Object.freeze([]),
  FAILED: Object.freeze([]),
});

export function transitionActionState(
  action: SubscriptionActionProposal,
  to: ActionLifecycleState,
  now: UtcInstant,
  patch: Partial<SubscriptionActionProposal> = {},
): SubscriptionActionProposal | AuthorizationFailure {
  if (!LEGAL[action.state].includes(to)) {
    return { code: 'ALREADY_COMPLETED', message: `cannot transition ${action.state} to ${to}` };
  }
  return Object.freeze({
    ...action,
    ...patch,
    state: to,
    ...(to === 'AUTHORIZED' ? { authorizedAt: now } : {}),
    ...(to === 'CONFIRMED' || to === 'FAILED' ? { completedAt: now } : {}),
  });
}

export function authorizeAction(input: {
  readonly action: SubscriptionActionProposal;
  readonly userId: string;
  readonly actorId: string;
  readonly now: UtcInstant;
  readonly stepUpSatisfied: boolean;
}): { readonly approval: SubscriptionApproval; readonly action: SubscriptionActionProposal } | AuthorizationFailure {
  if (input.action.userId !== input.userId || input.action.userId !== input.actorId) {
    return { code: 'ACTOR_MISMATCH', message: 'authorization requires matching user and actor' };
  }
  if (input.action.capability === 'ADVISORY_ONLY' || input.action.capability === 'MANUAL_USER_ACTION') {
    return { code: 'ADVISORY_ONLY', message: 'this action is advisory-only and cannot be authorized for execution' };
  }
  if (input.action.state === 'CONFIRMED' || input.action.state === 'FAILED') {
    return { code: 'ALREADY_COMPLETED', message: 'action already completed' };
  }
  if (input.action.state === 'AUTHORIZED' || input.action.state === 'EXECUTING') {
    return { code: 'ALREADY_AUTHORIZED', message: 'action already authorized' };
  }
  if (!input.stepUpSatisfied) {
    return { code: 'STEP_UP_REQUIRED', message: 'step-up authentication required' };
  }

  const toReview =
    input.action.state === 'PROPOSED'
      ? transitionActionState(input.action, 'USER_REVIEW', input.now)
      : input.action;
  if ('code' in toReview) {
    return toReview;
  }

  const authorized = transitionActionState(toReview, 'AUTHORIZED', input.now);
  if ('code' in authorized) {
    return authorized;
  }

  const approval: SubscriptionApproval = Object.freeze({
    approvalId: subscriptionApprovalIdFor(input.action.actionId, input.actorId),
    actionId: input.action.actionId,
    userId: input.userId,
    actorId: input.actorId,
    approvedAt: input.now,
    stepUpSatisfied: input.stepUpSatisfied,
  });

  return Object.freeze({ approval, action: authorized });
}
