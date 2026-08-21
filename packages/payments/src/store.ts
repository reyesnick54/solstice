import type { Beneficiary } from './beneficiary.ts';
import type { FxExecution } from './fx-execution.ts';
import type { PaymentFxComposition } from './fx-payment.ts';
import type { FxQuote } from './fx-quote.ts';
import type { PaymentOrder } from './payment.ts';
import type { ReconciliationResult } from './reconciliation.ts';

export class PaymentStore {
  private readonly beneficiaries = new Map<string, Beneficiary>();
  private readonly quotes = new Map<string, FxQuote>();
  private readonly payments = new Map<string, PaymentOrder>();
  private readonly byIdempotency = new Map<string, PaymentOrder>();
  private readonly acceptedQuotes = new Map<string, string>();
  private readonly executions = new Map<string, FxExecution>();
  private readonly executionsByIdempotency = new Map<string, FxExecution>();
  private readonly executionsByQuote = new Map<string, FxExecution>();
  private readonly compositions = new Map<string, PaymentFxComposition>();
  private readonly compositionsByIdempotency = new Map<string, PaymentFxComposition>();
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

  saveExecution(execution: FxExecution): void {
    this.executions.set(execution.executionId, execution);
    this.executionsByIdempotency.set(execution.idempotencyKey, execution);
    this.executionsByQuote.set(execution.quoteId, execution);
  }

  getExecution(id: string): FxExecution | undefined {
    return this.executions.get(id);
  }

  getExecutionByQuote(quoteId: string): FxExecution | undefined {
    return this.executionsByQuote.get(quoteId);
  }

  getExecutionByIdempotency(key: string): FxExecution | undefined {
    return this.executionsByIdempotency.get(key);
  }

  saveComposition(composition: PaymentFxComposition): void {
    this.compositions.set(composition.compositionId, composition);
    this.compositionsByIdempotency.set(composition.idempotencyKey, composition);
  }

  getComposition(id: string): PaymentFxComposition | undefined {
    return this.compositions.get(id);
  }

  getCompositionByIdempotency(key: string): PaymentFxComposition | undefined {
    return this.compositionsByIdempotency.get(key);
  }
}
