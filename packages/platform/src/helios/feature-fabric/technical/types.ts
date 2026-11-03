/**
 * Native technical indicator bar inputs (research / simulation plane).
 * Prices are integer minor units; indicator outputs use scaled rationals — not ledger Money.
 */

export const HELIOS_TECHNICAL_BAR_SCHEMA = 'sunrey.helios.technical-bar.v1' as const;

export type TechnicalOhlcvBar = {
  readonly schema: typeof HELIOS_TECHNICAL_BAR_SCHEMA;
  readonly instrumentId: string;
  readonly openMinor: bigint;
  readonly highMinor: bigint;
  readonly lowMinor: bigint;
  readonly closeMinor: bigint;
  readonly volumeUnits: bigint;
};

export type PriceField = 'open' | 'high' | 'low' | 'close';

export function barPriceMinor(bar: TechnicalOhlcvBar, field: PriceField): bigint {
  switch (field) {
    case 'open':
      return bar.openMinor;
    case 'high':
      return bar.highMinor;
    case 'low':
      return bar.lowMinor;
    case 'close':
      return bar.closeMinor;
    default:
      return bar.closeMinor;
  }
}

/** Fixed-point indicator value scaled by 10_000 (four decimal places). */
export type ScaledIndicatorValue = number;

export type IndicatorOutputPort = 'value' | 'signal' | 'histogram' | 'upper' | 'middle' | 'lower' | 'width';

export type IndicatorSeriesSnapshot = {
  readonly indicatorId: string;
  readonly port: IndicatorOutputPort;
  readonly values: readonly (ScaledIndicatorValue | null)[];
  readonly initializedFromIndex: number | null;
};

export const HELIOS_TECHNICAL_FEATURE_MANIFEST_VERSION = 'helios-native06-bytex-feature-manifest-v1' as const;

export const NATIVE06_INDICATOR_IDS = [
  'indicator.sma',
  'indicator.ema',
  'indicator.wma',
  'indicator.rsi',
  'indicator.roc',
  'indicator.atr',
  'indicator.bollinger_bands',
  'indicator.macd',
  'indicator.obv',
  'indicator.donchian_channel',
] as const;

export type Native06IndicatorId = (typeof NATIVE06_INDICATOR_IDS)[number];
