import {
  CANONICAL_MARKET_FAMILIES,
  DIGITAL_ORDER_TYPES,
  MARKET_STATES,
  type CanonicalMarketFamily,
  type DigitalOrderType,
  type MarketState,
} from '../taxonomy.ts';
import { EXCHANGE_KILL_SWITCH_SCOPES } from '../regulated/kill-switches.ts';

export { CANONICAL_MARKET_FAMILIES, DIGITAL_ORDER_TYPES, MARKET_STATES };
export type { CanonicalMarketFamily, DigitalOrderType, MarketState };

/** Order types implemented with precise matching semantics. */
export const OPERATIONAL_ORDER_TYPES = [
  'LIMIT',
  'MARKET_WITH_PROTECTION',
  'IOC',
  'FOK',
  'POST_ONLY',
] as const;
export type OperationalOrderType = (typeof OPERATIONAL_ORDER_TYPES)[number];

export const MARKET_SESSION_MODES = ['CONTINUOUS', 'SCHEDULED'] as const;
export type MarketSessionMode = (typeof MARKET_SESSION_MODES)[number];

export const CIRCUIT_BREAKER_STATES = ['PAUSED', 'AUCTION', 'CLOSE_ONLY', 'RESTRICTED'] as const;
export type CircuitBreakerState = (typeof CIRCUIT_BREAKER_STATES)[number];

export const REFERENCE_PRICE_SOURCES = [
  'RECENT_ELIGIBLE_TRADE',
  'INTERNAL_MIDPOINT',
  'APPROVED_ORACLE_FEED',
] as const;
export type ReferencePriceSource = (typeof REFERENCE_PRICE_SOURCES)[number];

export const MARKET_DATA_STREAMS = [
  'TRADES',
  'BBO',
  'DEPTH',
  'MARKET_STATE',
  'AUCTION_STATE',
  'STATISTICS',
] as const;
export type MarketDataStream = (typeof MARKET_DATA_STREAMS)[number];

export const MARKET_DATA_TIERS = ['PUBLIC_DELAYED', 'AUTHORIZED_REALTIME'] as const;
export type MarketDataTier = (typeof MARKET_DATA_TIERS)[number];

export const TRADING_ENVIRONMENTS = ['SANDBOX', 'SIMULATION', 'PRODUCTION'] as const;
export type TradingEnvironment = (typeof TRADING_ENVIRONMENTS)[number];

export const GATEWAY_PROTOCOLS = ['NATIVE', 'FIX_STYLE', 'WEBSOCKET'] as const;
export type GatewayProtocol = (typeof GATEWAY_PROTOCOLS)[number];

export const GATEWAY_MESSAGE_TYPES = [
  'LOGON',
  'LOGOUT',
  'NEW_ORDER',
  'CANCEL',
  'CANCEL_REPLACE',
  'ORDER_STATUS',
  'RESEND_REQUEST',
  'MASS_CANCEL',
  'QUOTE',
] as const;
export type GatewayMessageType = (typeof GATEWAY_MESSAGE_TYPES)[number];

export const INSTITUTIONAL_KILL_SWITCH_SCOPES = EXCHANGE_KILL_SWITCH_SCOPES;
export type InstitutionalKillSwitchScope = (typeof EXCHANGE_KILL_SWITCH_SCOPES)[number];

export const PRODUCTION_ACTIVATION_GATES = [
  'LEGAL',
  'LICENSING',
  'MARKET_POLICY',
  'COMPLIANCE',
  'SURVEILLANCE',
  'CUSTODY',
  'HUMAN_AUTHORIZATION',
] as const;
export type ProductionActivationGate = (typeof PRODUCTION_ACTIVATION_GATES)[number];

export function isCancelOnlyState(state: MarketState): boolean {
  return state === 'CLOSE_ONLY' || state === 'CANCEL_ONLY';
}

export function admitsNewOrders(state: MarketState): boolean {
  return state === 'OPEN' || state === 'AUCTION' || state === 'PREOPEN';
}

export function familyFullyOperational(family: CanonicalMarketFamily): boolean {
  return family === 'DIGITAL_ASSET';
}
