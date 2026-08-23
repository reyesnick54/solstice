import { Money } from '../../../money/src/money.ts';
import type { UtcInstant } from '../../../domain/src/time.ts';
import { isqrt, ratio, ratioToBps } from './ratio.ts';
import type { InstrumentLiquidityClass, ProductAssetClass } from './types.ts';
import type { ProductAllocationView } from './allocation-target.ts';
import type { HoldingView } from './holdings.ts';
import type { ValuationPoint } from './performance.ts';

export type RiskMetricAvailability = 'AVAILABLE' | 'INSUFFICIENT_DATA';

export type ConcentrationMetric = {
  readonly largestInstrumentId: string | null;
  readonly largestWeightBps: bigint;
  readonly herfindahlBps: bigint;
  readonly availability: 'AVAILABLE';
};

export type DrawdownMetric = {
  readonly availability: RiskMetricAvailability;
  readonly peak: Money | null;
  readonly trough: Money | null;
  readonly drawdown: Money | null;
  readonly drawdownBps: bigint | null;
};

export type VolatilityMetric = {
  readonly availability: RiskMetricAvailability;
  readonly sampleCount: bigint;
  readonly stdevBps: bigint | null;
  readonly note: string;
};

export type CurrencyExposure = {
  readonly currency: string;
  readonly marketValue: Money;
  readonly weightBps: bigint;
};

export type LiquidityExposure = {
  readonly liquidity: InstrumentLiquidityClass;
  readonly marketValue: Money;
  readonly weightBps: bigint;
};

export type AssetClassExposure = {
  readonly assetClass: ProductAssetClass | string;
  readonly marketValue: Money;
  readonly weightBps: bigint;
};

export type PortfolioRiskView = {
  readonly concentration: ConcentrationMetric;
  readonly drawdown: DrawdownMetric;
  readonly volatility: VolatilityMetric;
  readonly currencyExposure: readonly CurrencyExposure[];
  readonly liquidityExposure: readonly LiquidityExposure[];
  readonly assetClassExposure: readonly AssetClassExposure[];
  readonly fabricatedStatistics: false;
  readonly simulationOnly: true;
};

const MIN_VOL_SAMPLES = 3n;

export function computeRiskMetrics(input: {
  readonly allocation: ProductAllocationView;
  readonly holdings: readonly HoldingView[];
  readonly history: readonly ValuationPoint[];
}): PortfolioRiskView {
  return Object.freeze({
    concentration: concentration(input.allocation),
    drawdown: drawdown(input.history, input.allocation.total.currency),
    volatility: volatility(input.history),
    currencyExposure: Object.freeze(
      input.allocation.byCurrency.map((row) =>
        Object.freeze({
          currency: row.key,
          marketValue: row.marketValue,
          weightBps: row.weightBps,
        }),
      ),
    ),
    liquidityExposure: liquidityBuckets(input.holdings, input.allocation.total),
    assetClassExposure: Object.freeze(
      input.allocation.byAssetClass.map((row) =>
        Object.freeze({
          assetClass: row.key,
          marketValue: row.marketValue,
          weightBps: row.weightBps,
        }),
      ),
    ),
    fabricatedStatistics: false,
    simulationOnly: true,
  });
}

function concentration(allocation: ProductAllocationView): ConcentrationMetric {
  let largest: { key: string; weightBps: bigint } | null = null;
  let herfindahl = 0n;
  for (const row of allocation.byInstrument) {
    herfindahl += (row.weightBps * row.weightBps) / 10_000n;
    if (!largest || row.weightBps > largest.weightBps) {
      largest = { key: row.key, weightBps: row.weightBps };
    }
  }
  return Object.freeze({
    largestInstrumentId: largest?.key ?? null,
    largestWeightBps: largest?.weightBps ?? 0n,
    herfindahlBps: herfindahl,
    availability: 'AVAILABLE',
  });
}

function drawdown(history: readonly ValuationPoint[], currency: string): DrawdownMetric {
  if (history.length < 2) {
    return Object.freeze({
      availability: 'INSUFFICIENT_DATA',
      peak: null,
      trough: null,
      drawdown: null,
      drawdownBps: null,
    });
  }
  let peak = Money.zero(currency);
  let worst = Money.zero(currency);
  let trough = Money.zero(currency);
  let peakAt: UtcInstant | null = null;
  for (const point of history) {
    const value = point.marketValue.plus(point.cash);
    if (peakAt === null || value.cmp(peak) > 0) {
      peak = value;
      peakAt = point.at;
    }
    const dd = peak.minus(value);
    if (dd.cmp(worst) > 0) {
      worst = dd;
      trough = value;
    }
  }
  return Object.freeze({
    availability: 'AVAILABLE',
    peak,
    trough,
    drawdown: worst,
    drawdownBps: peak.minorUnits === 0n ? null : ratioToBps(ratio(worst.minorUnits, peak.minorUnits)),
  });
}

function volatility(history: readonly ValuationPoint[]): VolatilityMetric {
  if (BigInt(history.length) < MIN_VOL_SAMPLES) {
    return Object.freeze({
      availability: 'INSUFFICIENT_DATA',
      sampleCount: BigInt(history.length),
      stdevBps: null,
      note: `Need at least ${MIN_VOL_SAMPLES.toString()} valuation observations.`,
    });
  }
  const returns: bigint[] = [];
  for (let i = 1; i < history.length; i += 1) {
    const prev = history[i - 1];
    const next = history[i];
    if (!prev || !next) {
      continue;
    }
    const start = prev.marketValue.plus(prev.cash);
    const end = next.marketValue.plus(next.cash);
    if (start.minorUnits === 0n) {
      continue;
    }
    returns.push(ratioToBps(ratio(end.minorUnits - start.minorUnits, start.minorUnits)));
  }
  if (BigInt(returns.length) < MIN_VOL_SAMPLES - 1n) {
    return Object.freeze({
      availability: 'INSUFFICIENT_DATA',
      sampleCount: BigInt(returns.length),
      stdevBps: null,
      note: 'Insufficient period returns after skipping zero-value observations.',
    });
  }
  const n = BigInt(returns.length);
  const mean = returns.reduce((sum, row) => sum + row, 0n) / n;
  const varianceNum = returns.reduce((sum, row) => {
    const d = row - mean;
    return sum + d * d;
  }, 0n);
  const stdev = isqrt(varianceNum / (n - 1n));
  return Object.freeze({
    availability: 'AVAILABLE',
    sampleCount: n,
    stdevBps: stdev,
    note: 'Sample standard deviation of period returns in basis points. Not annualized.',
  });
}

function liquidityBuckets(holdings: readonly HoldingView[], total: Money): readonly LiquidityExposure[] {
  const map = new Map<InstrumentLiquidityClass, Money>();
  for (const row of holdings) {
    const key: InstrumentLiquidityClass =
      row.assetClass === 'CASH' || row.assetClass === 'MONEY_MARKET' ? 'HIGH' : row.assetClass === 'FUND' ? 'LOW' : 'MEDIUM';
    const value = row.marketValue ?? Money.zero(row.currency);
    const existing = map.get(key);
    map.set(key, existing ? existing.plus(value) : value);
  }
  return Object.freeze(
    [...map.entries()].map(([liquidity, marketValue]) =>
      Object.freeze({
        liquidity,
        marketValue,
        weightBps: total.minorUnits === 0n ? 0n : ratioToBps(ratio(marketValue.minorUnits, total.minorUnits)),
      }),
    ),
  );
}
