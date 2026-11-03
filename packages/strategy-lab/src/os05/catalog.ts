/**
 * Validated Strategy Genome node catalog — declarative refs only; no executable payloads.
 */

import type { StrategyNodeKind } from './types.ts';

export const STRATEGY_GENOME_NODE_CATALOG_VERSION = 'helios-os05-node-catalog-v1' as const;
export const STRATEGY_GENOME_FEATURE_MANIFEST_VERSION = 'helios-os05-feature-manifest-v1' as const;

export type CatalogParamSpec = {
  readonly key: string;
  readonly valueType: 'string' | 'number' | 'boolean';
  readonly required: boolean;
};

export type CatalogNodeDefinition = {
  readonly catalogRef: string;
  readonly kind: Exclude<StrategyNodeKind, 'FLOW'>;
  readonly description: string;
  readonly params: readonly CatalogParamSpec[];
};

export const STRATEGY_GENOME_NODE_CATALOG: Readonly<Record<string, CatalogNodeDefinition>> = Object.freeze({
  'feature.realized_volatility': Object.freeze({
    catalogRef: 'feature.realized_volatility',
    kind: 'FEATURE',
    description: 'Rolling realized volatility over a configured lookback window.',
    params: Object.freeze([
      { key: 'lookbackDays', valueType: 'number', required: true },
      { key: 'annualizationFactor', valueType: 'number', required: false },
    ]),
  }),
  'condition.threshold_compare': Object.freeze({
    catalogRef: 'condition.threshold_compare',
    kind: 'CONDITION',
    description: 'Compare a feature or signal input against a configured threshold parameter.',
    params: Object.freeze([]),
  }),
  'signal.mean_reversion_zscore': Object.freeze({
    catalogRef: 'signal.mean_reversion_zscore',
    kind: 'SIGNAL',
    description: 'Mean-reversion z-score signal relative to a rolling reference.',
    params: Object.freeze([
      { key: 'referenceWindowBars', valueType: 'number', required: true },
      { key: 'volNormalize', valueType: 'boolean', required: false },
    ]),
  }),
  'sizing.volatility_target_exposure': Object.freeze({
    catalogRef: 'sizing.volatility_target_exposure',
    kind: 'SIZING',
    description: 'Scale exposure to target portfolio volatility using a vol feature input.',
    params: Object.freeze([
      { key: 'targetVolBps', valueType: 'number', required: true },
      { key: 'maxGrossExposureBps', valueType: 'number', required: true },
    ]),
  }),
  'risk.max_strategy_contribution_portfolio_var': Object.freeze({
    catalogRef: 'risk.max_strategy_contribution_portfolio_var',
    kind: 'RISK',
    description: 'Cap strategy contribution to portfolio value-at-risk.',
    params: Object.freeze([{ key: 'maxContributionVarBps', valueType: 'number', required: true }]),
  }),
  'exit.zscore_normalize_or_stop': Object.freeze({
    catalogRef: 'exit.zscore_normalize_or_stop',
    kind: 'EXIT',
    description: 'Exit when z-score normalizes toward zero or a protective stop triggers.',
    params: Object.freeze([
      { key: 'normalizeZThreshold', valueType: 'number', required: true },
      { key: 'stopLossBps', valueType: 'number', required: true },
    ]),
  }),
  'execution.passive_limit_preferred': Object.freeze({
    catalogRef: 'execution.passive_limit_preferred',
    kind: 'EXECUTION',
    description: 'Prefer passive limit orders with explicit urgency fallback policy.',
    params: Object.freeze([
      { key: 'preferredOrderType', valueType: 'string', required: true },
      { key: 'maxSlippageToleranceBps', valueType: 'number', required: false },
    ]),
  }),
  'regime_gate.permitted_market_regime': Object.freeze({
    catalogRef: 'regime_gate.permitted_market_regime',
    kind: 'REGIME_GATE',
    description: 'Gate strategy activity to permitted market regimes.',
    params: Object.freeze([]),
  }),
});

export function catalogDefinitionFor(ref: string): CatalogNodeDefinition | undefined {
  return STRATEGY_GENOME_NODE_CATALOG[ref];
}

export function allCatalogRefs(): readonly string[] {
  return Object.freeze(Object.keys(STRATEGY_GENOME_NODE_CATALOG).sort());
}
