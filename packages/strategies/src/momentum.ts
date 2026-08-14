import type { UtcInstant } from '../../contracts/src/time.ts';
import type { StrategyProposal } from '../../contracts/src/strategy-types.ts';
import type { SimulatedSeries } from '../../execution-engine/src/market-data.ts';
import type { SimulatedStrategy } from './interface.ts';

export class MomentumStrategy implements SimulatedStrategy {
  readonly id = 'strat_momentum';
  readonly strategyClass = 'MOMENTUM' as const;
  readonly seed: bigint;

  constructor(seed: bigint) {
    this.seed = seed;
  }

  propose(series: SimulatedSeries, asOf: UtcInstant): readonly StrategyProposal[] {
    if (series.points.length < 3) return [];
    const a = series.points[series.points.length - 3]!;
    const b = series.points[series.points.length - 1]!;
    const side = b.minorUnitsPerShare >= a.minorUnitsPerShare ? 'BUY' : 'SELL';
    return [
      Object.freeze({
        proposalId: `prop_${this.id}_${asOf}`,
        strategyId: this.id,
        strategyClass: this.strategyClass,
        instrumentId: series.instrumentId,
        side,
        quantityMicros: 1_000_000n,
        limitPriceMinorUnits: b.minorUnitsPerShare,
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
