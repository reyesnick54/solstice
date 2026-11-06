import { asUtcInstant } from '@solstice/domain';
import {
  STRATEGY_GENOME_FEATURE_MANIFEST_VERSION,
  STRATEGY_GENOME_NODE_CATALOG_VERSION,
} from './catalog.ts';
import { attachGenomeHash } from './hash.ts';
import { asStrategyGenomeId, asStrategyGenomeVersion, STRATEGY_GENOME_SCHEMA } from './ids.ts';
import type { StrategyGenome } from './types.ts';

const EXAMPLE_NOW = asUtcInstant('2026-11-03T06:00:00.000Z');

/** Example genome matching OS05 specification (mean reversion with vol targeting). */
export function buildOs05ExampleStrategyGenome(): StrategyGenome {
  return attachGenomeHash(
    Object.freeze({
      schema: STRATEGY_GENOME_SCHEMA,
      genomeId: asStrategyGenomeId('sgnm_helios_os05_mean_reversion_example'),
      version: asStrategyGenomeVersion('v1'),
      name: 'OS05 Example Mean Reversion Genome',
      hypothesis:
        'Short-horizon mean reversion when realized volatility is below threshold and z-score dislocation exceeds entry band.',
      nodes: Object.freeze([
        Object.freeze({
          nodeId: 'feat_rv20',
          kind: 'FEATURE' as const,
          catalogRef: 'feature.realized_volatility',
          outputRef: 'realized_volatility_20d',
          params: Object.freeze({ lookbackDays: 20, annualizationFactor: 252 }),
        }),
        Object.freeze({
          nodeId: 'cond_vol',
          kind: 'CONDITION' as const,
          catalogRef: 'condition.threshold_compare',
          inputRef: 'realized_volatility_20d',
          comparator: 'LT' as const,
          thresholdParam: 'volatilityThresholdBps',
          params: Object.freeze({}),
        }),
        Object.freeze({
          nodeId: 'sig_mr',
          kind: 'SIGNAL' as const,
          catalogRef: 'signal.mean_reversion_zscore',
          inputRef: 'realized_volatility_20d',
          comparator: 'LT' as const,
          thresholdParam: 'entryZScore',
          direction: 'LONG' as const,
          params: Object.freeze({ referenceWindowBars: 20, volNormalize: true }),
        }),
        Object.freeze({
          nodeId: 'size_vt',
          kind: 'SIZING' as const,
          catalogRef: 'sizing.volatility_target_exposure',
          signalInputRef: 'sig_mr',
          volFeatureRef: 'realized_volatility_20d',
          params: Object.freeze({ targetVolBps: 800, maxGrossExposureBps: 4_000 }),
        }),
        Object.freeze({
          nodeId: 'risk_var',
          kind: 'RISK' as const,
          catalogRef: 'risk.max_strategy_contribution_portfolio_var',
          sizingInputRef: 'size_vt',
          params: Object.freeze({ maxContributionVarBps: 150 }),
        }),
        Object.freeze({
          nodeId: 'exit_norm',
          kind: 'EXIT' as const,
          catalogRef: 'exit.zscore_normalize_or_stop',
          signalInputRef: 'sig_mr',
          params: Object.freeze({ normalizeZThreshold: -0.5, stopLossBps: 200 }),
        }),
        Object.freeze({
          nodeId: 'exec_passive',
          kind: 'EXECUTION' as const,
          catalogRef: 'execution.passive_limit_preferred',
          params: Object.freeze({ preferredOrderType: 'LIMIT_PASSIVE', maxSlippageToleranceBps: 10 }),
        }),
        Object.freeze({
          nodeId: 'flow_feat_cond',
          kind: 'FLOW' as const,
          fromNodeId: 'feat_rv20',
          toNodeId: 'cond_vol',
          port: 'feature_out',
        }),
        Object.freeze({
          nodeId: 'flow_cond_sig',
          kind: 'FLOW' as const,
          fromNodeId: 'cond_vol',
          toNodeId: 'sig_mr',
          port: 'gate_pass',
        }),
        Object.freeze({
          nodeId: 'flow_sig_size',
          kind: 'FLOW' as const,
          fromNodeId: 'sig_mr',
          toNodeId: 'size_vt',
        }),
        Object.freeze({
          nodeId: 'flow_size_risk',
          kind: 'FLOW' as const,
          fromNodeId: 'size_vt',
          toNodeId: 'risk_var',
        }),
      ]),
      parameters: Object.freeze({
        volatilityThresholdBps: 2_000,
        entryZScore: -2,
      }),
      lineage: Object.freeze({
        parentGenomeIds: Object.freeze([]),
        mutationReason: null,
        createdBy: 'helios_os05_fixture',
        createdAt: EXAMPLE_NOW,
        featureManifestVersion: STRATEGY_GENOME_FEATURE_MANIFEST_VERSION,
        nodeCatalogVersion: STRATEGY_GENOME_NODE_CATALOG_VERSION,
        operator: null,
        operatorVersion: null,
        randomSeed: null,
      }),
    }),
  );
}
