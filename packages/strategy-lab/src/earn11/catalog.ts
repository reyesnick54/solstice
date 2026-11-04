/**
 * EARN11 Strategy Genome node catalog — extends OS05 with earnings-intelligence refs.
 */

import {
  STRATEGY_GENOME_NODE_CATALOG,
  catalogDefinitionFor as os05CatalogDefinitionFor,
  type CatalogNodeDefinition,
} from '../os05/catalog.ts';

export const EARN11_GENOME_NODE_CATALOG_VERSION = 'helios-earn11-node-catalog-v1' as const;
export const EARN11_GENOME_FEATURE_MANIFEST_VERSION = 'helios-earn11-feature-manifest-v1' as const;

export const EARN11_GENOME_NODE_CATALOG = Object.freeze({
  'feature.earnings_surprise_tensor': Object.freeze({
    catalogRef: 'feature.earnings_surprise_tensor',
    kind: 'FEATURE',
    description: 'Point-in-time earnings surprise tensor (headline / guidance / quality slots).',
    params: Object.freeze([
      { key: 'inputKind', valueType: 'string', required: true },
      { key: 'lookbackQuarters', valueType: 'number', required: false },
    ]),
  }),
  'feature.earnings_revision_breadth': Object.freeze({
    catalogRef: 'feature.earnings_revision_breadth',
    kind: 'FEATURE',
    description: 'Analyst revision breadth ahead of or after an earnings event.',
    params: Object.freeze([{ key: 'inputKind', valueType: 'string', required: true }]),
  }),
  'feature.earnings_revision_velocity': Object.freeze({
    catalogRef: 'feature.earnings_revision_velocity',
    kind: 'FEATURE',
    description: 'Revision velocity and acceleration in the pre/post earnings window.',
    params: Object.freeze([{ key: 'inputKind', valueType: 'string', required: true }]),
  }),
  'feature.earnings_estimate_dispersion': Object.freeze({
    catalogRef: 'feature.earnings_estimate_dispersion',
    kind: 'FEATURE',
    description: 'Consensus dispersion and disagreement tensor.',
    params: Object.freeze([{ key: 'inputKind', valueType: 'string', required: true }]),
  }),
  'feature.earnings_value_of_information': Object.freeze({
    catalogRef: 'feature.earnings_value_of_information',
    kind: 'FEATURE',
    description: 'Research value-of-information summary for earnings features.',
    params: Object.freeze([{ key: 'inputKind', valueType: 'string', required: true }]),
  }),
  'feature.transcript_tone': Object.freeze({
    catalogRef: 'feature.transcript_tone',
    kind: 'FEATURE',
    description: 'Transcript tone and tone dispersion (PIT, entitlement-gated).',
    params: Object.freeze([
      { key: 'inputKind', valueType: 'string', required: true },
      { key: 'includeDispersion', valueType: 'boolean', required: false },
    ]),
  }),
  'feature.earnings_quality_score': Object.freeze({
    catalogRef: 'feature.earnings_quality_score',
    kind: 'FEATURE',
    description: 'Earnings quality composite (accruals, cash conversion, headline divergence).',
    params: Object.freeze([{ key: 'inputKind', valueType: 'string', required: true }]),
  }),
  'feature.options_implied_earnings_move': Object.freeze({
    catalogRef: 'feature.options_implied_earnings_move',
    kind: 'FEATURE',
    description: 'Options-implied move versus historical realized earnings move.',
    params: Object.freeze([{ key: 'inputKind', valueType: 'string', required: true }]),
  }),
  'feature.options_directional_demand': Object.freeze({
    catalogRef: 'feature.options_directional_demand',
    kind: 'FEATURE',
    description: 'Directional options demand skew into earnings.',
    params: Object.freeze([{ key: 'inputKind', valueType: 'string', required: true }]),
  }),
  'feature.peer_read_through': Object.freeze({
    catalogRef: 'feature.peer_read_through',
    kind: 'FEATURE',
    description: 'Peer cohort read-through shock tensor.',
    params: Object.freeze([{ key: 'inputKind', valueType: 'string', required: true }]),
  }),
  'feature.earnings_attention_state': Object.freeze({
    catalogRef: 'feature.earnings_attention_state',
    kind: 'FEATURE',
    description: 'Attention / positioning state into earnings.',
    params: Object.freeze([{ key: 'inputKind', valueType: 'string', required: true }]),
  }),
  'feature.macro_regime_gate': Object.freeze({
    catalogRef: 'feature.macro_regime_gate',
    kind: 'FEATURE',
    description: 'Macro regime context for earnings event research.',
    params: Object.freeze([{ key: 'inputKind', valueType: 'string', required: true }]),
  }),
  'signal.earnings_template_hypothesis': Object.freeze({
    catalogRef: 'signal.earnings_template_hypothesis',
    kind: 'SIGNAL',
    description: 'Declarative hypothesis signal for an EARN11 research template family.',
    params: Object.freeze([
      { key: 'templateFamily', valueType: 'string', required: true },
      { key: 'minConfidenceBps', valueType: 'number', required: true },
    ]),
  }),
  'execution.earnings_event_twin': Object.freeze({
    catalogRef: 'execution.earnings_event_twin',
    kind: 'EXECUTION',
    description: 'Execution twin profile for earnings gaps, spread widening, and auction windows.',
    params: Object.freeze([
      { key: 'eventSimulationProfile', valueType: 'string', required: true },
      { key: 'forbidCloseToCloseOnly', valueType: 'boolean', required: true },
      { key: 'maxSlippageToleranceBps', valueType: 'number', required: false },
    ]),
  }),
  'regime_gate.earnings_event_window': Object.freeze({
    catalogRef: 'regime_gate.earnings_event_window',
    kind: 'REGIME_GATE',
    description: 'Permit research only in configured pre/announce/post earnings windows.',
    params: Object.freeze([]),
  }),
}) as Readonly<Record<string, CatalogNodeDefinition>>;

export function catalogDefinitionForEarn11(ref: string): CatalogNodeDefinition | undefined {
  return EARN11_GENOME_NODE_CATALOG[ref] ?? os05CatalogDefinitionFor(ref);
}

export function allEarn11CatalogRefs(): readonly string[] {
  return Object.freeze(
    [...Object.keys(STRATEGY_GENOME_NODE_CATALOG), ...Object.keys(EARN11_GENOME_NODE_CATALOG)].sort(),
  );
}
