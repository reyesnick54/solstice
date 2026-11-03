/**
 * NATIVE03 — BYTEX-aligned deterministic trading runtime taxonomy (TypeScript port).
 * Reference: vendor/assimilation/bytex @ 67b3e103 (Apache-2.0), study-only.
 */

export const HELIOS_NATIVE_BYTEX_RUNTIME = 'HELIOS_NATIVE_BYTEX_RUNTIME' as const;

/** Mirrors BYTEX TradingEnvironment for interface parity across research / paper / live. */
export const BYTEX_RUNTIME_ENVIRONMENTS = Object.freeze([
  'BACKTEST',
  'SANDBOX',
  'LIVE',
] as const);

export type BytexRuntimeEnvironment = (typeof BYTEX_RUNTIME_ENVIRONMENTS)[number];

export const BYTEX_ORDER_STATUSES = Object.freeze([
  'INITIALIZED',
  'DENIED',
  'EMULATED',
  'RELEASED',
  'SUBMITTED',
  'ACCEPTED',
  'REJECTED',
  'CANCELED',
  'EXPIRED',
  'TRIGGERED',
  'PENDING_UPDATE',
  'PENDING_CANCEL',
  'PARTIALLY_FILLED',
  'FILLED',
] as const);

export type BytexOrderStatus = (typeof BYTEX_ORDER_STATUSES)[number];

export const BYTEX_ORDER_EVENT_KINDS = Object.freeze([
  'ORDER_DENIED',
  'ORDER_EMULATED',
  'ORDER_RELEASED',
  'ORDER_SUBMITTED',
  'ORDER_ACCEPTED',
  'ORDER_REJECTED',
  'ORDER_CANCELED',
  'ORDER_EXPIRED',
  'ORDER_TRIGGERED',
  'ORDER_PENDING_UPDATE',
  'ORDER_PENDING_CANCEL',
  'ORDER_PARTIAL_FILL',
  'ORDER_FILLED',
] as const);

export type BytexOrderEventKind = (typeof BYTEX_ORDER_EVENT_KINDS)[number];

export const BYTEX_PORTFOLIO_EVENT_KINDS = Object.freeze([
  'POSITION_OPENED',
  'POSITION_CHANGED',
  'POSITION_CLOSED',
  'ACCOUNT_BALANCE_CHANGED',
] as const);

export type BytexPortfolioEventKind = (typeof BYTEX_PORTFOLIO_EVENT_KINDS)[number];

export const BYTEX_ENGINE_EVENT_KINDS = Object.freeze([
  'MARKET_DATA',
  'TIMER',
  'ORDER',
  'PORTFOLIO',
  'STRATEGY',
  'CHECKPOINT',
] as const);

export type BytexEngineEventKind = (typeof BYTEX_ENGINE_EVENT_KINDS)[number];

export const BYTEX_STRATEGY_LIFECYCLE_PHASES = Object.freeze([
  'REGISTERED',
  'STARTING',
  'RUNNING',
  'FAULTED',
  'STOPPED',
  'SAVED',
  'RESTORED',
] as const);

export type BytexStrategyLifecyclePhase = (typeof BYTEX_STRATEGY_LIFECYCLE_PHASES)[number];
