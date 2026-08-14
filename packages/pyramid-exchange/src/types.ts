import type { CustomerId, UtcInstant } from '@solstice/domain';

export const ORDER_SIDES = ['BUY', 'SELL'] as const;
export type OrderSide = (typeof ORDER_SIDES)[number];

export const ORDER_TYPES = ['LIMIT', 'MARKET', 'CANCEL'] as const;
export type OrderType = (typeof ORDER_TYPES)[number];

export const TIME_IN_FORCE = ['GTC', 'IOC', 'FOK'] as const;
export type TimeInForce = (typeof TIME_IN_FORCE)[number];

export const ORDER_STATES = [
  'NEW',
  'REFUSED',
  'CLEARED',
  'RESTING',
  'PARTIALLY_FILLED',
  'FILLED',
  'CANCELLED',
] as const;
export type OrderState = (typeof ORDER_STATES)[number];

export const ASSET_CAPABILITIES = [
  'SPOT_TRADE',
  'WITHDRAW',
  'DEPOSIT',
  'FIAT_CONVERT',
  'CROSS_BORDER_TRANSFER',
] as const;
export type AssetCapability = (typeof ASSET_CAPABILITIES)[number];

export const LISTING_STATUSES = ['UNLISTED', 'LISTED', 'SUSPENDED', 'DELISTED'] as const;
export type ListingStatus = (typeof LISTING_STATUSES)[number];

export type AssetPair = {
  readonly symbol: string;
  readonly base: string;
  readonly quote: string;
};

export const PYR_USD: AssetPair = Object.freeze({
  symbol: 'PYR/USD',
  base: 'PYR',
  quote: 'USD',
});

/** Quote minor units per 1 whole base unit. Quantity is base minor units. */
export const BASE_PRICE_SCALE = 100n;

export type Order = {
  readonly id: string;
  readonly customerId: CustomerId;
  readonly customerName: string;
  readonly jurisdiction: string;
  readonly pair: AssetPair;
  readonly side: OrderSide;
  readonly type: OrderType;
  readonly quantity: bigint;
  readonly remaining: bigint;
  readonly price: bigint | undefined;
  readonly timeInForce: TimeInForce;
  readonly state: OrderState;
  readonly createdAt: UtcInstant;
  readonly updatedAt: UtcInstant;
  readonly sequence: number;
  readonly coordinationGroup?: string;
};

export type Fill = {
  readonly id: string;
  readonly pair: string;
  readonly price: bigint;
  readonly quantity: bigint;
  readonly buyOrderId: string;
  readonly sellOrderId: string;
  readonly buyCustomerId: CustomerId;
  readonly sellCustomerId: CustomerId;
  readonly takerOrderId: string;
  readonly makerOrderId: string;
  readonly feeQuoteMinor: bigint;
  readonly feePayerCustomerId: CustomerId;
  readonly occurredAt: UtcInstant;
  readonly sequence: number;
};

export type EligibleCustomer = {
  readonly customerId: CustomerId;
  readonly name: string;
  readonly jurisdiction: string;
  readonly eligible: boolean;
  readonly perOrderLimit: bigint;
};

export function notionalQuoteMinor(quantity: bigint, price: bigint): bigint {
  return (quantity * price) / BASE_PRICE_SCALE;
}

export function feeQuoteMinor(notional: bigint): bigint {
  if (notional <= 0n) return 0n;
  const fee = notional / 1000n;
  return fee === 0n ? 1n : fee;
}

export function oppositeSide(side: OrderSide): OrderSide {
  return side === 'BUY' ? 'SELL' : 'BUY';
}
