import { asUtcInstant } from '@solstice/domain';

import { attachGenomeHash } from '../os05/hash.ts';
import { asStrategyGenomeId, asStrategyGenomeVersion, STRATEGY_GENOME_SCHEMA } from '../os05/ids.ts';
import type { StrategyGenome } from '../os05/types.ts';
import {
  EARN11_GENOME_FEATURE_MANIFEST_VERSION,
  EARN11_GENOME_NODE_CATALOG_VERSION,
} from './catalog.ts';
import type { Earn11InputNodeKind, Earn11ResearchTemplateFamily } from './taxonomy.ts';

const TEMPLATE_NOW = asUtcInstant('2026-11-03T06:00:00.000Z');

export type Earn11TemplateSpec = {
  readonly family: Earn11ResearchTemplateFamily;
  readonly name: string;
  readonly hypothesis: string;
  readonly primaryInputs: readonly Earn11InputNodeKind[];
};

function earn11TemplateSpec(
  family: Earn11ResearchTemplateFamily,
  name: string,
  hypothesis: string,
  primaryInputs: readonly Earn11InputNodeKind[],
): Earn11TemplateSpec {
  return Object.freeze({ family, name, hypothesis, primaryInputs });
}

const earn11TemplateSpecs = {
    PRE_EARNINGS_EXPECTATION_DISLOCATION: earn11TemplateSpec(
      'PRE_EARNINGS_EXPECTATION_DISLOCATION',
      'Pre-earnings expectation dislocation',
      'Test whether pre-event estimate dispersion and revision velocity dislocate from implied move before announcement.',
      ['revision_breadth', 'revision_velocity', 'dispersion', 'options_implied_move', 'attention_state'],
    ),
    ANNOUNCEMENT_REACTION: earn11TemplateSpec(
      'ANNOUNCEMENT_REACTION',
      'Announcement reaction',
      'Test whether headline surprise tensor and options demand predict short-horizon post-print reaction under event twin fills.',
      ['earnings_surprise_tensor', 'options_directional_demand', 'options_implied_move', 'attention_state'],
    ),
    POST_EARNINGS_CONDITIONAL_DRIFT: earn11TemplateSpec(
      'POST_EARNINGS_CONDITIONAL_DRIFT',
      'Post-earnings conditional drift',
      'Test conditional drift conditioned on surprise sign, guidance revision, and macro regime — not unconditional momentum.',
      ['earnings_surprise_tensor', 'revision_velocity', 'macro_regime', 'dispersion'],
    ),
    ANALYST_REVISION_MOMENTUM: earn11TemplateSpec(
      'ANALYST_REVISION_MOMENTUM',
      'Analyst revision momentum',
      'Test post-print revision breadth/velocity momentum independent of same-day price chase.',
      ['revision_breadth', 'revision_velocity', 'dispersion', 'value_of_information'],
    ),
    GUIDANCE_REVISION: earn11TemplateSpec(
      'GUIDANCE_REVISION',
      'Guidance revision',
      'Test whether guidance revision tensor dominates headline beat for subsequent drift.',
      ['earnings_surprise_tensor', 'revision_velocity', 'earnings_quality'],
    ),
    TRANSCRIPT_EXPECTATION_GAP: earn11TemplateSpec(
      'TRANSCRIPT_EXPECTATION_GAP',
      'Transcript expectation gap',
      'Test transcript tone, tone dispersion, and Q&A answer quality gaps versus consensus after the call.',
      ['transcript_tone', 'tone_dispersion', 'future_past_focus', 'answer_quality', 'dispersion'],
    ),
    OPTIONS_EXPECTATION_DISLOCATION: earn11TemplateSpec(
      'OPTIONS_EXPECTATION_DISLOCATION',
      'Options expectation dislocation',
      'Test implied-vs-realized earnings move dislocation with directional demand skew.',
      ['options_implied_move', 'options_directional_demand', 'dispersion'],
    ),
    PEER_READ_THROUGH: earn11TemplateSpec(
      'PEER_READ_THROUGH',
      'Peer read-through',
      'Test peer cohort read-through shocks for non-reporting names in the same industry basket.',
      ['peer_read_through', 'earnings_surprise_tensor', 'attention_state'],
    ),
    EARNINGS_QUALITY_REVERSAL: earn11TemplateSpec(
      'EARNINGS_QUALITY_REVERSAL',
      'Earnings quality reversal',
      'Test whether earnings quality deterioration with headline beat predicts subsequent reversal under quality tensor.',
      ['earnings_quality', 'earnings_surprise_tensor', 'value_of_information'],
    ),
  } satisfies Record<Earn11ResearchTemplateFamily, Earn11TemplateSpec>;

export const EARN11_TEMPLATE_SPECS: Readonly<Record<Earn11ResearchTemplateFamily, Earn11TemplateSpec>> =
  Object.freeze(earn11TemplateSpecs);

function inputKindToCatalogRef(kind: Earn11InputNodeKind): string {
  switch (kind) {
    case 'earnings_surprise_tensor':
      return 'feature.earnings_surprise_tensor';
    case 'revision_breadth':
      return 'feature.earnings_revision_breadth';
    case 'revision_velocity':
      return 'feature.earnings_revision_velocity';
    case 'dispersion':
      return 'feature.earnings_estimate_dispersion';
    case 'value_of_information':
      return 'feature.earnings_value_of_information';
    case 'transcript_tone':
    case 'tone_dispersion':
    case 'future_past_focus':
    case 'answer_quality':
      return 'feature.transcript_tone';
    case 'earnings_quality':
      return 'feature.earnings_quality_score';
    case 'options_implied_move':
      return 'feature.options_implied_earnings_move';
    case 'options_directional_demand':
      return 'feature.options_directional_demand';
    case 'peer_read_through':
      return 'feature.peer_read_through';
    case 'attention_state':
      return 'feature.earnings_attention_state';
    case 'macro_regime':
      return 'feature.macro_regime_gate';
    default: {
      const _exhaustive: never = kind;
      return _exhaustive;
    }
  }
}

export function buildEarn11ResearchTemplateGenome(
  family: Earn11ResearchTemplateFamily,
  overrides: Partial<{ readonly genomeId: string; readonly version: string }> = {},
): StrategyGenome {
  const spec = EARN11_TEMPLATE_SPECS[family];
  const slug = family.toLowerCase();
  const featureNodes = spec.primaryInputs.map((inputKind, index) =>
    Object.freeze({
      nodeId: `feat_${index}_${inputKind}`,
      kind: 'FEATURE' as const,
      catalogRef: inputKindToCatalogRef(inputKind),
      outputRef: `${inputKind}_ref`,
      params: Object.freeze({
        inputKind,
        ...(inputKind === 'transcript_tone' || inputKind === 'tone_dispersion'
          ? { includeDispersion: inputKind === 'tone_dispersion' }
          : {}),
      }),
    }),
  );

  const primaryFeatureRef = featureNodes[0]?.outputRef ?? 'earnings_surprise_tensor_ref';

  return attachGenomeHash(
    Object.freeze({
      schema: STRATEGY_GENOME_SCHEMA,
      genomeId: asStrategyGenomeId(overrides.genomeId ?? `sgnm_helios_earn11_${slug}`),
      version: asStrategyGenomeVersion(overrides.version ?? 'v1'),
      name: spec.name,
      hypothesis: spec.hypothesis,
      parameters: Object.freeze({
        earn11TemplateFamily: family,
        researchOnly: true,
        grantsExecutionAuthority: false,
      }),
      nodes: Object.freeze([
        ...featureNodes,
        Object.freeze({
          nodeId: 'sig_hypothesis',
          kind: 'SIGNAL' as const,
          catalogRef: 'signal.earnings_template_hypothesis',
          inputRef: primaryFeatureRef,
          comparator: 'GT' as const,
          thresholdParam: 'minConfidenceBps',
          direction: 'LONG' as const,
          params: Object.freeze({ templateFamily: family, minConfidenceBps: 5_000 }),
        }),
        Object.freeze({
          nodeId: 'size_vt',
          kind: 'SIZING' as const,
          catalogRef: 'sizing.volatility_target_exposure',
          signalInputRef: 'sig_hypothesis',
          volFeatureRef: primaryFeatureRef,
          params: Object.freeze({ targetVolBps: 600, maxGrossExposureBps: 2_500 }),
        }),
        Object.freeze({
          nodeId: 'risk_var',
          kind: 'RISK' as const,
          catalogRef: 'risk.max_strategy_contribution_portfolio_var',
          sizingInputRef: 'size_vt',
          params: Object.freeze({ maxContributionVarBps: 120 }),
        }),
        Object.freeze({
          nodeId: 'exit_event',
          kind: 'EXIT' as const,
          catalogRef: 'exit.zscore_normalize_or_stop',
          signalInputRef: 'sig_hypothesis',
          params: Object.freeze({ normalizeZThreshold: 0, stopLossBps: 350 }),
        }),
        Object.freeze({
          nodeId: 'exec_event_twin',
          kind: 'EXECUTION' as const,
          catalogRef: 'execution.earnings_event_twin',
          params: Object.freeze({
            eventSimulationProfile: 'helios-earn11-earnings-event-v1',
            forbidCloseToCloseOnly: true,
            maxSlippageToleranceBps: 75,
          }),
        }),
        Object.freeze({
          nodeId: 'gate_window',
          kind: 'REGIME_GATE' as const,
          catalogRef: 'regime_gate.earnings_event_window',
          permittedRegimes: Object.freeze(['PRE_EARNINGS', 'EARNINGS_DAY', 'POST_EARNINGS']),
          prohibitedRegimes: Object.freeze(['LIQUIDITY_STRESS']),
          params: Object.freeze({}),
        }),
      ]),
      lineage: Object.freeze({
        parentGenomeIds: Object.freeze([]),
        mutationReason: `EARN11 research template ${family}`,
        createdBy: 'helios_earn11_research_lab',
        createdAt: TEMPLATE_NOW,
        featureManifestVersion: EARN11_GENOME_FEATURE_MANIFEST_VERSION,
        nodeCatalogVersion: EARN11_GENOME_NODE_CATALOG_VERSION,
        operator: null,
        operatorVersion: null,
        randomSeed: null,
      }),
    }),
  );
}

export function allEarn11ResearchTemplateGenomes(): readonly StrategyGenome[] {
  return Object.freeze(
    (Object.keys(EARN11_TEMPLATE_SPECS) as Earn11ResearchTemplateFamily[]).map((family) =>
      buildEarn11ResearchTemplateGenome(family),
    ),
  );
}
