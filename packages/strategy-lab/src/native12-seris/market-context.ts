import type { UtcInstant } from '@solstice/domain';

/** Simulation-only market envelope injected into genome evaluation (Seris BacktestMarket shape, no live venue). */
export type SerisSimulationMarketContext = {
  readonly venue: 'HELIOS_SIMULATION';
  readonly symbol: string;
  readonly kind: 'spot' | 'perpetual' | 'etf';
  readonly requestedRange: { readonly from: UtcInstant; readonly to: UtcInstant };
  readonly feeBps: number;
  readonly slippageBps: number;
  readonly simulation: 'ohlcv';
  readonly fundingIncluded: false;
  readonly liquidationIncluded: false;
};

export function buildSimulationMarketContext(input: {
  readonly symbol: string;
  readonly kind: SerisSimulationMarketContext['kind'];
  readonly from: UtcInstant;
  readonly to: UtcInstant;
  readonly feeBps?: number;
  readonly slippageBps?: number;
}): SerisSimulationMarketContext {
  return Object.freeze({
    venue: 'HELIOS_SIMULATION',
    symbol: input.symbol,
    kind: input.kind,
    requestedRange: Object.freeze({ from: input.from, to: input.to }),
    feeBps: input.feeBps ?? 10,
    slippageBps: input.slippageBps ?? 5,
    simulation: 'ohlcv',
    fundingIncluded: false,
    liquidationIncluded: false,
  });
}
