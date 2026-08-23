import type { ExchangeMarketId } from '../ids.ts';
import type { HaltRecord } from '../types.ts';
import type { ProductizedMarketStatus } from './instrument.ts';

export type PriceBand = {
  readonly marketId: ExchangeMarketId | string;
  readonly referenceUnits: bigint;
  readonly bandBps: bigint;
};

export type CircuitBreaker = {
  readonly marketId: ExchangeMarketId | string;
  readonly referenceUnits: bigint;
  readonly tripBps: bigint;
  readonly active: boolean;
  readonly reason: string;
};

export type RateWindow = {
  readonly orders: number;
  readonly windowStartedMs: number;
  readonly maxOrders: number;
};

export function priceWithinBand(priceUnits: bigint, band: PriceBand): boolean {
  if (band.referenceUnits <= 0n || band.bandBps < 0n) {
    return false;
  }
  const delta = priceUnits > band.referenceUnits ? priceUnits - band.referenceUnits : band.referenceUnits - priceUnits;
  return delta * 10_000n <= band.referenceUnits * band.bandBps;
}

export function tripCircuitBreaker(lastTradeUnits: bigint, breaker: CircuitBreaker): CircuitBreaker {
  if (breaker.referenceUnits <= 0n) {
    return Object.freeze({ ...breaker, active: true, reason: 'invalid reference' });
  }
  const delta =
    lastTradeUnits > breaker.referenceUnits
      ? lastTradeUnits - breaker.referenceUnits
      : breaker.referenceUnits - lastTradeUnits;
  if (delta * 10_000n > breaker.referenceUnits * breaker.tripBps) {
    return Object.freeze({
      ...breaker,
      active: true,
      reason: 'last trade exceeded circuit-breaker band',
    });
  }
  return breaker;
}

export function recordOrderRate(window: RateWindow, nowMs: number, maxWindowMs = 1000): RateWindow {
  if (nowMs - window.windowStartedMs >= maxWindowMs) {
    return { orders: 1, windowStartedMs: nowMs, maxOrders: window.maxOrders };
  }
  return { ...window, orders: window.orders + 1 };
}

export function rateAllows(window: RateWindow): boolean {
  return window.orders <= window.maxOrders;
}

export function controlBlocksNewOrders(input: {
  readonly status: ProductizedMarketStatus;
  readonly halts: readonly HaltRecord[];
  readonly marketId: string;
  readonly accountId: string;
  readonly assetId: string;
  readonly circuitActive: boolean;
}): { readonly blocked: boolean; readonly code?: string } {
  if (input.circuitActive) {
    return { blocked: true, code: 'CIRCUIT_BREAKER' };
  }
  if (input.status === 'HALTED') {
    return { blocked: true, code: 'MARKET_HALTED' };
  }
  if (input.status === 'SUSPENDED') {
    return { blocked: true, code: 'MARKET_SUSPENDED' };
  }
  if (input.status === 'CLOSED') {
    return { blocked: true, code: 'MARKET_CLOSED' };
  }
  if (input.status === 'CLOSE_ONLY') {
    return { blocked: true, code: 'MARKET_CLOSE_ONLY' };
  }
  const halted = input.halts.some(
    (halt) =>
      halt.active &&
      (halt.scope === 'GLOBAL' ||
        (halt.scope === 'MARKET' && halt.targetId === input.marketId) ||
        (halt.scope === 'PARTICIPANT' && halt.targetId === input.accountId) ||
        (halt.scope === 'ASSET' && halt.targetId === input.assetId) ||
        (halt.scope === 'NEW_ORDERS' && (halt.targetId === input.marketId || halt.targetId === 'GLOBAL')) ||
        (halt.scope === 'CANCEL_ONLY' && (halt.targetId === input.marketId || halt.targetId === 'GLOBAL'))),
  );
  if (halted) {
    return { blocked: true, code: 'MARKET_HALTED' };
  }
  return { blocked: false };
}

export function controlAllowsCancelOnly(halts: readonly HaltRecord[], marketId: string): boolean {
  return halts.some(
    (halt) =>
      halt.active &&
      halt.scope === 'CANCEL_ONLY' &&
      (halt.targetId === marketId || halt.targetId === 'GLOBAL'),
  );
}
