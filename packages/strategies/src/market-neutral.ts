import type { UtcInstant } from '../../contracts/src/time.ts';
import type { StrategyProposal } from '../../contracts/src/strategy-types.ts';
import type { SimulatedSeries } from '../../execution-engine/src/market-data.ts';
import type { SimulatedStrategy } from './interface.ts';

export class MarketNeutralPairStrategy implements SimulatedStrategy {
  readonly id = 'strat_market_neutral_pair';
  readonly strategyClass = 'MARKET_NEUTRAL_PAIR' as const;
  readonly seed: bigint;
  readonly pairInstrumentId: string;

  constructor(seed: bigint, pairInstrumentId = 'SIM.B') {
    this.seed = seed;
    this.pairInstrumentId = pairInstrumentId;
  }

  propose(series: SimulatedSeries, asOf: UtcInstant): readonly StrategyProposal[] {
    if (series.points.length < 2) return [];
    const last = series.points[series.points.length - 1]!;
    const prev = series.points[series.points.length - 2]!;
    const longA = last.minorUnitsPerShare <= prev.minorUnitsPerShare;
    return [
      Object.freeze({
        proposalId: `prop_${this.id}_a_${asOf}`,
        strategyId: this.id,
        strategyClass: this.strategyClass,
        instrumentId: series.instrumentId,
        pairInstrumentId: this.pairInstrumentId,
        side: longA ? 'BUY' : 'SELL',
        quantityMicros: 1_000_000n,
        limitPriceMinorUnits: last.minorUnitsPerShare,
        currency: series.currency,
        asOf,
        seed: this.seed,
        guaranteed: false,
        expected: false,
        projected: false,
      }),
      Object.freeze({
        proposalId: `prop_${this.id}_b_${asOf}`,
        strategyId: this.id,
        strategyClass: this.strategyClass,
        instrumentId: this.pairInstrumentId,
        pairInstrumentId: series.instrumentId,
        side: longA ? 'SELL' : 'BUY',
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
