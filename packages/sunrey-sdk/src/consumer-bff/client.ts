/**
 * Lovable-safe Consumer BFF client for `/api/v1` payments and recipients.
 * Distinct from `/v1/consumer` platform routes. Does not import Ledger,
 * Kernel, or Execution Authority.
 */

import type {
  Payment,
  PaymentApproval,
  PaymentCreateInput,
  PaymentQuote,
  PaymentQuoteInput,
  Recipient,
  RecipientCreateInput,
} from './types.ts';

export type BffAuthProvider = {
  getAccessToken(): string | undefined | Promise<string | undefined>;
};

export type ConsumerBffClientOptions = {
  readonly baseUrl: string;
  readonly auth?: BffAuthProvider;
  readonly getAccessToken?: () => string | undefined | Promise<string | undefined>;
  readonly generateRequestId?: () => string;
  readonly fetchImpl?: typeof fetch;
};

export type BffRequestOptions = {
  readonly requestId?: string;
  readonly idempotencyKey?: string;
};

function newRequestId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `req_${Math.random().toString(16).slice(2)}${Date.now().toString(16)}`;
}

export class SunReyConsumerBffClient {
  readonly baseUrl: string;
  private readonly auth: BffAuthProvider | undefined;
  private readonly generateRequestId: () => string;
  private readonly fetchImpl: typeof fetch;

  constructor(options: ConsumerBffClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, '');
    this.auth =
      options.auth ??
      (options.getAccessToken ? { getAccessToken: options.getAccessToken } : undefined);
    this.generateRequestId = options.generateRequestId ?? newRequestId;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async listRecipients(options?: BffRequestOptions): Promise<{ readonly items: readonly Recipient[] }> {
    return this.request('GET', '/api/v1/recipients', undefined, options);
  }

  async createRecipient(input: RecipientCreateInput, options?: BffRequestOptions): Promise<Recipient> {
    return this.request('POST', '/api/v1/recipients', input, options);
  }

  async getRecipient(id: string, options?: BffRequestOptions): Promise<Recipient> {
    return this.request('GET', `/api/v1/recipients/${encodeURIComponent(id)}`, undefined, options);
  }

  async quotePayment(input: PaymentQuoteInput, options?: BffRequestOptions): Promise<PaymentQuote> {
    return this.request('POST', '/api/v1/payments/quote', input, options);
  }

  async createPayment(input: PaymentCreateInput, options?: BffRequestOptions): Promise<Payment> {
    return this.request('POST', '/api/v1/payments', input, options);
  }

  async listPayments(options?: BffRequestOptions): Promise<{ readonly items: readonly Payment[] }> {
    return this.request('GET', '/api/v1/payments', undefined, options);
  }

  async getPayment(id: string, options?: BffRequestOptions): Promise<Payment> {
    return this.request('GET', `/api/v1/payments/${encodeURIComponent(id)}`, undefined, options);
  }

  async listGrowOpportunities(options?: BffRequestOptions): Promise<import('./types.ts').GrowOpportunityFeed> {
    return this.request('GET', '/api/v1/grow/opportunities', undefined, options);
  }

  async getGrowOpportunity(id: string, options?: BffRequestOptions): Promise<unknown> {
    return this.request('GET', `/api/v1/grow/opportunities/${encodeURIComponent(id)}`, undefined, options);
  }

  async dismissGrowOpportunity(id: string, options?: BffRequestOptions): Promise<unknown> {
    return this.request('POST', `/api/v1/grow/opportunities/${encodeURIComponent(id)}/dismiss`, {}, options);
  }

  async startGrowProposal(id: string, options?: BffRequestOptions): Promise<import('./types.ts').GrowProposalReceipt> {
    return this.request('POST', `/api/v1/grow/opportunities/${encodeURIComponent(id)}/start-proposal`, {}, options);
  }

  async approvePayment(
    id: string,
    input: { readonly approvalId?: string } = {},
    options?: BffRequestOptions,
  ): Promise<Payment> {
    return this.request('POST', `/api/v1/payments/${encodeURIComponent(id)}/approve`, input, options);
  }

  async request<T>(
    method: 'GET' | 'POST',
    path: string,
    body?: unknown,
    options?: BffRequestOptions,
  ): Promise<T> {
    const requestId = options?.requestId ?? this.generateRequestId();
    const headers: Record<string, string> = {
      accept: 'application/json',
      'x-request-id': requestId,
      'x-sunrey-api-version': 'v1',
    };
    const token = await this.auth?.getAccessToken();
    if (token) {
      headers.authorization = `Bearer ${token}`;
    }
    if (body !== undefined) {
      headers['content-type'] = 'application/json';
    }
    if (options?.idempotencyKey) {
      headers['idempotency-key'] = options.idempotencyKey;
    }
    const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
      method,
      headers,
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    const text = await response.text();
    const parsed = text.length === 0 ? {} : (JSON.parse(text) as unknown);
    if (!response.ok) {
      const message =
        parsed && typeof parsed === 'object' && 'message' in parsed
          ? String((parsed as { message: unknown }).message)
          : response.statusText;
      throw new Error(`Consumer BFF ${method} ${path} failed (${response.status}): ${message}`);
    }
    return parsed as T;
  }
}

export function createSunReyConsumerBffClient(options: ConsumerBffClientOptions): SunReyConsumerBffClient {
  return new SunReyConsumerBffClient(options);
}

export type { PaymentApproval };
