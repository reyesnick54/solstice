import type { UtcInstant } from '../../../domain/src/time.ts';
import { subscriptionActionIdFor } from './ids.ts';
import type { SavingsOpportunity, SubscriptionActionProposal } from './models.ts';
import { capabilityForAction } from './provider.ts';
import type { ActionCapabilityLevel } from './taxonomy.ts';

export function proposeAction(input: {
  readonly opportunity: SavingsOpportunity;
  readonly userId: string;
  readonly obligationCapabilities: {
    readonly cancel: ActionCapabilityLevel;
    readonly downgrade: ActionCapabilityLevel;
    readonly renegotiate: ActionCapabilityLevel;
    readonly switchProvider: ActionCapabilityLevel;
  };
  readonly idempotencyKey: string;
  readonly now: UtcInstant;
  readonly existing?: SubscriptionActionProposal | null;
}): SubscriptionActionProposal | { readonly code: 'DUPLICATE_REQUEST'; readonly action: SubscriptionActionProposal } {
  const actionId = subscriptionActionIdFor(
    input.opportunity.opportunityId,
    input.opportunity.recommendedAction,
    input.idempotencyKey,
  );

  if (input.existing && input.existing.actionId === actionId) {
    return { code: 'DUPLICATE_REQUEST', action: input.existing };
  }

  const capability = capabilityForAction(input.obligationCapabilities, input.opportunity.recommendedAction);

  return Object.freeze({
    actionId,
    opportunityId: input.opportunity.opportunityId,
    obligationId: input.opportunity.recurringObligationId,
    userId: input.userId,
    actionType: input.opportunity.recommendedAction,
    state: 'PROPOSED',
    capability,
    idempotencyKey: input.idempotencyKey,
    proposedAt: input.now,
    authorizedAt: null,
    completedAt: null,
    providerId: null,
    providerEvidenceRef: null,
    failureReason: null,
    requestSent: false,
    actionConfirmed: false,
  });
}

export function isIdempotentRetry(
  existing: SubscriptionActionProposal | undefined,
  idempotencyKey: string,
  opportunityId: string,
  actionType: string,
): boolean {
  if (!existing) {
    return false;
  }
  const expectedId = subscriptionActionIdFor(opportunityId, actionType, idempotencyKey);
  return existing.actionId === expectedId;
}
