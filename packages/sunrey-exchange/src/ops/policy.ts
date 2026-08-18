import {
  MOONREY_COIN_NATIVE_ASSET_ID,
  SUNREY_COIN_NATIVE_ASSET_ID,
  SUNREY_MOONREY_MARKET_ID,
} from '../ids.ts';
import type { MarketOperationsPolicy } from './types.ts';
import { OPERATIONAL_ORDER_TYPES } from './taxonomy.ts';

export const DIGITAL_ASSET_NATIVE_MARKET_ID = SUNREY_MOONREY_MARKET_ID;
export const NATIVE_BASE_ASSET = SUNREY_COIN_NATIVE_ASSET_ID;
export const NATIVE_QUOTE_ASSET = MOONREY_COIN_NATIVE_ASSET_ID;

export function defaultMarketOperationsPolicy(
  overrides: Partial<MarketOperationsPolicy> = {},
): MarketOperationsPolicy {
  return Object.freeze({
    policyId: 'sunrey.exchange.market-operations.v1',
    policyVersion: 1,
    focusFamily: 'DIGITAL_ASSET',
    nativeMarket: Object.freeze({
      baseAsset: 'SUNREY_COIN',
      quoteAsset: 'MOONREY_COIN',
      fixedPeg: false,
      guaranteedPriceRelationship: false,
    }),
    sessionModeByMarket: Object.freeze({
      [SUNREY_MOONREY_MARKET_ID]: 'CONTINUOUS' as const,
    }),
    orderTypes: OPERATIONAL_ORDER_TYPES,
    selfTradePolicy: 'PREVENT',
    priceCollarBps: 500n,
    protectionCollarBps: 300n,
    volatilityTriggerBps: 800n,
    circuitBreakerTarget: 'PAUSED',
    reopenWithAuction: true,
    settlementQueueLimit: 8n,
    cancelOnDisconnectDefault: false,
    marketMakerHiddenPriority: false,
    aiMayAuthorizeMarketRestriction: false,
    productionActivated: false,
    ...overrides,
  });
}

export function sessionModeForMarket(
  policy: MarketOperationsPolicy,
  marketId: string,
): 'CONTINUOUS' | 'SCHEDULED' {
  return policy.sessionModeByMarket[marketId] ?? 'SCHEDULED';
}
