import { randomUUID } from 'node:crypto';

import { type Brand, brandAs } from '../../domain/src/brand.ts';

export type ExchangeAccountId = Brand<string, 'ExchangeAccountId'>;
export type ExchangeMarketId = Brand<string, 'ExchangeMarketId'>;
export type ExchangeAssetId = Brand<string, 'ExchangeAssetId'>;
export type ExchangeProductId = Brand<string, 'ExchangeProductId'>;
export type OrderId = Brand<string, 'OrderId'>;
export type OrderVersion = Brand<number, 'OrderVersion'>;
export type OrderBookId = Brand<string, 'OrderBookId'>;
export type TradeId = Brand<string, 'TradeId'>;
export type ExecutionId = Brand<string, 'ExecutionId'>;
export type SettlementId = Brand<string, 'SettlementId'>;
export type MarketDataSequence = Brand<number, 'MarketDataSequence'>;
export type ListingId = Brand<string, 'ListingId'>;
export type ListingVersion = Brand<number, 'ListingVersion'>;
export type ExchangeHoldId = Brand<string, 'ExchangeHoldId'>;
export type ExchangeSessionId = Brand<string, 'ExchangeSessionId'>;
export type ClearingInstructionId = Brand<string, 'ClearingInstructionId'>;
export type FeeScheduleId = Brand<string, 'FeeScheduleId'>;
export type ReconciliationId = Brand<string, 'ReconciliationId'>;

function branded(prefix: string): string {
  return `${prefix}_${randomUUID().replace(/-/g, '')}`;
}

export function asExchangeAccountId(value: string): ExchangeAccountId {
  return brandAs<string, 'ExchangeAccountId'>(value);
}
export function asExchangeMarketId(value: string): ExchangeMarketId {
  return brandAs<string, 'ExchangeMarketId'>(value);
}
export function asOrderId(value: string): OrderId {
  return brandAs<string, 'OrderId'>(value);
}
export function asTradeId(value: string): TradeId {
  return brandAs<string, 'TradeId'>(value);
}
export function asListingId(value: string): ListingId {
  return brandAs<string, 'ListingId'>(value);
}
export function asExchangeHoldId(value: string): ExchangeHoldId {
  return brandAs<string, 'ExchangeHoldId'>(value);
}

export function newExchangeAccountId(): ExchangeAccountId {
  return asExchangeAccountId(branded('xacct'));
}
export function newExchangeMarketId(): ExchangeMarketId {
  return asExchangeMarketId(branded('xmkt'));
}
export function newOrderId(): OrderId {
  return asOrderId(branded('xord'));
}
export function newTradeId(): TradeId {
  return asTradeId(branded('xtrd'));
}
export function newExecutionId(): ExecutionId {
  return brandAs<string, 'ExecutionId'>(branded('xexe'));
}
export function newSettlementId(): SettlementId {
  return brandAs<string, 'SettlementId'>(branded('xset'));
}
export function newListingId(): ListingId {
  return asListingId(branded('xlst'));
}
export function newExchangeHoldId(): ExchangeHoldId {
  return asExchangeHoldId(branded('xhold'));
}
export function newClearingInstructionId(): ClearingInstructionId {
  return brandAs<string, 'ClearingInstructionId'>(branded('xclr'));
}
export function newReconciliationId(): ReconciliationId {
  return brandAs<string, 'ReconciliationId'>(branded('xrec'));
}
export function newExchangeSessionId(): ExchangeSessionId {
  return brandAs<string, 'ExchangeSessionId'>(branded('xses'));
}

export const SIMULATION_USD_CASH_ASSET_ID = 'asset:simulation-usd-cash';
export const SUNREY_COIN_USD_MARKET_ID = asExchangeMarketId('market:sunrey-coin-usd-simulation');
export const SUNREY_COIN_NATIVE_ASSET_ID = 'SUNREY_COIN';
export const MOONREY_COIN_NATIVE_ASSET_ID = 'MOONREY_COIN';
export const SUNREY_MOONREY_MARKET_ID = asExchangeMarketId('market:sunrey-coin-moonrey-coin-native');
export const SUNREY_COIN_NATIVE_LISTING_ID = asListingId('listing:sunrey-coin-native');
export const MOONREY_COIN_NATIVE_LISTING_ID = asListingId('listing:moonrey-coin-native');
export const AGGREGATE_RESEARCH_LISTING_ID = asListingId('listing:aggregate-consumer-research-cohort');
export const EXCHANGE_FEE_BOOK = 'SUNREY.EXCHANGE.FEES';
export const SIMULATION_FEE_SCHEDULE_ID = 'fees:simulation-v1' as FeeScheduleId;
