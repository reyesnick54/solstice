/**
 * Event catalog. Every recorded fact the agent, Growth OS, kernel, and
 * growth ledger may emit. Enforcement never depends on LLM interpretation
 * of these names.
 */
export const EVENT_CATALOG = [
  'customer.opened',
  'customer.status.changed',
  'customer.status.rejected',
  'mandate.compiled',
  'mandate.rejected',
  'mandate.set',
  'capability_token.issued',
  'capability_token.revoked',
  'capability_token.expired_used',
  'agent.proposal.emitted',
  'agent.proposal.blocked_by_token',
  'agent.proposal.allowed',
  'agent.proposal.refused',
  'compounder.step.evaluated',
  'financial_context.assembled',
  'financial_context.category_stripped',
  'growth.entry.recorded',
  'growth.principal_deposit.skipped',
  'subscription.classified',
  'subscription.cancellation_proposed',
  'merchant.bid.recorded',
  'opportunity.presented',
  'reward.route.proposed',
  'kernel.intent.submitted',
  'kernel.intent.refused',
  'execution_authority.issued',
  'ledger.journal.posted',
] as const;

export type CatalogEventName = (typeof EVENT_CATALOG)[number];

export function isCatalogEventName(value: unknown): value is CatalogEventName {
  return typeof value === 'string' && (EVENT_CATALOG as readonly string[]).includes(value);
}
