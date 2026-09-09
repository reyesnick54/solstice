/**
 * Wave 8 — consumer BFF dispatch for money integration surfaces.
 */

import type { DurableMoneyAccountMutations } from '../durable-money-account-mutations.ts';
import type { BffPrincipal } from '../ports.ts';
import type { MoneyIntegrationPlatform } from './platform.ts';

type MoneyDispatchRequest = {
  readonly method: string;
  readonly path: string;
  readonly body: unknown;
  readonly idempotencyKey?: string;
};

type MoneyDispatchResponse = {
  readonly status: number;
  readonly body: unknown;
  readonly headers: Readonly<Record<string, string>>;
};

type HostedMoneyIntegrationPlatform = MoneyIntegrationPlatform & {
  readonly durableMoneyAccountMutations?: DurableMoneyAccountMutations;
};

function json(status: number, body: unknown, headers: Record<string, string>): MoneyDispatchResponse {
  return { status, body, headers };
}

export function dispatchMoneyIntegration(
  platform: MoneyIntegrationPlatform,
  request: MoneyDispatchRequest,
  principal: BffPrincipal,
  headers: Record<string, string>,
): MoneyDispatchResponse | Promise<MoneyDispatchResponse> | null {
  const { method, path } = request;
  const hosted = platform as HostedMoneyIntegrationPlatform;

  if (path === '/api/v1/accounts' && method === 'POST' && hosted.durableMoneyAccountMutations) {
    return handleAccountOpening(hosted.durableMoneyAccountMutations, request, principal, headers);
  }

  if (path === '/api/v1/sandbox/funding' && method === 'POST' && hosted.durableMoneyAccountMutations) {
    return handleSandboxFunding(hosted.durableMoneyAccountMutations, request, principal, headers);
  }

  if (path === '/api/v1/money/holdings' && method === 'GET') {
    return json(
      200,
      {
        schema: 'sunrey.money-integration.holdings.v1',
        items: platform.describeHoldings(principal.customerId),
        productionMoneyMovement: false,
        regulatedCustodyConnected: false,
      },
      headers,
    );
  }

  if (path === '/api/v1/money/history' && method === 'GET') {
    return json(
      200,
      {
        schema: 'sunrey.money-integration.history.v1',
        items: platform.unifiedHistory(principal.customerId),
        productionMoneyMovement: false,
      },
      headers,
    );
  }

  if (path === '/api/v1/money/settlements' && method === 'GET') {
    return json(
      200,
      {
        schema: 'sunrey.money-integration.settlements.v1',
        items: platform.settlementRecords(principal.customerId),
        sandboxSimulation: true,
      },
      headers,
    );
  }

  if (path === '/api/v1/money/reconcile' && method === 'POST') {
    const rec = bodyRecord(request.body);
    const assetId = typeof rec.assetId === 'string' ? rec.assetId : 'SUNREY_COIN';
    return json(200, platform.reconcile(principal.customerId, assetId), headers);
  }

  if (path === '/api/v1/money/market-price-boundary' && method === 'GET') {
    return json(200, platform.marketPriceBoundary, headers);
  }

  return null;
}

async function handleAccountOpening(
  mutations: DurableMoneyAccountMutations,
  request: MoneyDispatchRequest,
  principal: BffPrincipal,
  headers: Record<string, string>,
): Promise<MoneyDispatchResponse> {
  const rec = bodyRecord(request.body);
  const outcome = await mutations.openCashAccount(principal, {
    ...(typeof rec.accountType === 'string' ? { accountType: rec.accountType } : {}),
    currency: typeof rec.currency === 'string' ? rec.currency : '',
    idempotencyKey:
      request.idempotencyKey ??
      (typeof rec.idempotencyKey === 'string' ? rec.idempotencyKey : ''),
  });
  if (outcome.outcome === 'OK') {
    return json(outcome.replay ? 200 : 201, outcome.value, {
      ...headers,
      'cache-control': 'no-store, no-cache, private',
      'x-sunrey-authority': 'POSTGRES_ACCOUNT_PRODUCT',
      'x-sunrey-idempotent-replay': outcome.replay ? 'true' : 'false',
    });
  }
  return mutationFailure(outcome.code, outcome.message, headers);
}

async function handleSandboxFunding(
  mutations: DurableMoneyAccountMutations,
  request: MoneyDispatchRequest,
  principal: BffPrincipal,
  headers: Record<string, string>,
): Promise<MoneyDispatchResponse> {
  const rec = bodyRecord(request.body);
  const outcome = await mutations.fundSandboxAccount(principal, {
    accountId: typeof rec.accountId === 'string' ? rec.accountId : '',
    amountMinorUnits:
      typeof rec.amountMinorUnits === 'string'
        ? rec.amountMinorUnits
        : String(rec.amountMinorUnits ?? ''),
    currency: typeof rec.currency === 'string' ? rec.currency : '',
    idempotencyKey:
      request.idempotencyKey ??
      (typeof rec.idempotencyKey === 'string' ? rec.idempotencyKey : ''),
  });
  if (outcome.outcome === 'OK') {
    return json(outcome.replay ? 200 : 201, outcome.value, {
      ...headers,
      'cache-control': 'no-store, no-cache, private',
      'x-sunrey-authority': 'POSTGRES_LEDGER',
      'x-sunrey-idempotent-replay': outcome.replay ? 'true' : 'false',
    });
  }
  return mutationFailure(outcome.code, outcome.message, headers);
}

function mutationFailure(
  code: string,
  message: string,
  headers: Record<string, string>,
): MoneyDispatchResponse {
  const status =
    code === 'RESOURCE_NOT_OWNED'
      ? 403
      : code === 'ACCOUNT_NOT_FOUND'
        ? 404
        : code === 'KERNEL_REFUSED'
          ? 403
          : 422;
  return json(
    status,
    Object.freeze({
      errorCode: code,
      category: status === 404 ? 'NOT_FOUND' : status === 403 ? 'AUTHORIZATION' : 'VALIDATION',
      message,
      retryable: false,
      detailsSafeForClient: Object.freeze({ code }),
      apiVersion: 'v1',
    }),
    headers,
  );
}

function bodyRecord(body: unknown): Record<string, unknown> {
  return body && typeof body === 'object' && !Array.isArray(body)
    ? (body as Record<string, unknown>)
    : {};
}

export const MONEY_INTEGRATION_ROUTES = [
  'POST /api/v1/accounts',
  'POST /api/v1/sandbox/funding',
  'GET /api/v1/money/holdings',
  'GET /api/v1/money/history',
  'GET /api/v1/money/settlements',
  'POST /api/v1/money/reconcile',
  'GET /api/v1/money/market-price-boundary',
] as const;
