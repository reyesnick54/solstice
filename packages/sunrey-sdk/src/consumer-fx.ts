import type { HttpTransport } from './http.ts';

/**
 * Lovable / consumer BFF FX client. The frontend sends amounts and
 * currencies only. It must not compute rates, spreads, or fees.
 */
export class ConsumerFxClient {
  private readonly http: HttpTransport;

  constructor(http: HttpTransport) {
    this.http = http;
  }

  listCurrencies(): Promise<unknown> {
    return this.http.get('/api/v1/fx/currencies');
  }

  valuation(targetCurrency = 'USD'): Promise<unknown> {
    return this.http.get(`/api/v1/fx/valuation?targetCurrency=${encodeURIComponent(targetCurrency)}`);
  }

  createQuote(input: {
    readonly sourceAccountId: string;
    readonly sourceCurrency: string;
    readonly destinationCurrency: string;
    readonly sourceAmountMinorUnits: string;
    readonly destinationAccountId?: string;
    readonly corridorId?: string;
    readonly quoteId?: string;
  }): Promise<unknown> {
    return this.http.post('/api/v1/fx/quotes', input);
  }

  getQuote(quoteId: string): Promise<unknown> {
    return this.http.get(`/api/v1/fx/quotes/${encodeURIComponent(quoteId)}`);
  }

  acceptQuote(quoteId: string, accountId: string): Promise<unknown> {
    return this.http.post(`/api/v1/fx/quotes/${encodeURIComponent(quoteId)}/accept`, { accountId });
  }

  executeQuote(
    quoteId: string,
    input: { readonly sourceAccountId: string; readonly destinationAccountId: string },
  ): Promise<unknown> {
    return this.http.post(`/api/v1/fx/quotes/${encodeURIComponent(quoteId)}/execute`, input);
  }
}

export function createConsumerFxClient(http: HttpTransport): ConsumerFxClient {
  return new ConsumerFxClient(http);
}
