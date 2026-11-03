/**
 * HELIOS OS03 — execution simulation taxonomies.
 * Reuses M22 order semantics where applicable; simulation-only venue.
 */

import {
  EXECUTION_ORDER_TYPES,
  EXECUTION_TIME_IN_FORCE,
  type ExecutionOrderType,
  type ExecutionTimeInForce,
} from '../../multi-asset/m22/taxonomy.ts';

export { EXECUTION_ORDER_TYPES, EXECUTION_TIME_IN_FORCE };
export type SimulatedOrderType = ExecutionOrderType;
export type SimulatedTimeInForce = ExecutionTimeInForce;

export const MARKET_DATA_INPUT_GRANULARITIES = [
  'LEVEL_2_BOOK',
  'QUOTE',
  'TRADE',
  'BAR',
] as const;
export type MarketDataInputGranularity = (typeof MARKET_DATA_INPUT_GRANULARITIES)[number];

export const EXECUTION_FIDELITY_LEVELS = [
  'LEVEL_2_BOOK',
  'QUOTE',
  'TRADE',
  'BAR',
  'SYNTHETIC',
] as const;
export type ExecutionFidelityLevel = (typeof EXECUTION_FIDELITY_LEVELS)[number];

export const BAR_EXECUTION_MODES = ['CLOSE_ONLY', 'DETERMINISTIC_OHLC_PATH'] as const;
export type BarExecutionMode = (typeof BAR_EXECUTION_MODES)[number];

export const OHLC_PATH_SEQUENCES = ['O_H_L_C', 'O_L_H_C'] as const;
export type OhlcPathSequence = (typeof OHLC_PATH_SEQUENCES)[number];

export const SIMULATED_ORDER_SIDES = ['BUY', 'SELL'] as const;
export type SimulatedOrderSide = (typeof SIMULATED_ORDER_SIDES)[number];

export const SIMULATED_ORDER_STATUSES = [
  'PENDING_ACTIVATION',
  'WORKING',
  'PARTIALLY_FILLED',
  'FILLED',
  'CANCEL_PENDING',
  'CANCELLED',
  'REJECTED',
  'EXPIRED',
  'STOP_TRIGGERED',
] as const;
export type SimulatedOrderStatus = (typeof SIMULATED_ORDER_STATUSES)[number];

export const LIQUIDITY_ROLES = ['MAKER', 'TAKER'] as const;
export type LiquidityRole = (typeof LIQUIDITY_ROLES)[number];

export const FILL_MODEL_VERSION = 'helios-os03-fill-v1' as const;
export const FEE_MODEL_VERSION = 'helios-os03-fee-v1' as const;
export const LATENCY_MODEL_VERSION = 'helios-os03-latency-v1' as const;
export const SLIPPAGE_MODEL_VERSION = 'helios-os03-slippage-v1' as const;
export const MATCHING_ENGINE_VERSION = 'helios-os03-matching-v1' as const;
export const SIMULATION_SCHEMA = 'sunrey.helios.execution-twin.simulation.v1' as const;
