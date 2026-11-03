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

function study(definition: NativeStudyDefinition): NativeStudyDefinition {
  return Object.freeze(definition);
}

export const NATIVE_STUDY_CATALOG: Readonly<Record<OpenChartNativeStudyId, NativeStudyDefinition>> =
  Object.freeze({
    sma: study({
      id: 'sma',
      name: 'SMA',
      category: 'Moving Averages',
      overlay: true,
      parameters: [
        { name: 'source', type: 'source', defaultValue: 'close' },
        { name: 'length', type: 'int', defaultValue: 14, min: 1, max: 500 },
      ],
      outputs: ['value'],
    }),
    ema: study({
      id: 'ema',
      name: 'EMA',
      category: 'Moving Averages',
      overlay: true,
      parameters: [
        { name: 'source', type: 'source', defaultValue: 'close' },
        { name: 'length', type: 'int', defaultValue: 14, min: 1, max: 500 },
      ],
      outputs: ['value'],
    }),
    rsi: study({
      id: 'rsi',
      name: 'RSI',
      category: 'Momentum',
      overlay: false,
      parameters: [
        { name: 'source', type: 'source', defaultValue: 'close' },
        { name: 'length', type: 'int', defaultValue: 14, min: 1, max: 500 },
      ],
      outputs: ['value'],
    }),
    atr: study({
      id: 'atr',
      name: 'ATR',
      category: 'Volatility',
      overlay: false,
      parameters: [{ name: 'length', type: 'int', defaultValue: 14, min: 1, max: 500 }],
      outputs: ['value'],
    }),
    macd: study({
      id: 'macd',
      name: 'MACD',
      category: 'Momentum',
      overlay: false,
      parameters: [
        { name: 'fastLength', type: 'int', defaultValue: 12, min: 1, max: 500 },
        { name: 'slowLength', type: 'int', defaultValue: 26, min: 1, max: 500 },
        { name: 'signalLength', type: 'int', defaultValue: 9, min: 1, max: 500 },
      ],
      outputs: ['macd', 'signal', 'histogram'],
    }),
    'bollinger-bands': study({
      id: 'bollinger-bands',
      name: 'Bollinger Bands',
      category: 'Volatility',
      overlay: true,
      parameters: [
        { name: 'source', type: 'source', defaultValue: 'close' },
        { name: 'length', type: 'int', defaultValue: 20, min: 1, max: 500 },
      ],
      outputs: ['basis', 'upper', 'lower'],
    }),
  });
