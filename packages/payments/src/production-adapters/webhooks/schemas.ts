/**
 * Domain-specific normalized webhook event schemas.
 * Real vendor adapters must implement actual provider verification.
 */

export const BANK_WEBHOOK_EVENTS = [
  'bank.account.created',
  'bank.account.updated',
  'bank.account.status_changed',
  'bank.account.closed',
  'bank.transaction.posted',
  'bank.transaction.updated',
] as const;
export type BankWebhookEvent = (typeof BANK_WEBHOOK_EVENTS)[number];

export const PAYMENT_WEBHOOK_EVENTS = [
  'payment.submitted',
  'payment.status_changed',
  'payment.pending',
  'payment.rejected',
  'payment.returned',
  'payment.settled',
] as const;
export type PaymentWebhookEvent = (typeof PAYMENT_WEBHOOK_EVENTS)[number];

export const FX_WEBHOOK_EVENTS = [
  'fx.quote.issued',
  'fx.quote.expired',
  'fx.trade.executed',
  'fx.trade.failed',
  'fx.trade.settled',
] as const;
export type FxWebhookEvent = (typeof FX_WEBHOOK_EVENTS)[number];

export const CARD_WEBHOOK_EVENTS = [
  'card.issued',
  'card.frozen',
  'card.unfrozen',
  'card.authorization',
  'card.declined',
  'card.capture',
  'card.reversal',
  'card.refund',
  'card.dispute',
  'card.wallet.eligibility',
] as const;
export type CardWebhookEvent = (typeof CARD_WEBHOOK_EVENTS)[number];

export const FINANCIAL_WEBHOOK_EVENTS = [
  ...BANK_WEBHOOK_EVENTS,
  ...PAYMENT_WEBHOOK_EVENTS,
  ...FX_WEBHOOK_EVENTS,
  ...CARD_WEBHOOK_EVENTS,
] as const;
export type FinancialWebhookEvent = (typeof FINANCIAL_WEBHOOK_EVENTS)[number];

export type NormalizedFinancialWebhook = {
  readonly eventType: FinancialWebhookEvent;
  readonly providerId: string;
  readonly providerEventId: string;
  readonly occurredAt: string;
  readonly originalProviderEventType: string;
  readonly payload: Readonly<Record<string, unknown>>;
};

export function isFinancialWebhookEvent(value: string): value is FinancialWebhookEvent {
  return (FINANCIAL_WEBHOOK_EVENTS as readonly string[]).includes(value);
}

export function normalizeWebhookEventType(providerEventType: string): FinancialWebhookEvent | null {
  const key = providerEventType.trim().toLowerCase().replace(/[\s_]+/g, '.');
  if (isFinancialWebhookEvent(key)) {
    return key;
  }
  switch (key) {
    case 'account.created':
    case 'baas.account.created':
      return 'bank.account.created';
    case 'account.closed':
      return 'bank.account.closed';
    case 'transaction.posted':
      return 'bank.transaction.posted';
    case 'payment.completed':
    case 'payment.success':
      return 'payment.settled';
    case 'fx.executed':
      return 'fx.trade.executed';
    case 'authorization':
      return 'card.authorization';
    case 'capture':
      return 'card.capture';
    default:
      return null;
  }
}
