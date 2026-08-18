import { MARKET_STATES, ORDER_STATUSES, type MarketState, type OrderStatus } from '../taxonomy.ts';
import { OPERATIONAL_ORDER_TYPES, type OperationalOrderType } from '../ops/taxonomy.ts';

export { MARKET_STATES, ORDER_STATUSES, OPERATIONAL_ORDER_TYPES };
export type { MarketState, OrderStatus, OperationalOrderType };

export const CONSUMER_SIDES = ['BUY', 'SELL'] as const;
export type ConsumerSide = (typeof CONSUMER_SIDES)[number];

export const CONSUMER_FLOWS = ['BUY', 'SELL', 'CONVERT'] as const;
export type ConsumerFlow = (typeof CONSUMER_FLOWS)[number];

export const CONSUMER_ORDER_TYPES = ['MARKET_WITH_PROTECTION', 'LIMIT'] as const;
export type ConsumerOrderType = (typeof CONSUMER_ORDER_TYPES)[number];

export const CONSUMER_QUOTE_KINDS = ['INDICATIVE', 'EXECUTABLE'] as const;
export type ConsumerQuoteKind = (typeof CONSUMER_QUOTE_KINDS)[number];

export const CONSUMER_ORDER_STATUS_VIEWS = [
  'SUBMITTED',
  'OPEN',
  'PARTIALLY_FILLED',
  'FILLED',
  'CANCELLED',
  'REJECTED',
  'EXPIRED',
] as const;
export type ConsumerOrderStatusView = (typeof CONSUMER_ORDER_STATUS_VIEWS)[number];

export const CONSUMER_SETTLEMENT_VIEWS = [
  'TRADE_MATCHED',
  'SETTLEMENT_PENDING',
  'SUBMISSION_UNKNOWN',
  'FINALIZED',
] as const;
export type ConsumerSettlementView = (typeof CONSUMER_SETTLEMENT_VIEWS)[number];

export const CONSUMER_IDENTITY_CLASSES = ['RETAIL', 'PROFESSIONAL'] as const;
export type ConsumerIdentityClass = (typeof CONSUMER_IDENTITY_CLASSES)[number];

export const CONSUMER_ACCOUNT_STATUSES = [
  'PENDING',
  'ACTIVE_SIMULATION',
  'RESTRICTED',
  'SUSPENDED',
  'CLOSED',
] as const;
export type ConsumerAccountStatus = (typeof CONSUMER_ACCOUNT_STATUSES)[number];

export const CONSUMER_ENVIRONMENTS = ['SANDBOX', 'SIMULATION', 'PRODUCTION'] as const;
export type ConsumerEnvironment = (typeof CONSUMER_ENVIRONMENTS)[number];

export const CONSUMER_ORIGINS = ['HUMAN', 'AGENT'] as const;
export type ConsumerOrigin = (typeof CONSUMER_ORIGINS)[number];

export const LIQUIDITY_WARNING_CODES = [
  'HIGH_SPREAD',
  'LOW_DEPTH',
  'MARKET_PAUSED',
  'MARKET_RESTRICTED',
  'QUOTE_STALE',
] as const;
export type LiquidityWarningCode = (typeof LIQUIDITY_WARNING_CODES)[number];

export const CONSUMER_NOTIFICATION_KINDS = [
  'ORDER_ACCEPTED',
  'PARTIAL_FILL',
  'FILLED',
  'CANCELLED',
  'MARKET_RESTRICTION',
  'SETTLEMENT_FINALIZED',
  'PRICE_ALERT',
] as const;
export type ConsumerNotificationKind = (typeof CONSUMER_NOTIFICATION_KINDS)[number];

export const CONSUMER_NATIVE_ASSETS = ['SUNREY_COIN', 'MOONREY_COIN'] as const;
export type ConsumerNativeAsset = (typeof CONSUMER_NATIVE_ASSETS)[number];

export const VALUE_SOURCE_KINDS = [
  'RECENT_ELIGIBLE_TRADE',
  'INTERNAL_MIDPOINT',
  'APPROVED_ORACLE_FEED',
  'UNAVAILABLE',
] as const;
export type ValueSourceKind = (typeof VALUE_SOURCE_KINDS)[number];

export function mapOrderStatusView(status: OrderStatus | 'UNKNOWN'): ConsumerOrderStatusView | 'UNKNOWN' {
  switch (status) {
    case 'CREATED':
    case 'AUTHORIZED':
      return 'SUBMITTED';
    case 'OPEN':
      return 'OPEN';
    case 'PARTIALLY_FILLED':
      return 'PARTIALLY_FILLED';
    case 'FILLED':
      return 'FILLED';
    case 'CANCELLED':
    case 'CANCEL_PENDING':
      return 'CANCELLED';
    case 'REJECTED':
      return 'REJECTED';
    case 'EXPIRED':
      return 'EXPIRED';
    default:
      return 'UNKNOWN';
  }
}

export function consumerOrderTypeToOperational(type: ConsumerOrderType): OperationalOrderType {
  return type;
}

export function circuitBreakerSafeExplanation(state: MarketState): string {
  if (state === 'PAUSED' || state === 'HALTED' || state === 'RESTRICTED') {
    return 'Trading is temporarily restricted while a market protection pause is in effect. Confidential surveillance and security details are not shown.';
  }
  if (state === 'CLOSED' || state === 'CLOSE_ONLY' || state === 'CANCEL_ONLY') {
    return 'This market is not accepting new consumer orders in the current session state.';
  }
  if (state === 'AUCTION' || state === 'PREOPEN') {
    return 'The market is collecting eligible limit interest. Aggressive consumer orders are not accepted until continuous trading resumes.';
  }
  return 'The market is open for eligible consumer orders.';
}
