import { computeEmaSeries, computeSmaSeries, computeWmaSeries } from './moving-averages.ts';
import { computeMacdSeries, computeRocSeries, computeRsiSeries } from './oscillators.ts';
import { computeDonchianSeries } from './price-levels.ts';
import type { Native06IndicatorId, IndicatorOutputPort, IndicatorSeriesSnapshot, TechnicalOhlcvBar } from './types.ts';
import { computeAtrSeries, computeBollingerSeries, computeRealizedVolBpsSeries } from './volatility.ts';
import { computeObvSeries } from './volume.ts';

export type IndicatorComputeParams = Readonly<Record<string, number | boolean>>;

export function computeNative06Indicator(input: {
  readonly indicatorId: Native06IndicatorId;
  readonly port: IndicatorOutputPort;
  readonly bars: readonly TechnicalOhlcvBar[];
  readonly params: IndicatorComputeParams;
}): IndicatorSeriesSnapshot {
  const period = Number(input.params.period ?? input.params.lookbackDays ?? 20);
  switch (input.indicatorId) {
    case 'indicator.sma':
      return snapshot(input.indicatorId, input.port, computeSmaSeries(input.bars, period));
    case 'indicator.ema':
      return snapshot(input.indicatorId, input.port, computeEmaSeries(input.bars, period));
    case 'indicator.wma':
      return snapshot(input.indicatorId, input.port, computeWmaSeries(input.bars, period));
    case 'indicator.rsi':
      return snapshot(input.indicatorId, input.port, computeRsiSeries(input.bars, Number(input.params.period ?? 14)));
    case 'indicator.roc':
      return snapshot(input.indicatorId, input.port, computeRocSeries(input.bars, Number(input.params.period ?? 10)));
    case 'indicator.atr':
      return snapshot(input.indicatorId, input.port, computeAtrSeries(input.bars, Number(input.params.period ?? 14)));
    case 'indicator.obv':
      return snapshot(input.indicatorId, input.port, computeObvSeries(input.bars));
    case 'indicator.bollinger_bands': {
      const bands = computeBollingerSeries(input.bars, period, Number(input.params.k ?? 2));
      const series =
        input.port === 'upper'
          ? bands.upper
          : input.port === 'middle'
            ? bands.middle
            : input.port === 'lower'
              ? bands.lower
              : bands.width;
      return snapshot(input.indicatorId, input.port, series);
    }
    case 'indicator.macd': {
      const macd = computeMacdSeries(
        input.bars,
        Number(input.params.fast ?? 12),
        Number(input.params.slow ?? 26),
        Number(input.params.signal ?? 9),
      );
      const series =
        input.port === 'signal' ? macd.signal : input.port === 'histogram' ? macd.histogram : macd.macd;
      return snapshot(input.indicatorId, input.port, series);
    }
    case 'indicator.donchian_channel': {
      const channel = computeDonchianSeries(input.bars, period, Boolean(input.params.excludeCurrent ?? false));
      const series =
        input.port === 'upper' ? channel.upper : input.port === 'lower' ? channel.lower : channel.middle;
      return snapshot(input.indicatorId, input.port, series);
    }
    default: {
      const exhaustive: never = input.indicatorId;
      throw new Error(`unsupported indicator ${exhaustive}`);
    }
  }
}

export function computeRealizedVolatilityFeature(
  bars: readonly TechnicalOhlcvBar[],
  lookbackDays: number,
): readonly (number | null)[] {
  return computeRealizedVolBpsSeries(bars, lookbackDays);
}

function snapshot(
  indicatorId: Native06IndicatorId,
  port: IndicatorOutputPort,
  values: readonly (number | null)[],
): IndicatorSeriesSnapshot {
  let initializedFromIndex: number | null = null;
  for (let i = 0; i < values.length; i += 1) {
    if (values[i] !== null) {
      initializedFromIndex = i;
      break;
    }
  }
  return Object.freeze({
    indicatorId,
    port,
    values: Object.freeze([...values]),
    initializedFromIndex,
  });
}

/** Detect BYTEX-style cross: value crosses reference in the given direction on this bar index. */
export function detectSeriesCross(input: {
  readonly value: readonly (number | null)[];
  readonly reference: readonly (number | null)[];
  readonly index: number;
  readonly direction: 'above' | 'below';
}): boolean {
  const { index, direction } = input;
  if (index < 1) {
    return false;
  }
  const prevValue = input.value[index - 1];
  const prevRef = input.reference[index - 1];
  const currValue = input.value[index];
  const currRef = input.reference[index];
  if (prevValue === null || prevRef === null || currValue === null || currRef === null) {
    return false;
  }
  if (direction === 'above') {
    return prevValue <= prevRef && currValue > currRef;
  }
  return prevValue >= prevRef && currValue < currRef;
}
