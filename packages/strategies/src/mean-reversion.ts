import type { UtcInstant } from '../../contracts/src/time.ts';
import type { StrategyProposal } from '../../contracts/src/strategy-types.ts';
import type { SimulatedSeries } from '../../execution-engine/src/market-data.ts';
import type { SimulatedStrategy } from './interface.ts';

export class MeanReversionStrategy implements SimulatedStrategy {
  readonly id = 'strat_mean_reversion';
  readonly strategyClass = 'MEAN_REVERSION' as const;
  readonly seed: bigint;

  constructor(seed: bigint) {
    this.seed = seed;
  }

  propose(series: SimulatedSeries, asOf: UtcInstant): readonly StrategyProposal[] {
    if (series.points.length < 4) return [];
    const window = series.points.slice(-4);
    let sum = 0n;
    for (const p of window) sum += p.minorUnitsPerShare;
    const mean = sum / 4n;
    const last = window[window.length - 1]!;
    const side = last.minorUnitsPerShare > mean ? 'SELL' : 'BUY';
    return [
      Object.freeze({
        proposalId: `prop_${this.id}_${asOf}`,
        strategyId: this.id,
        strategyClass: this.strategyClass,
        instrumentId: series.instrumentId,
        side,
        quantityMicros: 1_000_000n,
        limitPriceMinorUnits: last.minorUnitsPerShare,
        currency: series.currency,
        asOf,
        seed: this.seed,
        guaranteed: false,
        expected: false,
        projected: false,
      }),
    ];
  }
}
