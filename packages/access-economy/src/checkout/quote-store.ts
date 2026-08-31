/**
 * ACCESS Wave 3 Prompt 34 — Checkout quote idempotency store.
 */

import type { AccessCheckoutQuote } from './types.ts';

export class AccessCheckoutQuoteStore {
  private readonly byIdempotency = new Map<string, AccessCheckoutQuote>();
  private readonly byCheckoutQuoteId = new Map<string, AccessCheckoutQuote>();
  private readonly byProviderQuoteId = new Map<string, string>();

  getByIdempotencyKey(idempotencyKey: string): AccessCheckoutQuote | undefined {
    return this.byIdempotency.get(idempotencyKey);
  }

  getByCheckoutQuoteId(checkoutQuoteId: string): AccessCheckoutQuote | undefined {
    return this.byCheckoutQuoteId.get(checkoutQuoteId);
  }

  getCheckoutQuoteIdForProviderQuote(providerQuoteId: string): string | undefined {
    return this.byProviderQuoteId.get(providerQuoteId);
  }

  save(quote: AccessCheckoutQuote, idempotencyKey: string): AccessCheckoutQuote {
    const prior = this.byIdempotency.get(idempotencyKey);
    if (prior) {
      return prior;
    }
    this.byIdempotency.set(idempotencyKey, quote);
    this.byCheckoutQuoteId.set(quote.checkoutQuoteId, quote);
    this.byProviderQuoteId.set(quote.providerQuoteId, quote.checkoutQuoteId);
    return quote;
  }

  supersede(checkoutQuoteId: string, replacement: AccessCheckoutQuote): void {
    const prior = this.byCheckoutQuoteId.get(checkoutQuoteId);
    if (!prior) {
      return;
    }
    const superseded: AccessCheckoutQuote = Object.freeze({
      ...prior,
      status: 'SUPERSEDED',
      replacementProviderQuoteId: replacement.providerQuoteId,
    });
    this.byCheckoutQuoteId.set(checkoutQuoteId, superseded);
    this.byProviderQuoteId.set(replacement.providerQuoteId, replacement.checkoutQuoteId);
    this.byCheckoutQuoteId.set(replacement.checkoutQuoteId, replacement);
  }
}
