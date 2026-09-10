/**
 * Internal Alpha Exchange consumer contract helpers.
 * Truthful Alpha statuses only. Sandbox USD is never labeled real USD.
 */

import {
  MOONREY_COIN_NATIVE_ASSET_ID,
  SUNREY_COIN_NATIVE_ASSET_ID,
  SUNREY_COIN_USD_MARKET_ID,
  SUNREY_MOONREY_MARKET_ID,
} from '../ids.ts';
import type { ConsumerOrderStatusView } from '../consumer/taxonomy.ts';
import type { NativeSettlementStatus } from '../taxonomy.ts';

export const ALPHA_EXCHANGE_STATUSES = [
  'LIVE_ALPHA',
  'LIVE_REFERENCE_DATA',
  'ALPHA_INTERNAL_LIQUIDITY',
  'PENDING',
  'PARTIALLY_FILLED',
  'FILLED',
  'SETTLING',
  'SETTLED',
  'FINALIZED',
  'FAILED',
  'CANCELLED',
] as const;
export type AlphaExchangeStatus = (typeof ALPHA_EXCHANGE_STATUSES)[number];

export const ALPHA_MARKET_ALIASES = Object.freeze({
  'SRC-USD': SUNREY_COIN_USD_MARKET_ID,
  'MRC-USD': 'market:moonrey-coin-usd-simulation',
  'SRC-MRC': SUNREY_MOONREY_MARKET_ID,
  SRC: SUNREY_COIN_NATIVE_ASSET_ID,
  MRC: MOONREY_COIN_NATIVE_ASSET_ID,
});

export const SANDBOX_USD_LABEL = 'SANDBOX_USD' as const;

export function resolveAlphaMarketId(marketId: string): string {
  const alias = (ALPHA_MARKET_ALIASES as Record<string, string>)[marketId];
  if (alias) {
    return alias;
  }
  return marketId;
}

export function resolveAlphaAssetAlias(assetId: string): 'SUNREY_COIN' | 'MOONREY_COIN' | null {
  if (assetId === 'SRC' || assetId === SUNREY_COIN_NATIVE_ASSET_ID) {
    return 'SUNREY_COIN';
  }
  if (assetId === 'MRC' || assetId === MOONREY_COIN_NATIVE_ASSET_ID) {
    return 'MOONREY_COIN';
  }
  return null;
}

export function mapOrderViewToAlphaStatus(view: ConsumerOrderStatusView | string): AlphaExchangeStatus {
  switch (view) {
    case 'PARTIALLY_FILLED':
      return 'PARTIALLY_FILLED';
    case 'FILLED':
      return 'FILLED';
    case 'CANCELLED':
      return 'CANCELLED';
    case 'REJECTED':
    case 'EXPIRED':
      return 'FAILED';
    case 'OPEN':
    case 'SUBMITTED':
      return 'PENDING';
    default:
      return 'PENDING';
  }
}

export function mapSettlementToAlphaStatus(status: NativeSettlementStatus | string): AlphaExchangeStatus {
  switch (status) {
    case 'FINALIZED':
      return 'FINALIZED';
    case 'SETTLED':
      return 'SETTLED';
    case 'PENDING':
    case 'SUBMITTED':
      return 'SETTLING';
    case 'FAILED':
      return 'FAILED';
    default:
      return 'SETTLING';
  }
}

export function alphaExchangeEnvironment(): 'simulation' {
  return 'simulation';
}

export function alphaLiquiditySource(): 'ALPHA_INTERNAL_LIQUIDITY' {
  return 'ALPHA_INTERNAL_LIQUIDITY';
}

export function alphaPriceSource(referenceConnected: boolean): 'LIVE_REFERENCE_DATA' | 'ALPHA_INTERNAL_LIQUIDITY' {
  return referenceConnected ? 'LIVE_REFERENCE_DATA' : 'ALPHA_INTERNAL_LIQUIDITY';
}

export function alphaMarketDataStatus(referenceConnected: boolean): AlphaExchangeStatus {
  return referenceConnected ? 'LIVE_REFERENCE_DATA' : 'ALPHA_INTERNAL_LIQUIDITY';
}

export function alphaExchangeHomeStatus(): AlphaExchangeStatus {
  return 'LIVE_ALPHA';
}

export function quantityFromSpendMinor(spendMinorUnits: bigint, priceMinorPerUnit: bigint): bigint {
  if (priceMinorPerUnit <= 0n) {
    return 0n;
  }
  return spendMinorUnits / priceMinorPerUnit;
}

export function alphaQuoteEnvelope(input: {
  readonly quoteId: string;
  readonly marketId: string;
  readonly side: 'BUY' | 'SELL';
  readonly price: string;
  readonly estimatedQuantity: string;
  readonly fee: string;
  readonly total: string;
  readonly expiresAt: string;
  readonly priceSource: AlphaExchangeStatus;
  readonly liquiditySource: AlphaExchangeStatus;
  readonly slippage: string | null;
  readonly environment: string;
}): Record<string, unknown> {
  return Object.freeze({
    schema: 'sunrey.consumer.exchange.quote.v1',
    quoteId: input.quoteId,
    marketId: input.marketId,
    side: input.side,
    price: input.price,
    estimatedQuantity: input.estimatedQuantity,
    fee: input.fee,
    total: input.total,
    expiresAt: input.expiresAt,
    priceSource: input.priceSource,
    liquiditySource: input.liquiditySource,
    slippage: input.slippage,
    environment: input.environment,
    productionMoneyMovement: false,
    quoteCurrencyLabel: SANDBOX_USD_LABEL,
    guaranteedExecutionPrice: false,
  });
}

export function alphaOrderEnvelope(input: {
  readonly orderId: string;
  readonly status: AlphaExchangeStatus;
  readonly filledQuantity: string;
  readonly averagePrice: string | null;
  readonly tradeIds: readonly string[];
  readonly settlementIds: readonly string[];
  readonly chainTransactionIds: readonly string[];
  readonly createdAt: string;
  readonly updatedAt: string;
}): Record<string, unknown> {
  return Object.freeze({
    schema: 'sunrey.consumer.exchange.order.v1',
    orderId: input.orderId,
    status: input.status,
    filledQuantity: input.filledQuantity,
    averagePrice: input.averagePrice,
    tradeIds: Object.freeze([...input.tradeIds]),
    settlementIds: Object.freeze([...input.settlementIds]),
    chainTransactionIds: Object.freeze([...input.chainTransactionIds]),
    createdAt: input.createdAt,
    updatedAt: input.updatedAt,
    serverDerived: true,
  });
}

export function alphaMarketCatalog(_now: string): readonly Record<string, unknown>[] {
  void _now;
  return Object.freeze([
    Object.freeze({
      marketId: 'SRC-USD',
      canonicalMarketId: SUNREY_COIN_USD_MARKET_ID,
      symbol: 'SRC/USD',
      baseAsset: 'SRC',
      quoteAsset: SANDBOX_USD_LABEL,
      state: 'LIVE_ALPHA',
      informationalOnly: false,
      quoteCurrencyIsRealUsd: false,
    }),
    Object.freeze({
      marketId: 'MRC-USD',
      canonicalMarketId: 'market:moonrey-coin-usd-simulation',
      symbol: 'MRC/USD',
      baseAsset: 'MRC',
      quoteAsset: SANDBOX_USD_LABEL,
      state: 'LIVE_ALPHA',
      informationalOnly: false,
      quoteCurrencyIsRealUsd: false,
    }),
    Object.freeze({
      marketId: 'SRC-MRC',
      canonicalMarketId: SUNREY_MOONREY_MARKET_ID,
      symbol: 'SRC/MRC',
      baseAsset: 'SRC',
      quoteAsset: 'MRC',
      state: 'LIVE_ALPHA',
      informationalOnly: false,
      quoteCurrencyIsRealUsd: false,
    }),
  ]);
}

export function isAlphaMarketId(marketId: string): boolean {
  return (
    marketId === 'SRC-USD' ||
    marketId === 'MRC-USD' ||
    marketId === 'SRC-MRC' ||
    marketId === SUNREY_COIN_USD_MARKET_ID ||
    marketId === SUNREY_MOONREY_MARKET_ID ||
    marketId === 'market:moonrey-coin-usd-simulation'
  );
}
