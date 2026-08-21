import type { Beneficiary } from './beneficiary.ts';
import type { FxQuote } from './fx-quote.ts';
import type { PaymentOrder } from './payment.ts';
import type { ReconciliationResult } from './reconciliation.ts';

export class PaymentStore {
  private readonly beneficiaries = new Map<string, Beneficiary>();
  private readonly quotes = new Map<string, FxQuote>();
  private readonly payments = new Map<string, PaymentOrder>();
  private readonly byIdempotency = new Map<string, PaymentOrder>();
  private readonly acceptedQuotes = new Map<string, string>();
  private readonly conversions = new Map<string, { readonly quoteId: string; readonly destinationAccountId: string; readonly journalIds: readonly string[] }>();
  private readonly reconciliations = new Map<string, ReconciliationResult>();

  saveBeneficiary(beneficiary: Beneficiary): void {
    this.beneficiaries.set(beneficiary.beneficiaryId, beneficiary);
  }

  getBeneficiary(id: string): Beneficiary | undefined {
    return this.beneficiaries.get(id);
  }

  listBeneficiaries(ownerId: string): readonly Beneficiary[] {
    return [...this.beneficiaries.values()].filter((row) => row.ownerId === ownerId);
  }

  saveQuote(quote: FxQuote): void {
    this.quotes.set(quote.quoteId, quote);
  }

  getQuote(id: string): FxQuote | undefined {
    return this.quotes.get(id);
  }

  markQuoteAccepted(quoteId: string, intentId: string): void {
    this.acceptedQuotes.set(quoteId, intentId);
  }

  acceptedIntentFor(quoteId: string): string | undefined {
    return this.acceptedQuotes.get(quoteId);
  }

  saveConversion(key: string, value: { readonly quoteId: string; readonly destinationAccountId: string; readonly journalIds: readonly string[] }): void {
    this.conversions.set(key, value);
  }

  getConversion(key: string): { readonly quoteId: string; readonly destinationAccountId: string; readonly journalIds: readonly string[] } | undefined {
    return this.conversions.get(key);
  }

  savePayment(payment: PaymentOrder): void {
    this.payments.set(payment.paymentId, payment);
    this.byIdempotency.set(payment.idempotencyKey, payment);
  }

  getPayment(id: string): PaymentOrder | undefined {
    return this.payments.get(id);
  }

  getPaymentByIdempotency(key: string): PaymentOrder | undefined {
    return this.byIdempotency.get(key);
  }

  saveReconciliation(result: ReconciliationResult): void {
    this.reconciliations.set(result.paymentId, result);
  }

  getReconciliation(paymentId: string): ReconciliationResult | undefined {
    return this.reconciliations.get(paymentId);
  }
}
