/**
 * Native study catalog (metadata aligned with OpenChart `server/indicators/catalog` entries).
 */

export const OPENCHART_NATIVE_STUDY_IDS = [
  'sma',
  'ema',
  'rsi',
  'atr',
  'macd',
  'bollinger-bands',
] as const;

export type OpenChartNativeStudyId = (typeof OPENCHART_NATIVE_STUDY_IDS)[number];

export type StudyParameterSpec =
  | { readonly name: string; readonly type: 'int'; readonly defaultValue: number; readonly min: number; readonly max: number }
  | { readonly name: string; readonly type: 'source'; readonly defaultValue: 'close' };

export type NativeStudyDefinition = {
  readonly id: OpenChartNativeStudyId;
  readonly name: string;
  readonly category: string;
  readonly overlay: boolean;
  readonly parameters: readonly StudyParameterSpec[];
  readonly outputs: readonly string[];
};

export const NATIVE_STUDY_CATALOG: Readonly<Record<OpenChartNativeStudyId, NativeStudyDefinition>> =
  Object.freeze({
    sma: Object.freeze({
      id: 'sma',
      name: 'SMA',
      category: 'Moving Averages',
      overlay: true,
      parameters: Object.freeze([
        { name: 'source', type: 'source', defaultValue: 'close' },
        { name: 'length', type: 'int', defaultValue: 14, min: 1, max: 500 },
      ]),
      outputs: Object.freeze(['value']),
    }),
    ema: Object.freeze({
      id: 'ema',
      name: 'EMA',
      category: 'Moving Averages',
      overlay: true,
      parameters: Object.freeze([
        { name: 'source', type: 'source', defaultValue: 'close' },
        { name: 'length', type: 'int', defaultValue: 14, min: 1, max: 500 },
      ]),
      outputs: Object.freeze(['value']),
    }),
    rsi: Object.freeze({
      id: 'rsi',
      name: 'RSI',
      category: 'Momentum',
      overlay: false,
      parameters: Object.freeze([
        { name: 'source', type: 'source', defaultValue: 'close' },
        { name: 'length', type: 'int', defaultValue: 14, min: 1, max: 500 },
      ]),
      outputs: Object.freeze(['value']),
    }),
    atr: Object.freeze({
      id: 'atr',
      name: 'ATR',
      category: 'Volatility',
      overlay: false,
      parameters: Object.freeze([
        { name: 'length', type: 'int', defaultValue: 14, min: 1, max: 500 },
      ]),
      outputs: Object.freeze(['value']),
    }),
    macd: Object.freeze({
      id: 'macd',
      name: 'MACD',
      category: 'Momentum',
      overlay: false,
      parameters: Object.freeze([
        { name: 'fastLength', type: 'int', defaultValue: 12, min: 1, max: 500 },
        { name: 'slowLength', type: 'int', defaultValue: 26, min: 1, max: 500 },
        { name: 'signalLength', type: 'int', defaultValue: 9, min: 1, max: 500 },
      ]),
      outputs: Object.freeze(['macd', 'signal', 'histogram']),
    }),
    'bollinger-bands': Object.freeze({
      id: 'bollinger-bands',
      name: 'Bollinger Bands',
      category: 'Volatility',
      overlay: true,
      parameters: Object.freeze([
        { name: 'source', type: 'source', defaultValue: 'close' },
        { name: 'length', type: 'int', defaultValue: 20, min: 1, max: 500 },
      ]),
      outputs: Object.freeze(['basis', 'upper', 'lower']),
    }),
  });
