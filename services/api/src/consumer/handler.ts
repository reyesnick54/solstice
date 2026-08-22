import { randomUUID } from 'node:crypto';

import {
  ACCOUNT_RESTRICTION_CODES,
  APPROVAL_REQUIREMENTS,
  CLIENT_RESOURCE_STATES,
  CONSUMER_ACCOUNT_TYPES,
  CONSUMER_ACTION_STATUSES,
  CONSUMER_ASSET_TYPES,
  CARD_STATUSES,
  CARD_WALLET_STATUSES,
  CONSUMER_TRANSACTION_STATUSES,
  FINANCIAL_ACCOUNT_LIFECYCLES,
  FINANCIAL_PRODUCT_TYPES,
  PRODUCT_AVAILABILITIES,
  PROVIDER_AVAILABILITIES,
  RISK_DISPLAY_LEVELS,
  VERIFICATION_DISPLAY_STATES,
} from './types.ts';
import { PAYMENT_LIFECYCLE_STATUSES } from '../../../../packages/payments/src/platform/lifecycle.ts';
import { bffError, isBffError, statusForError, type BffErrorEnvelope } from './errors.ts';
import { pageSizeOf } from './pagination.ts';
import { cachePolicyForPath } from './cache.ts';
import { CONSUMER_RESOURCE_CATALOG } from './resources.ts';
import type { ConsumerBff } from './orchestrator.ts';
import { resolvePrincipal, type SessionDirectory } from './session.ts';
import { listSandboxPersonas } from './fixtures.ts';
import type { IdentityService } from '../../../../packages/identity/src/service.ts';
import type { PaymentPlatform } from '../../../../packages/payments/src/platform/orchestrator.ts';
import { listPayments, listRecipients, mapPaymentOutcome } from './payments.ts';

export type BffRequest = {
  readonly method: string;
  readonly path: string;
  readonly query: Readonly<Record<string, string>>;
  readonly body: unknown;
  readonly authorization: string | undefined;
  readonly requestId?: string;
  readonly idempotencyKey?: string;
};

export type BffResponse = {
  readonly status: number;
  readonly body: unknown;
  readonly headers: Readonly<Record<string, string>>;
};

export type ConsumerBffRuntime = {
  readonly bff: ConsumerBff;
  readonly sessions: SessionDirectory;
  readonly identity?: IdentityService;
  readonly ingestCardWebhook?: (body: unknown, requestId: string) => unknown;
  readonly payments?: PaymentPlatform;
};

const STUB_GROUPS = [
  'payments',
  'recipients',
  'fx',
  'cards',
  'grow',
  'goals',
  'portfolio',
  'agent',
  'exchange',
  'wallets',
  'data',
  'security',
  'notifications',
] as const;

export function handleConsumerBff(runtime: ConsumerBffRuntime, request: BffRequest): BffResponse {
  const requestId = request.requestId ?? `req_${randomUUID()}`;
  const headers = {
    'cache-control': cachePolicyForPath(request.path).cacheControl,
    vary: 'Authorization',
    'x-sunrey-api-version': 'v1',
    'x-sunrey-surface': 'CONSUMER_BFF',
    'x-sunrey-environment': 'simulation',
  };

  if (request.path === '/api/v1/webhooks/cards' && request.method === 'POST') {
    if (!runtime.ingestCardWebhook) {
      return json(
        503,
        bffError({
          errorCode: 'FEATURE_UNAVAILABLE',
          category: 'TEMPORARY_UNAVAILABLE',
          message: 'card webhook ingestion is not connected',
          retryable: true,
          requestId,
        }),
        headers,
      );
    }
    return json(200, runtime.ingestCardWebhook(request.body, requestId), headers);
  }
  if (request.path === '/api/v1/sandbox/personas' && request.method === 'GET') {
    return json(200, { label: 'SANDBOX_FIXTURE_NON_PRODUCTION', production: false, items: listSandboxPersonas() }, headers);
  }

  if (request.path === '/api/v1/catalog/resources' && request.method === 'GET') {
    return json(200, { items: CONSUMER_RESOURCE_CATALOG }, headers);
  }
  if (request.path === '/api/v1/catalog/enums' && request.method === 'GET') {
    return json(
      200,
      {
        cardStatus: CARD_STATUSES,
        cardWalletStatus: CARD_WALLET_STATUSES,
        transactionStatus: CONSUMER_TRANSACTION_STATUSES,
        actionStatus: CONSUMER_ACTION_STATUSES,
        accountLifecycle: FINANCIAL_ACCOUNT_LIFECYCLES,
        accountProductType: FINANCIAL_PRODUCT_TYPES,
        accountRestriction: ACCOUNT_RESTRICTION_CODES,
        accountType: CONSUMER_ACCOUNT_TYPES,
        assetType: CONSUMER_ASSET_TYPES,
        riskDisplay: RISK_DISPLAY_LEVELS,
        approvalRequirement: APPROVAL_REQUIREMENTS,
        verificationState: VERIFICATION_DISPLAY_STATES,
        providerAvailability: PROVIDER_AVAILABILITIES,
        productAvailability: PRODUCT_AVAILABILITIES,
        clientResourceState: CLIENT_RESOURCE_STATES,
        paymentStatus: PAYMENT_LIFECYCLE_STATUSES,
      },
      headers,
    );
  }

  const principal = resolvePrincipal({
    authorization: request.authorization,
    requestId,
    directory: runtime.sessions,
    ...(runtime.identity ? { identity: runtime.identity } : {}),
  });
  if (isBffError(principal)) {
    return json(statusForError(principal), principal, headers);
  }

  try {
    return dispatchAuthenticated(runtime, request, principal, requestId, headers);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'request failed';
    return json(
      500,
      bffError({
        errorCode: 'MALFORMED',
        category: 'INTERNAL',
        message,
        retryable: true,
        requestId,
      }),
      headers,
    );
  }
}

function dispatchAuthenticated(
  runtime: ConsumerBffRuntime,
  request: BffRequest,
  principal: import('./ports.ts').BffPrincipal,
  requestId: string,
  headers: Record<string, string>,
): BffResponse {
  const { method, path, query, body } = request;
  const rec = body && typeof body === 'object' && !Array.isArray(body) ? (body as Record<string, unknown>) : {};

  if (path === '/api/v1/me' && method === 'GET') {
    return json(200, runtime.bff.profile(principal), headers);
  }
  if (path === '/api/v1/me' && method === 'PATCH') {
    return result(runtime.bff.patchProfile(principal, rec, requestId), headers);
  }
  if (path === '/api/v1/me/home' && method === 'GET') {
    return result(runtime.bff.home(principal, requestId, query.valuationCurrency ?? query.valuation_currency ?? 'USD'), headers);
  }
  if (path === '/api/v1/me/bootstrap' && method === 'GET') {
    return json(200, runtime.bff.bootstrap(principal), headers);
  }
  if (path === '/api/v1/me/capabilities' && method === 'GET') {
    return json(200, runtime.bff.capabilities(principal), headers);
  }
  if (path === '/api/v1/accounts' && method === 'GET') {
    return json(200, runtime.bff.listAccounts(principal), headers);
  }
  if (path.startsWith('/api/v1/accounts/') && path.endsWith('/activity') && method === 'GET') {
    const id = path.slice('/api/v1/accounts/'.length, -'/activity'.length);
    return result(runtime.bff.accountActivity(principal, id, requestId, query.cursor, pageSizeOf(query.pageSize ?? query.page_size), query), headers);
  }
  if (path.startsWith('/api/v1/accounts/') && path.endsWith('/statement') && method === 'GET') {
    const id = path.slice('/api/v1/accounts/'.length, -'/statement'.length);
    return result(runtime.bff.accountStatement(principal, id, requestId, query.periodStart ?? query.from, query.periodEnd ?? query.to), headers);
  }
  if (path.startsWith('/api/v1/accounts/') && method === 'GET') {
    const id = path.slice('/api/v1/accounts/'.length);
    return result(runtime.bff.getAccount(principal, id, requestId), headers);
  }
  if (path === '/api/v1/cards' && method === 'POST') {
    return result(runtime.bff.issueCard(principal, rec, requestId), headers, 201);
  }
  if (path.startsWith('/api/v1/cards/') && path.endsWith('/freeze') && method === 'POST') {
    const id = path.slice('/api/v1/cards/'.length, -'/freeze'.length);
    return result(runtime.bff.freezeCard(principal, id, requestId), headers);
  }
  if (path.startsWith('/api/v1/cards/') && path.endsWith('/unfreeze') && method === 'POST') {
    const id = path.slice('/api/v1/cards/'.length, -'/unfreeze'.length);
    return result(runtime.bff.unfreezeCard(principal, id, requestId), headers);
  }
  if (path.startsWith('/api/v1/cards/') && path.endsWith('/controls') && method === 'PATCH') {
    const id = path.slice('/api/v1/cards/'.length, -'/controls'.length);
    return result(runtime.bff.patchCardControls(principal, id, rec, requestId), headers);
  }
  if (path.startsWith('/api/v1/cards/') && path.endsWith('/wallet') && method === 'GET') {
    const id = path.slice('/api/v1/cards/'.length, -'/wallet'.length);
    return result(runtime.bff.cardWallet(principal, id, requestId), headers);
  }
  if (path.startsWith('/api/v1/cards/') && method === 'GET') {
    const id = path.slice('/api/v1/cards/'.length);
    return result(runtime.bff.getCard(principal, id, requestId), headers);
  }
  if (path === '/api/v1/fx/currencies' && method === 'GET') {
    return json(200, runtime.bff.listFxCurrencies(), headers);
  }
  if (path === '/api/v1/fx/valuation' && method === 'GET') {
    return json(200, runtime.bff.valuation(principal, query.targetCurrency ?? query.target ?? 'USD'), headers);
  }
  if (path === '/api/v1/fx/quotes' && method === 'POST') {
    return result(runtime.bff.createFxQuote(principal, rec, requestId), headers, 201);
  }
  if (path.startsWith('/api/v1/fx/quotes/') && path.endsWith('/accept') && method === 'POST') {
    const id = path.slice('/api/v1/fx/quotes/'.length, -'/accept'.length);
    return result(runtime.bff.acceptFxQuote(principal, id, rec, requestId), headers);
  }
  if (path.startsWith('/api/v1/fx/quotes/') && path.endsWith('/execute') && method === 'POST') {
    const id = path.slice('/api/v1/fx/quotes/'.length, -'/execute'.length);
    return result(runtime.bff.executeFxQuote(principal, id, rec, requestId), headers);
  }
  if (path.startsWith('/api/v1/fx/quotes/') && method === 'GET') {
    const id = path.slice('/api/v1/fx/quotes/'.length);
    return result(runtime.bff.getFxQuote(principal, id, requestId), headers);
  }
  if (runtime.payments) {
    const payments = dispatchPayments(runtime.payments, request, principal, requestId, headers);
    if (payments) {
      return payments;
    }
  } else if (
    (path === '/api/v1/payments' || path === '/api/v1/recipients') &&
    method !== 'GET'
  ) {
    return json(
      405,
      bffError({
        errorCode: 'METHOD_NOT_ALLOWED',
        category: 'VALIDATION',
        message: 'payment platform is not attached to this runtime',
        retryable: false,
        requestId,
      }),
      headers,
    );
  }

  if (path === '/api/v1/me/actions' && method === 'GET') {
    const home = runtime.bff.home(principal, requestId);
    if (isBffError(home)) {
      return json(statusForError(home), home, headers);
    }
    return json(200, home.pendingApprovals, headers);
  }

  for (const group of STUB_GROUPS) {
    if (path === `/api/v1/${group}` && method === 'GET') {
      return json(200, runtime.bff.featureStub(group, principal), headers);
    }
  }

  if (method !== 'GET' && method !== 'PATCH') {
    return json(
      405,
      bffError({
        errorCode: 'METHOD_NOT_ALLOWED',
        category: 'VALIDATION',
        message: 'method is not allowed on this consumer resource',
        retryable: false,
        requestId,
      }),
      headers,
    );
  }

  return json(
    404,
    bffError({
      errorCode: 'NOT_FOUND',
      category: 'NOT_FOUND',
      message: 'consumer resource not found',
      retryable: false,
      requestId,
    }),
    headers,
  );
}

function result(body: unknown, headers: Record<string, string>, okStatus = 200): BffResponse {
  if (isBffError(body)) {
    return json(statusForError(body as BffErrorEnvelope), body, headers);
  }
  return json(okStatus, body, headers);
}

function dispatchPayments(
  platform: PaymentPlatform,
  request: BffRequest,
  principal: import('./ports.ts').BffPrincipal,
  requestId: string,
  headers: Record<string, string>,
): BffResponse | null {
  const { method, path, body } = request;
  const rec = body && typeof body === 'object' && !Array.isArray(body) ? (body as Record<string, unknown>) : {};
  const idempotencyKey =
    request.idempotencyKey ??
    (typeof rec.idempotencyKey === 'string' ? rec.idempotencyKey : `idem_${requestId}`);

  if (path === '/api/v1/recipients' && method === 'GET') {
    return json(200, listRecipients(platform, principal), headers);
  }
  if (path === '/api/v1/recipients' && method === 'POST') {
    const created = platform.createRecipient({
      actorId: principal.actorId,
      ownerId: principal.customerId,
      accountId: str(rec.accountId) ?? str(rec.sourceAccountId) ?? '',
      kind: rec.kind === 'BUSINESS' ? 'BUSINESS' : 'PERSON',
      destinationCountry: str(rec.country) ?? str(rec.destinationCountry) ?? principal.jurisdiction,
      currency: str(rec.currency) ?? 'USD',
      legalName: str(rec.displayName) ?? str(rec.legalName) ?? '',
      accountCoordinate: {
        scheme: str(rec.scheme) ?? (rec.destinationType === 'SUNREY_USER' ? 'SUNREY_ACCOUNT' : 'IBAN'),
        value: str(rec.destinationAccountId) ?? str(rec.accountNumber) ?? str(rec.value) ?? '',
      },
      ...(typeof rec.relationship === 'string' ? { relationship: rec.relationship } : {}),
      ...(typeof rec.purpose === 'string' ? { purpose: rec.purpose } : {}),
      clientBody: rec,
      idempotencyKey,
      ...(typeof rec.id === 'string' ? { beneficiaryId: rec.id } : {}),
    });
    const mapped = mapPaymentOutcome(created, requestId);
    return result(mapped, headers);
  }
  if (path.startsWith('/api/v1/recipients/') && method === 'GET') {
    const id = path.slice('/api/v1/recipients/'.length);
    return result(mapPaymentOutcome(platform.getRecipient(principal.customerId, id), requestId), headers);
  }
  if (path === '/api/v1/payments/quote' && method === 'POST') {
    const quoted = platform.quote({
      actorId: principal.actorId,
      ownerId: principal.customerId,
      sourceAccountId: str(rec.sourceAccountId) ?? str(rec.accountId) ?? '',
      ...(typeof rec.beneficiaryId === 'string' ? { beneficiaryId: rec.beneficiaryId } : {}),
      ...(typeof rec.destinationAccountId === 'string' ? { destinationAccountId: rec.destinationAccountId } : {}),
      amountMinorUnits: str(rec.amountMinorUnits) ?? '0',
      currency: str(rec.currency) ?? 'USD',
      ...(typeof rec.railPreference === 'string' ? { railPreference: rec.railPreference as never } : {}),
      ...(typeof rec.purpose === 'string' ? { purpose: rec.purpose } : {}),
    });
    return result(mapPaymentOutcome(quoted, requestId), headers);
  }
  if (path === '/api/v1/payments' && method === 'GET') {
    return json(200, listPayments(platform, principal), headers);
  }
  if (path === '/api/v1/payments' && method === 'POST') {
    const created = platform.createPayment({
      actorId: principal.actorId,
      ownerId: principal.customerId,
      sourceAccountId: str(rec.sourceAccountId) ?? str(rec.accountId) ?? '',
      ...(typeof rec.beneficiaryId === 'string' ? { beneficiaryId: rec.beneficiaryId } : {}),
      ...(typeof rec.destinationAccountId === 'string' ? { destinationAccountId: rec.destinationAccountId } : {}),
      amountMinorUnits: str(rec.amountMinorUnits) ?? '0',
      currency: str(rec.currency) ?? 'USD',
      ...(typeof rec.quoteId === 'string' ? { quoteId: rec.quoteId } : {}),
      ...(typeof rec.purpose === 'string' ? { purpose: rec.purpose } : {}),
      ...(typeof rec.reference === 'string' ? { reference: rec.reference } : {}),
      idempotencyKey,
      ...(typeof rec.paymentId === 'string' ? { paymentId: rec.paymentId } : {}),
      ...(rec.approveNow === true ? { approveNow: true } : {}),
      ...(rec.stepUpSatisfied === true ? { stepUpSatisfied: true } : {}),
    });
    return result(mapPaymentOutcome(created, requestId), headers);
  }
  if (path.startsWith('/api/v1/payments/') && path.endsWith('/approve') && method === 'POST') {
    const id = path.slice('/api/v1/payments/'.length, -'/approve'.length);
    return result(
      mapPaymentOutcome(
        platform.approvePayment({
          actorId: principal.actorId,
          ownerId: principal.customerId,
          paymentId: id,
          ...(typeof rec.approvalId === 'string' ? { approvalId: rec.approvalId } : {}),
        }),
        requestId,
      ),
      headers,
    );
  }
  if (path.startsWith('/api/v1/payments/') && method === 'GET') {
    const id = path.slice('/api/v1/payments/'.length);
    return result(mapPaymentOutcome(platform.getPayment(principal.customerId, id), requestId), headers);
  }
  return null;
}

function str(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function result(body: unknown, headers: Record<string, string>, okStatus = 200): BffResponse {
  if (isBffError(body)) {
    return json(statusForError(body as BffErrorEnvelope), body, headers);
  }
  return json(okStatus, body, headers);
}

function json(status: number, body: unknown, headers: Record<string, string>): BffResponse {
  return Object.freeze({
    status,
    body,
    headers: Object.freeze({
      ...headers,
      'content-type': 'application/json',
    }),
  });
}

export const CONSUMER_BFF_ROUTES = [
  'GET /api/v1/me',
  'PATCH /api/v1/me',
  'GET /api/v1/me/home',
  'GET /api/v1/me/bootstrap',
  'GET /api/v1/me/capabilities',
  'GET /api/v1/me/actions',
  'GET /api/v1/accounts',
  'GET /api/v1/accounts/{id}',
  'GET /api/v1/accounts/{id}/activity',
  'GET /api/v1/accounts/{id}/statement',
  'GET /api/v1/payments',
  'POST /api/v1/payments',
  'POST /api/v1/payments/quote',
  'GET /api/v1/payments/{id}',
  'POST /api/v1/payments/{id}/approve',
  'GET /api/v1/recipients',
  'POST /api/v1/recipients',
  'GET /api/v1/recipients/{id}',
  'GET /api/v1/fx',
  'GET /api/v1/fx/currencies',
  'GET /api/v1/fx/valuation',
  'POST /api/v1/fx/quotes',
  'GET /api/v1/fx/quotes/{id}',
  'POST /api/v1/fx/quotes/{id}/accept',
  'POST /api/v1/fx/quotes/{id}/execute',
  'GET /api/v1/cards',
  'POST /api/v1/cards',
  'GET /api/v1/cards/{id}',
  'POST /api/v1/cards/{id}/freeze',
  'POST /api/v1/cards/{id}/unfreeze',
  'PATCH /api/v1/cards/{id}/controls',
  'GET /api/v1/cards/{id}/wallet',
  'GET /api/v1/grow',
  'GET /api/v1/goals',
  'GET /api/v1/portfolio',
  'GET /api/v1/agent',
  'GET /api/v1/exchange',
  'GET /api/v1/wallets',
  'GET /api/v1/data',
  'GET /api/v1/security',
  'GET /api/v1/notifications',
  'GET /api/v1/catalog/resources',
  'GET /api/v1/catalog/enums',
  'GET /api/v1/sandbox/personas',
  'POST /api/v1/webhooks/cards',
] as const;
