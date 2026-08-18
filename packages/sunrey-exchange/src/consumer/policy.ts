import { SUNREY_MOONREY_MARKET_ID } from '../ids.ts';
import { CONSUMER_ORDER_TYPES, type ConsumerOrderType } from './taxonomy.ts';

/** Matches Chunk 93/94 `PUBLIC_REQUEST_LIMITS.rateLimitPerMinute`. */
export const PUBLIC_API_RATE_LIMIT_PER_MINUTE = 60;

export type ConsumerExchangePolicy = {
  readonly policyId: string;
  readonly policyVersion: number;
  readonly nativeMarket: {
    readonly marketId: typeof SUNREY_MOONREY_MARKET_ID;
    readonly baseAsset: 'SUNREY_COIN';
    readonly quoteAsset: 'MOONREY_COIN';
    readonly fixedExchangeRate: false;
    readonly guaranteedPriceRelationship: false;
  };
  readonly orderTypes: readonly ConsumerOrderType[];
  readonly defaultProtectionBps: bigint;
  readonly maxProtectionBps: bigint;
  readonly highSpreadBps: bigint;
  readonly lowDepthThreshold: bigint;
  readonly minTradesForStatistics: bigint;
  readonly quoteTtlMs: number;
  readonly staleQuotePolicy: 'REJECT' | 'REPRICE';
  readonly permittedJurisdictions: readonly string[];
  readonly simulationFeeScheduleId: string;
  readonly simulationExchangeFee: bigint;
  readonly simulationNetworkFee: bigint;
  readonly productionActivated: false;
  readonly firmExecutableQuotesImplemented: false;
  readonly developerQuotaAuthorizesTrading: false;
  readonly publicApiRateLimitPerMinute: number;
};

export function defaultConsumerExchangePolicy(
  overrides: Partial<ConsumerExchangePolicy> = {},
): ConsumerExchangePolicy {
  return Object.freeze({
    policyId: 'sunrey.exchange.consumer.v1',
    policyVersion: 1,
    nativeMarket: Object.freeze({
      marketId: SUNREY_MOONREY_MARKET_ID,
      baseAsset: 'SUNREY_COIN',
      quoteAsset: 'MOONREY_COIN',
      fixedExchangeRate: false,
      guaranteedPriceRelationship: false,
    }),
    orderTypes: CONSUMER_ORDER_TYPES,
    defaultProtectionBps: 300n,
    maxProtectionBps: 500n,
    highSpreadBps: 200n,
    lowDepthThreshold: 5n,
    minTradesForStatistics: 2n,
    quoteTtlMs: 15_000,
    staleQuotePolicy: 'REJECT',
    permittedJurisdictions: Object.freeze(['GB', 'IE', 'SIMULATION']),
    simulationFeeScheduleId: 'fees:consumer-simulation-v1',
    simulationExchangeFee: 0n,
    simulationNetworkFee: 0n,
    productionActivated: false,
    firmExecutableQuotesImplemented: false,
    developerQuotaAuthorizesTrading: false,
    publicApiRateLimitPerMinute: PUBLIC_API_RATE_LIMIT_PER_MINUTE,
    ...overrides,
  });
}

export const CONSUMER_TRADING_RATE_POLICY = Object.freeze({
  distinctFromDeveloperQuota: true,
  distinctFromPublicRpcQuota: true,
  ordersPerMinute: 30,
  cancelsPerMinute: 30,
});

export const CONSUMER_RISK_DISCLOSURE_IDS = Object.freeze([
  'CONSUMER_MARKET_RISK_V1',
  'NO_GUARANTEED_PRICE_V1',
  'INFORMATIONAL_VALUE_V1',
]);
