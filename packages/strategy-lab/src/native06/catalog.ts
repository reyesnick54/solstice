/**
 * NATIVE06 Strategy Genome catalog — BYTEX-assimilated declarative node refs only.
 */

import type { Native06NodeKind } from './types.ts';

export const NATIVE06_NODE_CATALOG_VERSION = 'helios-native06-bytex-node-catalog-v1' as const;
export const NATIVE06_FEATURE_MANIFEST_VERSION = 'helios-native06-bytex-feature-manifest-v1' as const;

export type Native06CatalogParamSpec = {
  readonly key: string;
  readonly valueType: 'string' | 'number' | 'boolean';
  readonly required: boolean;
};

export type Native06CatalogNodeDefinition = {
  readonly catalogRef: string;
  readonly kind: Exclude<Native06NodeKind, 'FLOW'>;
  readonly description: string;
  readonly bytexNodeType?: string;
  readonly params: readonly Native06CatalogParamSpec[];
};

export const BYTEX_NODE_TYPE_TO_CATALOG_REF: Readonly<Record<string, string>> = Object.freeze({
  'data.bars': 'data.ohlcv_bars',
  'ind.sma': 'indicator.sma',
  'ind.ema': 'indicator.ema',
  'ind.wma': 'indicator.wma',
  'ind.rsi': 'indicator.rsi',
  'ind.roc': 'indicator.roc',
  'ind.atr': 'indicator.atr',
  'ind.obv': 'indicator.obv',
  'ind.macd': 'indicator.macd',
  'ind.bbands': 'indicator.bollinger_bands',
  'cond.cross': 'condition.series_cross',
  'cond.compare': 'condition.threshold_compare',
  'act.order': 'entry.market_or_limit',
  'act.close': 'exit.close_position',
});

export const NATIVE06_NODE_CATALOG = Object.freeze({
  'data.ohlcv_bars': Object.freeze({
    catalogRef: 'data.ohlcv_bars',
    kind: 'DATA',
    bytexNodeType: 'data.bars',
    description: 'OHLCV bar stream for indicator and feature computation.',
    params: Object.freeze([{ key: 'candleSeriesRef', valueType: 'string', required: true }]),
  }),
  'indicator.sma': Object.freeze({
    catalogRef: 'indicator.sma',
    kind: 'INDICATOR',
    bytexNodeType: 'ind.sma',
    description: 'Simple moving average over bar closes.',
    params: Object.freeze([{ key: 'period', valueType: 'number', required: true }]),
  }),
  'indicator.ema': Object.freeze({
    catalogRef: 'indicator.ema',
    kind: 'INDICATOR',
    bytexNodeType: 'ind.ema',
    description: 'Exponential moving average over bar closes.',
    params: Object.freeze([{ key: 'period', valueType: 'number', required: true }]),
  }),
  'indicator.wma': Object.freeze({
    catalogRef: 'indicator.wma',
    kind: 'INDICATOR',
    bytexNodeType: 'ind.wma',
    description: 'Weighted moving average over bar closes.',
    params: Object.freeze([{ key: 'period', valueType: 'number', required: true }]),
  }),
  'indicator.rsi': Object.freeze({
    catalogRef: 'indicator.rsi',
    kind: 'INDICATOR',
    bytexNodeType: 'ind.rsi',
    description: 'Relative strength index (0–100).',
    params: Object.freeze([{ key: 'period', valueType: 'number', required: true }]),
  }),
  'indicator.roc': Object.freeze({
    catalogRef: 'indicator.roc',
    kind: 'INDICATOR',
    bytexNodeType: 'ind.roc',
    description: 'Rate of change percent.',
    params: Object.freeze([{ key: 'period', valueType: 'number', required: true }]),
  }),
  'indicator.atr': Object.freeze({
    catalogRef: 'indicator.atr',
    kind: 'INDICATOR',
    bytexNodeType: 'ind.atr',
    description: 'Average true range.',
    params: Object.freeze([{ key: 'period', valueType: 'number', required: true }]),
  }),
  'indicator.obv': Object.freeze({
    catalogRef: 'indicator.obv',
    kind: 'INDICATOR',
    bytexNodeType: 'ind.obv',
    description: 'On-balance volume.',
    params: Object.freeze([]),
  }),
  'indicator.macd': Object.freeze({
    catalogRef: 'indicator.macd',
    kind: 'INDICATOR',
    bytexNodeType: 'ind.macd',
    description: 'MACD line with signal and histogram ports.',
    params: Object.freeze([
      { key: 'fast', valueType: 'number', required: true },
      { key: 'slow', valueType: 'number', required: true },
      { key: 'signal', valueType: 'number', required: true },
    ]),
  }),
  'indicator.bollinger_bands': Object.freeze({
    catalogRef: 'indicator.bollinger_bands',
    kind: 'INDICATOR',
    bytexNodeType: 'ind.bbands',
    description: 'Bollinger bands (upper/middle/lower/width).',
    params: Object.freeze([
      { key: 'period', valueType: 'number', required: true },
      { key: 'k', valueType: 'number', required: false },
    ]),
  }),
  'feature.realized_volatility': Object.freeze({
    catalogRef: 'feature.realized_volatility',
    kind: 'FEATURE',
    description: 'Rolling realized volatility feature for sizing and regime gates.',
    params: Object.freeze([{ key: 'lookbackDays', valueType: 'number', required: true }]),
  }),
  'condition.series_cross': Object.freeze({
    catalogRef: 'condition.series_cross',
    kind: 'CONDITION',
    bytexNodeType: 'cond.cross',
    description: 'Detect when a value series crosses a reference series.',
    params: Object.freeze([{ key: 'direction', valueType: 'string', required: true }]),
  }),
  'condition.threshold_compare': Object.freeze({
    catalogRef: 'condition.threshold_compare',
    kind: 'CONDITION',
    bytexNodeType: 'cond.compare',
    description: 'Compare an input against a genome threshold parameter.',
    params: Object.freeze([]),
  }),
  'signal.trend_follow_cross': Object.freeze({
    catalogRef: 'signal.trend_follow_cross',
    kind: 'SIGNAL',
    description: 'Trend signal emitted when a cross condition fires.',
    params: Object.freeze([{ key: 'direction', valueType: 'string', required: true }]),
  }),
  'sizing.fixed_notional': Object.freeze({
    catalogRef: 'sizing.fixed_notional',
    kind: 'SIZING',
    description: 'Fixed notional or quantity sizing from genome parameters.',
    params: Object.freeze([{ key: 'sizeParam', valueType: 'string', required: true }]),
  }),
  'risk.max_gross_exposure_bps': Object.freeze({
    catalogRef: 'risk.max_gross_exposure_bps',
    kind: 'RISK',
    description: 'Cap gross exposure in basis points.',
    params: Object.freeze([{ key: 'maxGrossExposureBps', valueType: 'number', required: true }]),
  }),
  'entry.market_or_limit': Object.freeze({
    catalogRef: 'entry.market_or_limit',
    kind: 'ENTRY',
    bytexNodeType: 'act.order',
    description: 'Declarative entry order preference (simulation-only).',
    params: Object.freeze([
      { key: 'side', valueType: 'string', required: true },
      { key: 'orderType', valueType: 'string', required: true },
      { key: 'onlyWhenFlat', valueType: 'boolean', required: false },
    ]),
  }),
  'exit.close_position': Object.freeze({
    catalogRef: 'exit.close_position',
    kind: 'EXIT',
    bytexNodeType: 'act.close',
    description: 'Close open exposure when trigger condition fires.',
    params: Object.freeze([]),
  }),
  'execution.market_with_slippage_cap': Object.freeze({
    catalogRef: 'execution.market_with_slippage_cap',
    kind: 'EXECUTION_PREFERENCE',
    description: 'Execution preference with explicit slippage tolerance.',
    params: Object.freeze([
      { key: 'preferredOrderType', valueType: 'string', required: true },
      { key: 'maxSlippageToleranceBps', valueType: 'number', required: false },
    ]),
  }),
  'regime.permitted_market_regime': Object.freeze({
    catalogRef: 'regime.permitted_market_regime',
    kind: 'REGIME',
    description: 'Permitted and prohibited market regimes.',
    params: Object.freeze([]),
  }),
}) as Readonly<Record<string, Native06CatalogNodeDefinition>>;

export function native06CatalogDefinitionFor(ref: string): Native06CatalogNodeDefinition | undefined {
  return NATIVE06_NODE_CATALOG[ref];
}

export function catalogRefForBytexNodeType(bytexType: string): string | undefined {
  return BYTEX_NODE_TYPE_TO_CATALOG_REF[bytexType];
}
