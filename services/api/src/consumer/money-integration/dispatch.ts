/**
 * Wave 8 — consumer BFF dispatch for money integration surfaces.
 */

import type { MoneyIntegrationPlatform } from './platform.ts';
import type { BffPrincipal } from '../ports.ts';

type MoneyDispatchRequest = {
  readonly method: string;
  readonly path: string;
  readonly body: unknown;
};

type MoneyDispatchResponse = {
  readonly status: number;
  readonly body: unknown;
  readonly headers: Readonly<Record<string, string>>;
};

function json(status: number, body: unknown, headers: Record<string, string>): MoneyDispatchResponse {
  return { status, body, headers };
}

export function dispatchMoneyIntegration(
  platform: MoneyIntegrationPlatform,
  request: MoneyDispatchRequest,
  principal: BffPrincipal,
  headers: Record<string, string>,
): MoneyDispatchResponse | null {
  const { method, path } = request;

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
    const rec =
      request.body && typeof request.body === 'object' && !Array.isArray(request.body)
        ? (request.body as Record<string, unknown>)
        : {};
    const assetId = typeof rec.assetId === 'string' ? rec.assetId : 'SUNREY_COIN';
    return json(200, platform.reconcile(principal.customerId, assetId), headers);
  }

  if (path === '/api/v1/money/market-price-boundary' && method === 'GET') {
    return json(200, platform.marketPriceBoundary, headers);
  }

  return null;
}

export const MONEY_INTEGRATION_ROUTES = [
  'GET /api/v1/money/holdings',
  'GET /api/v1/money/history',
  'GET /api/v1/money/settlements',
  'POST /api/v1/money/reconcile',
  'GET /api/v1/money/market-price-boundary',
] as const;
