import { createHash } from 'node:crypto';

export type RecurringObligationId = string & { readonly __brand: 'RecurringObligationId' };
export type SavingsOpportunityId = string & { readonly __brand: 'SavingsOpportunityId' };
export type SubscriptionActionId = string & { readonly __brand: 'SubscriptionActionId' };
export type SubscriptionApprovalId = string & { readonly __brand: 'SubscriptionApprovalId' };

function hash(parts: readonly string[]): string {
  return createHash('sha256').update(parts.join('|')).digest('hex').slice(0, 24);
}

export function recurringObligationIdFor(subjectId: string, merchantNormalized: string, currency: string): RecurringObligationId {
  return `robl_${hash([subjectId, merchantNormalized, currency])}` as RecurringObligationId;
}

export function savingsOpportunityIdFor(obligationId: string, opportunityType: string): SavingsOpportunityId {
  return `sopp_${hash([obligationId, opportunityType])}` as SavingsOpportunityId;
}

export function subscriptionActionIdFor(opportunityId: string, actionType: string, idempotencyKey: string): SubscriptionActionId {
  return `sact_${hash([opportunityId, actionType, idempotencyKey])}` as SubscriptionActionId;
}

export function subscriptionApprovalIdFor(actionId: string, actorId: string): SubscriptionApprovalId {
  return `sapr_${hash([actionId, actorId])}` as SubscriptionApprovalId;
}
