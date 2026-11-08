/**
 * HELIOS Forward Alpha ALPHA02 — pre-registration seal and campaign lifecycle.
 */

import type { UtcInstant } from '@solstice/domain';

import { computeCampaignFingerprint, digestRuleContent } from './fingerprint.ts';
import { HELIOS_FORWARD_ALPHA_ALPHA02_SCHEMA } from './taxonomy.ts';
import type {
  ForwardCampaignId,
  ForwardCampaignRegistration,
  FrozenAdaptationPolicy,
  FrozenBenchmarkPolicy,
  FrozenCostPolicy,
  FrozenHypothesis,
  FrozenSizingPolicy,
  FrozenStrategyManifest,
} from './types.ts';

export function asForwardCampaignId(value: string): ForwardCampaignId {
  if (!value.trim()) {
    throw new Error('ForwardCampaignId must be non-empty');
  }
  return value as ForwardCampaignId;
}

export type SealForwardCampaignInput = {
  readonly campaignId: ForwardCampaignId;
  readonly strategyId: string;
  readonly manifest: FrozenStrategyManifest;
  readonly hypothesis: FrozenHypothesis;
  readonly benchmarkPolicy: FrozenBenchmarkPolicy;
  readonly costPolicy: FrozenCostPolicy;
  readonly sizingPolicy: FrozenSizingPolicy;
  readonly adaptationPolicy: FrozenAdaptationPolicy;
  readonly sealedAt: UtcInstant;
  readonly predecessorCampaignId?: ForwardCampaignId | null;
};

function assertFrozenPolicySchemas(input: SealForwardCampaignInput): void {
  const expected = HELIOS_FORWARD_ALPHA_ALPHA02_SCHEMA;
  const rows: { readonly label: string; readonly schema: string }[] = [
    { label: 'manifest', schema: input.manifest.schema },
    { label: 'hypothesis', schema: input.hypothesis.schema },
    { label: 'benchmarkPolicy', schema: input.benchmarkPolicy.schema },
    { label: 'costPolicy', schema: input.costPolicy.schema },
    { label: 'sizingPolicy', schema: input.sizingPolicy.schema },
    { label: 'adaptationPolicy', schema: input.adaptationPolicy.schema },
  ];
  for (const row of rows) {
    if (row.schema !== expected) {
      throw new Error(`ALPHA02 ${row.label} schema mismatch`);
    }
  }
}

/**
 * Seal all forward-test rules before campaign start. After this, `campaignFingerprint` is immutable.
 */
export function sealForwardCampaignRegistration(input: SealForwardCampaignInput): ForwardCampaignRegistration {
  assertFrozenPolicySchemas(input);
  if (input.manifest.strategyVersion.trim().length === 0) {
    throw new Error('ALPHA02 manifest.strategyVersion required');
  }
  if (input.adaptationPolicy.manualOverrideForbidden !== true) {
    throw new Error('ALPHA02 adaptationPolicy.manualOverrideForbidden must remain true');
  }

  const campaignFingerprint = computeCampaignFingerprint({
    manifest: input.manifest,
    hypothesis: input.hypothesis,
    benchmarkPolicy: input.benchmarkPolicy,
    costPolicy: input.costPolicy,
    sizingPolicy: input.sizingPolicy,
    adaptationPolicy: input.adaptationPolicy,
  });

  return Object.freeze({
    schema: HELIOS_FORWARD_ALPHA_ALPHA02_SCHEMA,
    campaignId: input.campaignId,
    strategyId: input.strategyId,
    manifest: input.manifest,
    hypothesis: input.hypothesis,
    benchmarkPolicy: input.benchmarkPolicy,
    costPolicy: input.costPolicy,
    sizingPolicy: input.sizingPolicy,
    adaptationPolicy: input.adaptationPolicy,
    campaignFingerprint,
    lifecycle: Object.freeze({
      state: 'SEALED',
      sealedAt: input.sealedAt,
      startedAt: null,
      supersededAt: null,
      completedAt: null,
    }),
    adaptationEvents: Object.freeze([]),
    supersededByCampaignId: null,
    predecessorCampaignId: input.predecessorCampaignId ?? null,
    simulationOnly: true,
    grantsExecutionAuthority: false,
  });
}

/**
 * Transition to ACTIVE forward observation. Configuration body must not change after this call.
 */
export function startForwardCampaign(
  registration: ForwardCampaignRegistration,
  startedAt: UtcInstant,
): ForwardCampaignRegistration {
  if (registration.lifecycle.state !== 'SEALED') {
    throw new Error('ALPHA02 campaign can only start from SEALED state');
  }
  return Object.freeze({
    ...registration,
    lifecycle: Object.freeze({
      ...registration.lifecycle,
      state: 'ACTIVE',
      startedAt,
    }),
  });
}

/**
 * Strategy logic change requires a new strategy version and new campaign; original campaign preserved.
 */
export function supersedeCampaignForStrategyRevision(input: {
  readonly prior: ForwardCampaignRegistration;
  readonly successor: ForwardCampaignRegistration;
  readonly supersededAt: UtcInstant;
}): { readonly prior: ForwardCampaignRegistration; readonly successor: ForwardCampaignRegistration } {
  if (input.prior.lifecycle.state === 'SUPERSEDED') {
    throw new Error('ALPHA02 prior campaign already superseded');
  }
  if (input.prior.campaignId === input.successor.campaignId) {
    throw new Error('ALPHA02 successor campaign must use a new campaignId');
  }
  if (input.prior.strategyId !== input.successor.strategyId) {
    throw new Error('ALPHA02 successor must preserve strategyId lineage');
  }
  if (input.prior.manifest.strategyVersion === input.successor.manifest.strategyVersion) {
    throw new Error('ALPHA02 strategy revision requires a new manifest.strategyVersion');
  }
  if (input.prior.manifest.strategyGenome.genomeContentDigest === input.successor.manifest.strategyGenome.genomeContentDigest) {
    throw new Error('ALPHA02 strategy revision requires a new strategy genome digest');
  }

  const prior = Object.freeze({
    ...input.prior,
    lifecycle: Object.freeze({
      ...input.prior.lifecycle,
      state: 'SUPERSEDED' as const,
      supersededAt: input.supersededAt,
    }),
    supersededByCampaignId: input.successor.campaignId,
  });

  const successor = Object.freeze({
    ...input.successor,
    predecessorCampaignId: input.prior.campaignId,
  });

  return Object.freeze({ prior, successor });
}

/** Helper for callers building rule-bundle digests from declarative content. */
export function frozenRuleBundleFromContent(catalogRef: string, content: unknown) {
  return Object.freeze({
    catalogRef,
    contentDigest: digestRuleContent(content),
  });
}
