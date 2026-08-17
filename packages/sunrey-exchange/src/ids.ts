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
export type InstrumentId = Brand<string, 'InstrumentId'>;
export type AuctionId = Brand<string, 'AuctionId'>;
export type ContractId = Brand<string, 'ContractId'>;
export type RightId = Brand<string, 'RightId'>;
export type EscrowId = Brand<string, 'EscrowId'>;
export type DeliveryId = Brand<string, 'DeliveryId'>;
export type DisputeId = Brand<string, 'DisputeId'>;
export type TemplateHash = Brand<string, 'TemplateHash'>;

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

export function asInstrumentId(value: string): InstrumentId {
  return brandAs<string, 'InstrumentId'>(value);
}
export function asAuctionId(value: string): AuctionId {
  return brandAs<string, 'AuctionId'>(value);
}
export function asContractId(value: string): ContractId {
  return brandAs<string, 'ContractId'>(value);
}
export function asRightId(value: string): RightId {
  return brandAs<string, 'RightId'>(value);
}
export function asEscrowId(value: string): EscrowId {
  return brandAs<string, 'EscrowId'>(value);
}
export function asDeliveryId(value: string): DeliveryId {
  return brandAs<string, 'DeliveryId'>(value);
}
export function asDisputeId(value: string): DisputeId {
  return brandAs<string, 'DisputeId'>(value);
}

export function newInstrumentId(): InstrumentId {
  return asInstrumentId(branded('xins'));
}
export function newAuctionId(): AuctionId {
  return asAuctionId(branded('xauc'));
}
export function newContractId(): ContractId {
  return asContractId(branded('xcon'));
}
export function newRightId(): RightId {
  return asRightId(branded('xright'));
}
export function newEscrowId(): EscrowId {
  return asEscrowId(branded('xesc'));
}
export function newDeliveryId(): DeliveryId {
  return asDeliveryId(branded('xdel'));
}
export function newDisputeId(): DisputeId {
  return asDisputeId(branded('xdsp'));
}

export const SIMULATION_USD_CASH_ASSET_ID = 'asset:simulation-usd-cash';
export const MOONREY_COIN_ASSET_ID = 'asset:moonrey-coin';
export const SUNREY_COIN_USD_MARKET_ID = asExchangeMarketId('market:sunrey-coin-usd-simulation');
export const SUNREY_MOONREY_MARKET_ID = asExchangeMarketId('market:sunrey-moonrey-native-simulation');
export const GPU_COMPUTE_MARKET_ID = asExchangeMarketId('market:gpu-compute-simulation');
export const MANUFACTURING_CAPACITY_MARKET_ID = asExchangeMarketId('market:manufacturing-capacity-simulation');
export const INFORMATION_RIGHT_MARKET_ID = asExchangeMarketId('market:information-right-simulation');
export const SUNREY_COIN_NATIVE_ASSET_ID = 'SUNREY_COIN';
export const MOONREY_COIN_NATIVE_ASSET_ID = 'MOONREY_COIN';
export const SUNREY_MOONREY_MARKET_ID = asExchangeMarketId('market:sunrey-coin-moonrey-coin-native');
export const SUNREY_COIN_NATIVE_LISTING_ID = asListingId('listing:sunrey-coin-native');
export const MOONREY_COIN_NATIVE_LISTING_ID = asListingId('listing:moonrey-coin-native');
export const AGGREGATE_RESEARCH_LISTING_ID = asListingId('listing:aggregate-consumer-research-cohort');
export const EXCHANGE_FEE_BOOK = 'SUNREY.EXCHANGE.FEES';
export const SIMULATION_FEE_SCHEDULE_ID = 'fees:simulation-v1' as FeeScheduleId;
