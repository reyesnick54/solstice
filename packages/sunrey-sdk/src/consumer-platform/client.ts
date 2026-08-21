/**
 * Browser-safe SunRey consumer platform client.
 *
 * Uses fetch only. Does not embed UI, ledger math, Execution Authority,
 * private keys, or provider credentials.
 */

import {
  CONSUMER_API_VERSION,
  SunReyConsumerError,
  isConsumerErrorEnvelope,
  type ConsumerErrorEnvelope,
} from './errors.ts';
import type {
  AccountDto,
  ActionDecisionDto,
  ActivityItemDto,
  ApprovalDto,
  BootstrapDto,
  CapabilityDto,
  DeviceDto,
  FeatureFlagDto,
  HealthDto,
  HomeDto,
  JobDto,
  MeDto,
  PageDto,
  PasskeyChallengeDto,
  RegisterResponse,
  SandboxPersonaDto,
  SessionDto,
  TokenResponse,
  VersionDto,
  WebhookEndpointDto,
  CardDto,
  CardDetailDto,
  FxQuoteDto,
  PaymentDto,
  RecipientDto,
  TransferDto,
} from './types.ts';

export type ConsumerAuthProvider = {
  getAccessToken(): string | undefined | Promise<string | undefined>;
  onUnauthorized?(error: SunReyConsumerError): void | Promise<void>;
};

export type ConsumerClientOptions = {
  readonly baseUrl: string;
  readonly auth?: ConsumerAuthProvider;
  readonly getAccessToken?: () => string | undefined | Promise<string | undefined>;
  readonly onUnauthorized?: (error: SunReyConsumerError) => void | Promise<void>;
  readonly generateRequestId?: () => string;
  readonly fetchImpl?: typeof fetch;
  readonly timeoutMs?: number;
};

export type ConsumerRequestOptions = {
  readonly signal?: AbortSignal;
  readonly requestId?: string;
  readonly idempotencyKey?: string;
  readonly timeoutMs?: number;
};

export type ConsumerPageQuery = {
  readonly cursor?: string | undefined;
  readonly page_size?: number | undefined;
};

function newRequestId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `req_${Math.random().toString(16).slice(2)}${Date.now().toString(16)}`;
}

function joinUrl(baseUrl: string, path: string): string {
  return `${baseUrl.replace(/\/$/, '')}${path}`;
}

function queryString(params: Readonly<Record<string, string | number | undefined>>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === '') {
      continue;
    }
    search.set(key, String(value));
  }
  const encoded = search.toString();
  return encoded.length === 0 ? '' : `?${encoded}`;
}

export class SunReyConsumerClient {
  readonly baseUrl: string;
  readonly apiVersion = CONSUMER_API_VERSION;
  private readonly auth: ConsumerAuthProvider | undefined;
  private readonly generateRequestId: () => string;
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number | undefined;

  constructor(options: ConsumerClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, '');
    this.auth =
      options.auth ??
      (options.getAccessToken || options.onUnauthorized
        ? {
            getAccessToken: options.getAccessToken ?? (() => undefined),
            ...(options.onUnauthorized ? { onUnauthorized: options.onUnauthorized } : {}),
          }
        : undefined);
    this.generateRequestId = options.generateRequestId ?? newRequestId;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.timeoutMs = options.timeoutMs;
  }

  async health(options?: ConsumerRequestOptions): Promise<HealthDto> {
    return this.request('GET', '/health', undefined, options);
  }

  async version(options?: ConsumerRequestOptions): Promise<VersionDto> {
    return this.request('GET', '/v1/consumer/version', undefined, options);
  }

  async register(
    input: { readonly home_jurisdiction: string },
    options?: ConsumerRequestOptions,
  ): Promise<RegisterResponse> {
    return this.request('POST', '/v1/consumer/auth/register', input, options);
  }

  async beginPasskeyRegistration(
    input: { readonly identity_id: string },
    options?: ConsumerRequestOptions,
  ): Promise<PasskeyChallengeDto> {
    return this.request('POST', '/v1/consumer/auth/passkey/register/begin', input, options);
  }

  async completePasskeyRegistration(
    input: {
      readonly challenge_id: string;
      readonly credential_id: string;
      readonly public_key_material: string;
      readonly transports: readonly string[];
      readonly device_ref?: string;
    },
    options?: ConsumerRequestOptions,
  ): Promise<{ readonly device_id: string; readonly identity_id: string }> {
    return this.request('POST', '/v1/consumer/auth/passkey/register/complete', input, options);
  }

  async beginPasskeyLogin(
    input: { readonly identity_id: string },
    options?: ConsumerRequestOptions,
  ): Promise<PasskeyChallengeDto> {
    return this.request('POST', '/v1/consumer/auth/passkey/login/begin', input, options);
  }

  async completePasskeyLogin(
    input: {
      readonly challenge_id: string;
      readonly credential_id: string;
      readonly authenticator_data: string;
      readonly client_data_json: string;
      readonly signature: string;
      readonly sign_count: number;
      readonly actor_id: string;
      readonly device_ref?: string;
    },
    options?: ConsumerRequestOptions,
  ): Promise<TokenResponse> {
    return this.request('POST', '/v1/consumer/auth/passkey/login/complete', input, options);
  }

  async refresh(options?: ConsumerRequestOptions): Promise<TokenResponse> {
    return this.request('POST', '/v1/consumer/auth/refresh', {}, options);
  }

  async logout(options?: ConsumerRequestOptions): Promise<{ readonly revoked: true }> {
    return this.request('POST', '/v1/consumer/auth/logout', {}, options);
  }

  async requestRecovery(
    input: { readonly identity_id: string },
    options?: ConsumerRequestOptions,
  ): Promise<{ readonly recovery_request_id: string; readonly state: string }> {
    return this.request('POST', '/v1/consumer/auth/recovery', input, options);
  }

  async mfaStatus(options?: ConsumerRequestOptions): Promise<{
    readonly factors: readonly string[];
    readonly totp_enrolled: false;
    readonly passkey_available: boolean;
  }> {
    return this.request('GET', '/v1/consumer/auth/mfa', undefined, options);
  }

  async listSandboxPersonas(options?: ConsumerRequestOptions): Promise<{
    readonly items: readonly SandboxPersonaDto[];
  }> {
    return this.request('GET', '/v1/consumer/auth/sandbox/personas', undefined, options);
  }

  async loginSandboxPersona(
    personaId: string,
    options?: ConsumerRequestOptions,
  ): Promise<TokenResponse> {
    return this.request(
      'POST',
      `/v1/consumer/auth/sandbox/personas/${encodeURIComponent(personaId)}/session`,
      {},
      options,
    );
  }

  async expireSandboxSession(options?: ConsumerRequestOptions): Promise<{ readonly expired: true }> {
    return this.request('POST', '/v1/consumer/auth/sandbox/expire-session', {}, options);
  }

  async listSessions(options?: ConsumerRequestOptions): Promise<{ readonly items: readonly SessionDto[] }> {
    return this.request('GET', '/v1/consumer/sessions', undefined, options);
  }

  async revokeSession(
    sessionId: string,
    options?: ConsumerRequestOptions,
  ): Promise<{ readonly revoked: true }> {
    return this.request('DELETE', `/v1/consumer/sessions/${encodeURIComponent(sessionId)}`, undefined, options);
  }

  async listDevices(options?: ConsumerRequestOptions): Promise<{ readonly items: readonly DeviceDto[] }> {
    return this.request('GET', '/v1/consumer/devices', undefined, options);
  }

  async setDeviceTrust(
    deviceId: string,
    input: { readonly trust_state: 'KNOWN' | 'TRUSTED' | 'REVIEW_REQUIRED' | 'BLOCKED' },
    options?: ConsumerRequestOptions,
  ): Promise<DeviceDto> {
    return this.request(
      'POST',
      `/v1/consumer/devices/${encodeURIComponent(deviceId)}/trust`,
      input,
      options,
    );
  }

  async me(options?: ConsumerRequestOptions): Promise<MeDto> {
    return this.request('GET', '/v1/consumer/me', undefined, options);
  }

  async bootstrap(options?: ConsumerRequestOptions): Promise<BootstrapDto> {
    return this.request('GET', '/v1/consumer/bootstrap', undefined, options);
  }

  async home(options?: ConsumerRequestOptions): Promise<HomeDto> {
    return this.request('GET', '/v1/consumer/home', undefined, options);
  }

  async listAccounts(
    page?: ConsumerPageQuery,
    options?: ConsumerRequestOptions,
  ): Promise<PageDto<AccountDto>> {
    return this.request(
      'GET',
      `/v1/consumer/accounts${queryString({
        cursor: page?.cursor,
        page_size: page?.page_size,
      })}`,
      undefined,
      options,
    );
  }

  async getAccount(accountId: string, options?: ConsumerRequestOptions): Promise<AccountDto> {
    return this.request('GET', `/v1/consumer/accounts/${encodeURIComponent(accountId)}`, undefined, options);
  }

  async listActivity(
    page?: ConsumerPageQuery,
    options?: ConsumerRequestOptions,
  ): Promise<PageDto<ActivityItemDto>> {
    return this.request(
      'GET',
      `/v1/consumer/activity${queryString({
        cursor: page?.cursor,
        page_size: page?.page_size,
      })}`,
      undefined,
      options,
    );
  }

  async capabilities(options?: ConsumerRequestOptions): Promise<{
    readonly items: readonly CapabilityDto[];
  }> {
    return this.request('GET', '/v1/consumer/capabilities', undefined, options);
  }

  async getFeature(featureId: string, options?: ConsumerRequestOptions): Promise<FeatureFlagDto> {
    return this.request('GET', `/v1/consumer/features/${encodeURIComponent(featureId)}`, undefined, options);
  }

  async submitAction(
    input: {
      readonly action_type: 'OPEN_ACCOUNT';
      readonly idempotency_key: string;
      readonly account_id?: string;
    },
    options?: ConsumerRequestOptions,
  ): Promise<ActionDecisionDto> {
    const requestOptions: ConsumerRequestOptions = options?.idempotencyKey
      ? options
      : { ...(options ?? {}), idempotencyKey: input.idempotency_key };
    return this.request('POST', '/v1/consumer/actions', input, requestOptions);
  }

  async getAction(actionId: string, options?: ConsumerRequestOptions): Promise<ActionDecisionDto> {
    return this.request('GET', `/v1/consumer/actions/${encodeURIComponent(actionId)}`, undefined, options);
  }

  async listApprovals(options?: ConsumerRequestOptions): Promise<{ readonly items: readonly ApprovalDto[] }> {
    return this.request('GET', '/v1/consumer/approvals', undefined, options);
  }

  async getApproval(approvalId: string, options?: ConsumerRequestOptions): Promise<ApprovalDto> {
    return this.request('GET', `/v1/consumer/approvals/${encodeURIComponent(approvalId)}`, undefined, options);
  }

  async acknowledgeApproval(
    approvalId: string,
    options?: ConsumerRequestOptions,
  ): Promise<ApprovalDto> {
    return this.request(
      'POST',
      `/v1/consumer/approvals/${encodeURIComponent(approvalId)}/acknowledge`,
      {},
      options,
    );
  }

  async getJob(jobId: string, options?: ConsumerRequestOptions): Promise<JobDto> {
    return this.request('GET', `/v1/consumer/jobs/${encodeURIComponent(jobId)}`, undefined, options);
  }

  async createWebhook(
    input: { readonly url: string; readonly event_types: readonly string[] },
    options?: ConsumerRequestOptions,
  ): Promise<WebhookEndpointDto> {
    return this.request('POST', '/v1/consumer/webhooks', input, options);
  }

  async listWebhooks(options?: ConsumerRequestOptions): Promise<{
    readonly items: readonly WebhookEndpointDto[];
  }> {
    return this.request('GET', '/v1/consumer/webhooks', undefined, options);
  }

  async testWebhook(endpointId: string, options?: ConsumerRequestOptions): Promise<JobDto> {
    return this.request(
      'POST',
      `/v1/consumer/webhooks/${encodeURIComponent(endpointId)}/test`,
      {},
      options,
    );
  }

  async createTransfer(
    input: {
      readonly source_account_id: string;
      readonly destination_account_id: string;
      readonly amount: { readonly minor_units: string; readonly currency: string };
      readonly idempotency_key?: string;
    },
    options?: ConsumerRequestOptions,
  ): Promise<TransferDto> {
    return this.request('POST', '/v1/consumer/transfers', input, options);
  }

  async listRecipients(options?: ConsumerRequestOptions): Promise<{
    readonly items: readonly RecipientDto[];
  }> {
    return this.request('GET', '/v1/consumer/recipients', undefined, options);
  }

  async createRecipient(
    input: {
      readonly legal_name: string;
      readonly destination_country?: string;
      readonly currency?: string;
      readonly account_coordinate?: string;
      readonly scheme?: string;
      readonly idempotency_key?: string;
    },
    options?: ConsumerRequestOptions,
  ): Promise<RecipientDto> {
    return this.request('POST', '/v1/consumer/recipients', input, options);
  }

  async createPaymentQuote(
    input: {
      readonly account_id?: string;
      readonly source_currency?: string;
      readonly destination_currency?: string;
      readonly amount?: { readonly minor_units: string; readonly currency: string };
      readonly corridor_id?: string;
      readonly idempotency_key?: string;
    },
    options?: ConsumerRequestOptions,
  ): Promise<FxQuoteDto> {
    return this.request('POST', '/v1/consumer/payments/quotes', input, options);
  }

  async submitPayment(
    input: {
      readonly quote_id: string;
      readonly recipient_id: string;
      readonly purpose?: string;
      readonly idempotency_key?: string;
    },
    options?: ConsumerRequestOptions,
  ): Promise<PaymentDto> {
    return this.request('POST', '/v1/consumer/payments', input, options);
  }

  async getPayment(paymentId: string, options?: ConsumerRequestOptions): Promise<PaymentDto> {
    return this.request('GET', `/v1/consumer/payments/${encodeURIComponent(paymentId)}`, undefined, options);
  }

  async createFxQuote(
    input: {
      readonly account_id?: string;
      readonly source_currency?: string;
      readonly destination_currency?: string;
      readonly amount?: { readonly minor_units: string; readonly currency: string };
      readonly corridor_id?: string;
      readonly idempotency_key?: string;
    },
    options?: ConsumerRequestOptions,
  ): Promise<FxQuoteDto> {
    return this.request('POST', '/v1/consumer/fx/quotes', input, options);
  }

  async acceptFxQuote(quoteId: string, options?: ConsumerRequestOptions): Promise<FxQuoteDto> {
    return this.request(
      'POST',
      `/v1/consumer/fx/quotes/${encodeURIComponent(quoteId)}/accept`,
      {},
      options,
    );
  }

  async executeFxQuote(
    quoteId: string,
    input: { readonly destination_account_id?: string } = {},
    options?: ConsumerRequestOptions,
  ): Promise<FxQuoteDto> {
    return this.request(
      'POST',
      `/v1/consumer/fx/quotes/${encodeURIComponent(quoteId)}/execute`,
      input,
      options,
    );
  }

  async listCards(options?: ConsumerRequestOptions): Promise<{ readonly items: readonly CardDto[] }> {
    return this.request('GET', '/v1/consumer/cards', undefined, options);
  }

  async issueCard(
    input: { readonly idempotency_key?: string } = {},
    options?: ConsumerRequestOptions,
  ): Promise<CardDto> {
    return this.request('POST', '/v1/consumer/cards', input, options);
  }

  async freezeCard(cardId: string, options?: ConsumerRequestOptions): Promise<CardDto> {
    return this.request(
      'POST',
      `/v1/consumer/cards/${encodeURIComponent(cardId)}/freeze`,
      {},
      options,
    );
  }

  async unfreezeCard(cardId: string, options?: ConsumerRequestOptions): Promise<CardDto> {
    return this.request(
      'POST',
      `/v1/consumer/cards/${encodeURIComponent(cardId)}/unfreeze`,
      {},
      options,
    );
  }

  async getCard(cardId: string, options?: ConsumerRequestOptions): Promise<CardDetailDto> {
    return this.request('GET', `/v1/consumer/cards/${encodeURIComponent(cardId)}`, undefined, options);
  }

  async patchCardControls(
    cardId: string,
    input: Partial<{
      readonly frozen: boolean;
      readonly onlineTransactions: boolean;
      readonly internationalTransactions: boolean;
      readonly cashWithdrawal: boolean;
      readonly contactless: boolean;
      readonly transactionLimitMinor: string | null;
      readonly dailyLimitMinor: string | null;
    }>,
    options?: ConsumerRequestOptions,
  ): Promise<CardDto> {
    return this.request('PATCH', `/api/v1/cards/${encodeURIComponent(cardId)}/controls`, input, options);
  }

  async getCardWallet(cardId: string, options?: ConsumerRequestOptions): Promise<CardDetailDto['wallet']> {
    return this.request('GET', `/api/v1/cards/${encodeURIComponent(cardId)}/wallet`, undefined, options);
  }

  async request<T>(
    method: 'GET' | 'POST' | 'DELETE' | 'PATCH',
    path: string,
    body?: unknown,
    options?: ConsumerRequestOptions,
  ): Promise<T> {
    const requestId = options?.requestId ?? this.generateRequestId();
    const headers: Record<string, string> = {
      accept: 'application/json',
      'x-request-id': requestId,
      'x-sunrey-api-version': CONSUMER_API_VERSION,
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

    const timeoutMs = options?.timeoutMs ?? this.timeoutMs;
    const controller = timeoutMs === undefined ? null : new AbortController();
    const timer =
      controller && timeoutMs !== undefined
        ? setTimeout(() => controller.abort(), timeoutMs)
        : null;
    if (options?.signal && controller) {
      options.signal.addEventListener('abort', () => controller.abort(), { once: true });
    }

    try {
      const response = await this.fetchImpl(joinUrl(this.baseUrl, path), {
        method,
        headers,
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
        ...(controller
          ? { signal: controller.signal }
          : options?.signal
            ? { signal: options.signal }
            : {}),
      });
      const text = await response.text();
      const parsed = text.length === 0 ? {} : (JSON.parse(text) as unknown);
      if (response.ok) {
        return parsed as T;
      }
      const envelope = isConsumerErrorEnvelope(parsed) ? parsed : null;
      const error = new SunReyConsumerError(
        response.status,
        envelope?.message ?? response.statusText,
        envelope,
      );
      if (response.status === 401) {
        await this.auth?.onUnauthorized?.(error);
      }
      throw error;
    } finally {
      if (timer) {
        clearTimeout(timer);
      }
    }
  }
}

export function createSunReyConsumerClient(options: ConsumerClientOptions): SunReyConsumerClient {
  return new SunReyConsumerClient(options);
}

export type ConsumerPageHelper<T> = {
  readonly items: readonly T[];
  readonly nextCursor: string | null;
  readonly pageSize: number;
  readonly hasMore: boolean;
};

export function asConsumerPage<T>(page: PageDto<T>): ConsumerPageHelper<T> {
  return {
    items: page.items,
    nextCursor: page.next_cursor,
    pageSize: page.page_size,
    hasMore: page.next_cursor !== null,
  };
}

export function isRetryableConsumerError(error: unknown): boolean {
  return error instanceof SunReyConsumerError && error.envelope?.retryable === true;
}

export function consumerErrorCode(error: unknown): string | null {
  if (error instanceof SunReyConsumerError) {
    return error.envelope?.error_code ?? null;
  }
  return null;
}

export function createMemoryTokenStore(): ConsumerAuthProvider & {
  setAccessToken(token: string | undefined): void;
} {
  let token: string | undefined;
  return {
    getAccessToken: () => token,
    setAccessToken(next) {
      token = next;
    },
  };
}
