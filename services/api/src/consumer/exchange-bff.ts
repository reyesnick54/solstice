/**
 * Lovable Consumer BFF for Exchange.
 * Orchestration only. Not a second matching engine, ledger, or Kernel.
 */

import { SUNREY_COIN_USD_MARKET_ID } from '../../../../packages/sunrey-exchange/src/ids.ts';
import {
  ExchangeApplicationApi,
  isExchangeApiError,
  type ExchangeApiActor,
} from '../../../../packages/sunrey-exchange/src/product/api.ts';
import { createExchangeProductSandbox, emptySnapshot } from '../../../../packages/sunrey-exchange/src/product/sandbox.ts';
import { bffError, type BffErrorEnvelope } from './errors.ts';
import type { BffPrincipal } from './ports.ts';

export type ExchangeBffSurface = {
  readonly platform: ReturnType<typeof createExchangeProductSandbox>;
  readonly api: ExchangeApplicationApi;
  markets(principal: BffPrincipal, requestId: string): Record<string, unknown> | BffErrorEnvelope;
  market(principal: BffPrincipal, instrument: string, requestId: string): Record<string, unknown> | BffErrorEnvelope;
  ticker(principal: BffPrincipal, instrument: string, requestId: string): Record<string, unknown> | BffErrorEnvelope;
  orderBook(principal: BffPrincipal, instrument: string, requestId: string): Record<string, unknown> | BffErrorEnvelope;
  trades(principal: BffPrincipal, instrument: string, requestId: string): Record<string, unknown> | BffErrorEnvelope;
  candles(principal: BffPrincipal, instrument: string, requestId: string): Record<string, unknown> | BffErrorEnvelope;
  eligibility(principal: BffPrincipal, requestId: string): Record<string, unknown> | BffErrorEnvelope;
  preview(
    principal: BffPrincipal,
    body: Record<string, unknown>,
    requestId: string,
  ): Record<string, unknown> | BffErrorEnvelope;
  orders(principal: BffPrincipal, requestId: string): Record<string, unknown> | BffErrorEnvelope;
  order(principal: BffPrincipal, orderId: string, requestId: string): Record<string, unknown> | BffErrorEnvelope;
  submitOrder(
    principal: BffPrincipal,
    body: Record<string, unknown>,
    requestId: string,
  ): Record<string, unknown> | BffErrorEnvelope;
  cancelOrder(principal: BffPrincipal, orderId: string, requestId: string): Record<string, unknown> | BffErrorEnvelope;
  fills(principal: BffPrincipal, requestId: string): Record<string, unknown> | BffErrorEnvelope;
  holdings(principal: BffPrincipal, requestId: string): Record<string, unknown> | BffErrorEnvelope;
  stream(principal: BffPrincipal, after: number, requestId: string): Record<string, unknown> | BffErrorEnvelope;
};

export function createExchangeBffSurface(): ExchangeBffSurface {
  const platform = createExchangeProductSandbox();
  platform.putSnapshot(emptySnapshot());
  const api = platform.api;

  function actor(principal: BffPrincipal): ExchangeApiActor {
    return {
      ownerId: principal.customerId,
      accountIds: [`acct_${principal.customerId}`, principal.customerId],
      authorityPresent: false,
    };
  }

  function wrap(value: unknown, requestId: string): Record<string, unknown> | BffErrorEnvelope {
    if (isExchangeApiError(value)) {
      return bffError({
        errorCode: value.code === 'NOT_OWNED' ? 'RESOURCE_NOT_OWNED' : value.code === 'NOT_FOUND' ? 'NOT_FOUND' : 'VALIDATION',
        category: value.code === 'NOT_OWNED' ? 'AUTHORIZATION' : value.code === 'NOT_FOUND' ? 'NOT_FOUND' : 'VALIDATION',
        message: value.message,
        retryable: false,
        requestId,
      });
    }
    return value as Record<string, unknown>;
  }

  return {
    platform,
    api,
    markets: (_principal, _requestId) => ({
      ...(api.markets() as object),
      screens: EXCHANGE_SCREENS,
    }),
    market: (_principal, instrument, requestId) => wrap(api.market(instrument), requestId),
    ticker: (_principal, instrument, requestId) => wrap(api.ticker(instrument), requestId),
    orderBook: (_principal, instrument, requestId) => wrap(api.orderBook(instrument), requestId),
    trades: (_principal, instrument, requestId) => wrap(api.trades(instrument), requestId),
    candles: (_principal, instrument, requestId) => wrap(api.candles(instrument), requestId),
    eligibility: (principal, _requestId) => api.eligibility(actor(principal)) as Record<string, unknown>,
    preview: (principal, body, _requestId) =>
      api.preview(actor(principal), {
        marketId: str(body.marketId) ?? SUNREY_COIN_USD_MARKET_ID,
        instrument: str(body.instrument) ?? 'SUNREY_COIN-USD',
        side: body.side === 'SELL' ? 'SELL' : 'BUY',
        quantity: BigInt(str(body.quantity) ?? '0'),
      }) as Record<string, unknown>,
    orders: (principal, _requestId) => api.orders(actor(principal)) as Record<string, unknown>,
    order: (principal, orderId, requestId) => wrap(api.order(actor(principal), orderId), requestId),
    submitOrder: (principal, body, requestId) =>
      wrap(
        api.submitOrder(
          { ...actor(principal), approvedProposalId: str(body.proposalId) ?? null },
          {
            marketId: str(body.marketId) ?? SUNREY_COIN_USD_MARKET_ID,
            side: body.side === 'SELL' ? 'SELL' : 'BUY',
            quantity: BigInt(str(body.quantity) ?? '0'),
            proposalId: str(body.proposalId) ?? null,
          },
        ),
        requestId,
      ),
    cancelOrder: (principal, orderId, requestId) => wrap(api.cancelOrder(actor(principal), orderId), requestId),
    fills: (principal, _requestId) => api.fills(actor(principal)) as Record<string, unknown>,
    holdings: (principal, _requestId) => api.holdings(actor(principal)) as Record<string, unknown>,
    stream: (_principal, after, _requestId) => api.stream(after) as Record<string, unknown>,
  };
}

const EXCHANGE_SCREENS = Object.freeze([
  'EXCHANGE_HOME',
  'MARKETS',
  'ASSET_DETAIL',
  'CHART',
  'ORDER_BOOK',
  'TRADE_HISTORY',
  'BUY',
  'SELL',
  'ORDER_PREVIEW',
  'OPEN_ORDERS',
  'ORDER_HISTORY',
  'FILLS',
  'HOLDINGS',
  'TRANSACTION_STATUS',
]);

function str(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

