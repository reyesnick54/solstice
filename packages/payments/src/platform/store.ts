import type { PaymentIntent } from './payment-intent.ts';
import type { PaymentQuotePreview } from './quote-preview.ts';
import type { InboundFundingNotice } from './inbound.ts';
import type { LimitUsage } from './limits.ts';
import type { UtcInstant } from '../../../domain/src/time.ts';

export type PaymentApproval = {
  readonly approvalId: string;
  readonly paymentId: string;
  readonly customerId: string;
  readonly status: 'PENDING' | 'APPROVED' | 'REJECTED';
  readonly createdAt: UtcInstant;
  readonly decidedAt: UtcInstant | null;
};

export class PaymentPlatformStore {
  private readonly intents = new Map<string, PaymentIntent>();
  private readonly byIdempotency = new Map<string, PaymentIntent>();
  private readonly quotes = new Map<string, PaymentQuotePreview>();
  private readonly approvals = new Map<string, PaymentApproval>();
  private readonly inbound = new Map<string, InboundFundingNotice>();
  private readonly usage = new Map<string, LimitUsage[]>();
  private readonly beneficiaryCreatedTimes = new Map<string, UtcInstant[]>();
  private readonly callbackDigests = new Set<string>();

  saveIntent(intent: PaymentIntent): void {
    this.intents.set(intent.paymentId, intent);
    this.byIdempotency.set(intent.idempotencyKey, intent);
  }

  getIntent(id: string): PaymentIntent | undefined {
    return this.intents.get(id);
  }

  getIntentByIdempotency(key: string): PaymentIntent | undefined {
    return this.byIdempotency.get(key);
  }

  listIntents(payerId: string): readonly PaymentIntent[] {
    return [...this.intents.values()].filter((row) => row.payerId === payerId);
  }

  saveQuote(quote: PaymentQuotePreview): void {
    this.quotes.set(quote.quoteId, quote);
  }

  getQuote(id: string): PaymentQuotePreview | undefined {
    return this.quotes.get(id);
  }

  saveApproval(approval: PaymentApproval): void {
    this.approvals.set(approval.approvalId, approval);
  }

  getApproval(id: string): PaymentApproval | undefined {
    return this.approvals.get(id);
  }

  approvalForPayment(paymentId: string): PaymentApproval | undefined {
    return [...this.approvals.values()].find((row) => row.paymentId === paymentId);
  }

  saveInbound(notice: InboundFundingNotice): void {
    this.inbound.set(notice.noticeId, notice);
  }

  getInbound(id: string): InboundFundingNotice | undefined {
    return this.inbound.get(id);
  }

  recordUsage(ownerId: string, usage: LimitUsage): void {
    const rows = this.usage.get(ownerId) ?? [];
    rows.push(usage);
    this.usage.set(ownerId, rows);
  }

  usageFor(ownerId: string): readonly LimitUsage[] {
    return this.usage.get(ownerId) ?? [];
  }

  recordBeneficiaryCreated(ownerId: string, at: UtcInstant): void {
    const rows = this.beneficiaryCreatedTimes.get(ownerId) ?? [];
    rows.push(at);
    this.beneficiaryCreatedTimes.set(ownerId, rows);
  }

  createdTimesFor(ownerId: string): readonly UtcInstant[] {
    return this.beneficiaryCreatedTimes.get(ownerId) ?? [];
  }

  seenCallback(digest: string): boolean {
    return this.callbackDigests.has(digest);
  }

  rememberCallback(digest: string): void {
    this.callbackDigests.add(digest);
  }
}
