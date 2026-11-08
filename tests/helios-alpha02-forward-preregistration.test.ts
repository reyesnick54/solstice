/**
 * HELIOS Forward Alpha ALPHA02 — pre-registration and campaign freeze qualification.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { asUtcInstant } from '../packages/domain/src/time.ts';
import {
  HELIOS_ALPHA02_PREREGISTRATION_QUALIFIED,
  assertCampaignConfigurationImmutable,
  buildAlpha02PreregistrationEvidence,
  buildSampleFrozenAdaptationPolicy,
  buildSampleFrozenBenchmarkPolicy,
  buildSampleFrozenCostPolicy,
  buildSampleFrozenHypothesis,
  buildSampleFrozenSizingPolicy,
  buildSampleFrozenStrategyManifest,
  computeCampaignFingerprint,
  recordAdaptationEvent,
  rejectHindsightConfigurationPatch,
  sampleCampaignId,
  sealForwardCampaignRegistration,
  startForwardCampaign,
  supersedeCampaignForStrategyRevision,
} from '../packages/platform/src/helios/forward-alpha/alpha02/index.ts';
import { lintHeliosBoundary } from '../tools/architectural-linter/src/helios-guards.ts';

const SEALED_AT = asUtcInstant('2026-11-08T07:00:00.000Z');
const STARTED_AT = asUtcInstant('2026-11-08T08:00:00.000Z');

const EXAMPLE_GENOME_ID = 'sgnm_helios_os05_mean_reversion_example';
const EXAMPLE_GENOME_VERSION = 'v1';
const EXAMPLE_FEATURE_MANIFEST_VERSION = 'helios.strategy-genome.feature-manifest.v1';
const EXAMPLE_GENOME_DIGEST_V1 =
  'a3f2c8e1b9047d6e5f4a2b1c0d9e8f7a6b5c4d3e2f1a0b9c8d7e6f5a4b3c2d1';
const EXAMPLE_HYPOTHESIS =
  'Short-horizon mean reversion when realized volatility is below threshold and z-score dislocation exceeds entry band.';

function sealExampleCampaign(campaignIdSuffix: string, strategyVersion: string, genomeDigest: string) {
  const manifest = buildSampleFrozenStrategyManifest({
    genomeId: EXAMPLE_GENOME_ID,
    genomeVersion: EXAMPLE_GENOME_VERSION,
    genomeContentDigest: genomeDigest,
    strategyVersion,
    featureManifestVersion: EXAMPLE_FEATURE_MANIFEST_VERSION,
    instrumentUniverse: ['CRYPTO:BTC:bitcoin:native:USD'],
    entryContent: { entryZScore: -2 },
    exitContent: { normalizeZThreshold: -0.5, stopLossBps: 200 },
    sizingContent: { targetVolBps: 800 },
    riskContent: { maxContributionVarBps: 150 },
    regimeContent: { permittedRegimes: ['NORMAL_VOL'] },
    executionContent: { preferredOrderType: 'LIMIT_PASSIVE' },
    modelVersions: ['model.helios.fixture.v1'],
  });

  return sealForwardCampaignRegistration({
    campaignId: sampleCampaignId(campaignIdSuffix),
    strategyId: 'strat_helios_os05_example',
    manifest,
    hypothesis: buildSampleFrozenHypothesis(EXAMPLE_HYPOTHESIS),
    benchmarkPolicy: buildSampleFrozenBenchmarkPolicy(),
    costPolicy: buildSampleFrozenCostPolicy(),
    sizingPolicy: buildSampleFrozenSizingPolicy(),
    adaptationPolicy: buildSampleFrozenAdaptationPolicy(true),
    sealedAt: SEALED_AT,
  });
}

describe('HELIOS Forward Alpha ALPHA02 pre-registration', () => {
  it('seals campaignFingerprint over full frozen configuration', () => {
    const sealed = sealExampleCampaign('fingerprint', 'v1', EXAMPLE_GENOME_DIGEST_V1);
    const recomputed = computeCampaignFingerprint({
      manifest: sealed.manifest,
      hypothesis: sealed.hypothesis,
      benchmarkPolicy: sealed.benchmarkPolicy,
      costPolicy: sealed.costPolicy,
      sizingPolicy: sealed.sizingPolicy,
      adaptationPolicy: sealed.adaptationPolicy,
    });
    assert.equal(sealed.campaignFingerprint, recomputed);
    assert.equal(sealed.lifecycle.state, 'SEALED');
    assert.equal(sealed.grantsExecutionAuthority, false);
  });

  it('keeps configuration immutable after start and stores only predeclared adaptations', () => {
    const sealed = sealExampleCampaign('active', 'v1', EXAMPLE_GENOME_DIGEST_V1);
    const active = startForwardCampaign(sealed, STARTED_AT);
    assert.equal(active.lifecycle.state, 'ACTIVE');

    assert.throws(
      () =>
        rejectHindsightConfigurationPatch(active, 'entryZScore', {
          entryZScore: -1.5,
        }),
      /hindsight configuration patch forbidden/,
    );

    const adapted = recordAdaptationEvent(active, {
      eventId: 'adapt_1',
      recordedAt: asUtcInstant('2026-11-08T09:00:00.000Z'),
      ruleId: 'rule_online_vol_target_recalibration',
      parameterPath: 'parameters.targetVolBps',
      priorValue: 800,
      newValue: 820,
      triggerMaterial: { realizedVolBps: 750 },
    });
    assert.equal(adapted.ok, true);
    if (!adapted.ok) {
      return;
    }
    assert.equal(adapted.value.adaptationEvents.length, 1);
    assertCampaignConfigurationImmutable(adapted.value);

    const manual = recordAdaptationEvent(adapted.value, {
      eventId: 'adapt_manual',
      recordedAt: asUtcInstant('2026-11-08T10:00:00.000Z'),
      ruleId: 'researcher_manual_threshold',
      parameterPath: 'parameters.entryZScore',
      priorValue: -2,
      newValue: -1,
      triggerMaterial: { reason: 'last week was poor' },
    });
    assert.equal(manual.ok, false);
    if (manual.ok) {
      return;
    }
    assert.equal(manual.error.code, 'RULE_NOT_PREDECLARED');
  });

  it('requires new campaign and strategy version when genome changes', () => {
    const prior = startForwardCampaign(
      sealExampleCampaign('prior', 'v1', EXAMPLE_GENOME_DIGEST_V1),
      STARTED_AT,
    );

    const genomeV2Digest = `${EXAMPLE_GENOME_DIGEST_V1}_rev2`;
    const successorSealed = sealExampleCampaign('successor', 'v2', genomeV2Digest);
    const { prior: superseded, successor } = supersedeCampaignForStrategyRevision({
      prior,
      successor: successorSealed,
      supersededAt: asUtcInstant('2026-11-09T00:00:00.000Z'),
    });

    assert.equal(superseded.lifecycle.state, 'SUPERSEDED');
    assert.equal(superseded.supersededByCampaignId, successor.campaignId);
    assert.equal(successor.predecessorCampaignId, prior.campaignId);
    assert.notEqual(superseded.campaignFingerprint, successor.campaignFingerprint);
  });

  it('emits HELIOS_ALPHA02_PREREGISTRATION_QUALIFIED for a sealed active campaign', () => {
    const active = startForwardCampaign(
      sealExampleCampaign('qualify', 'v1', EXAMPLE_GENOME_DIGEST_V1),
      STARTED_AT,
    );
    const evidence = buildAlpha02PreregistrationEvidence(active);
    assert.equal(evidence.qualificationMarker, HELIOS_ALPHA02_PREREGISTRATION_QUALIFIED);
    assert.equal(evidence.blockers.length, 0);
  });

  it('passes HELIOS boundary lint', () => {
    const findings = lintHeliosBoundary(process.cwd());
    assert.deepEqual(findings, []);
  });
});
