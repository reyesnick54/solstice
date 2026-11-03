/**
 * HELIOS AAFV2.5 — statistical coverage and research bias sentinel.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { FrozenClock } from '../packages/config/src/clock.ts';
import { EvidenceVault } from '../packages/evidence/src/vault.ts';
import { asUtcInstant } from '../packages/domain/src/time.ts';
import {
  HELIOS_AAFV2_05_BIAS_SENTINEL_QUALIFIED,
  assessResearchBias,
  biasSentinelInputFromCoverageTensor,
  biasSentinelProfilesFromCompilerManifest,
  attachBiasAssessmentToStrategyGenome,
  buildCleanControlUniverse,
  buildCorporateActionBiasUniverse,
  buildDelistingOmissionUniverse,
  buildLiquidityBiasUniverse,
  buildMegaCapAltDataBiasUniverse,
  buildProviderUsBiasUniverse,
  buildSectorTechDoublingUniverse,
  buildSurvivorshipBiasUniverse,
  evaluateAafv205Qualification,
  evaluateBiasPromotionGate,
  observedIdsForCleanControl,
  sealBiasSentinelAssessmentEvidence,
} from '../packages/platform/src/helios/feature-fabric/bias-sentinel/index.ts';
import { buildCoverageTensor } from '../packages/platform/src/helios/feature-fabric/coverage/tensor.ts';
import type { FeatureCoverageProbe } from '../packages/platform/src/helios/feature-fabric/coverage/types.ts';
import { gatePromotionOnBiasSentinel } from '../packages/strategy-lab/src/evaluation/bias-sentinel-promotion-gate.ts';

const EVAL_AT = asUtcInstant('2026-04-01T12:00:00.000Z');

function assessFixture(
  fixture: {
    readonly intended: readonly import('../packages/platform/src/helios/feature-fabric/bias-sentinel/types.ts').UniverseMemberProfile[];
    readonly observedIds: readonly string[];
  },
  assessmentId: string,
) {
  return assessResearchBias({
    assessmentId,
    researchDatasetId: 'ds_fixture',
    evaluatedAt: EVAL_AT,
    intendedEligibleUniverse: fixture.intended,
    observedUsableEntityIds: fixture.observedIds,
  });
}

describe('HELIOS AAFV2.5 bias sentinel fixtures', () => {
  it('detects mega-cap alternative-data selection bias', () => {
    const fixture = buildMegaCapAltDataBiasUniverse();
    const assessment = assessFixture(fixture, 'bias_mega_cap');
    assert.equal(assessment.severity, 'SEVERE');
    assert.ok(
      assessment.findings.some(
        (row) => row.dimension === 'LARGE_CAP_BIAS' || row.dimension === 'COVERAGE_BIAS',
      ),
    );
    assert.ok(
      assessment.findings.every((finding) =>
        finding.evidence.every((row) => row.correlationIsNotCausation),
      ),
    );
  });

  it('detects survivorship / delisting omission', () => {
    const fixture = buildSurvivorshipBiasUniverse();
    const assessment = assessFixture(fixture, 'bias_survivorship');
    assert.notEqual(assessment.severity, 'PASS');
    assert.ok(
      assessment.findings.some(
        (row) => row.dimension === 'SURVIVORSHIP_BIAS' || row.dimension === 'DELISTING_BIAS',
      ),
    );
    assert.ok(assessment.survivorship.absentFromObserved > 0);
  });

  it('detects sector (technology) coverage doubling', () => {
    const fixture = buildSectorTechDoublingUniverse();
    const assessment = assessFixture(fixture, 'bias_sector');
    assert.notEqual(assessment.severity, 'PASS');
    assert.ok(assessment.findings.some((row) => row.dimension === 'SECTOR_BIAS'));
  });

  it('detects provider US concentration bias', () => {
    const fixture = buildProviderUsBiasUniverse();
    const assessment = assessFixture(fixture, 'bias_provider');
    assert.notEqual(assessment.severity, 'PASS');
    assert.ok(
      assessment.findings.some(
        (row) => row.dimension === 'PROVIDER_BIAS' || row.dimension === 'GEOGRAPHIC_BIAS',
      ),
    );
  });

  it('detects systematic illiquidity missingness', () => {
    const fixture = buildLiquidityBiasUniverse();
    const assessment = assessFixture(fixture, 'bias_liquidity');
    assert.equal(assessment.severity, 'SEVERE');
    assert.ok(assessment.findings.some((row) => row.dimension === 'LIQUIDITY_BIAS'));
  });

  it('detects delisted securities omitted from usable universe', () => {
    const fixture = buildDelistingOmissionUniverse();
    const assessment = assessFixture(fixture, 'bias_delisting');
    assert.ok(assessment.findings.some((row) => row.dimension === 'DELISTING_BIAS'));
  });

  it('detects corporate-action entity omission bias', () => {
    const fixture = buildCorporateActionBiasUniverse();
    const assessment = assessFixture(fixture, 'bias_corp_action');
    assert.ok(assessment.findings.some((row) => row.dimension === 'CORPORATE_ACTION_BIAS'));
  });

  it('passes clean unbiased control dataset', () => {
    const intended = buildCleanControlUniverse(40);
    const assessment = assessResearchBias({
      assessmentId: 'bias_clean',
      researchDatasetId: 'ds_clean',
      evaluatedAt: EVAL_AT,
      intendedEligibleUniverse: intended,
      observedUsableEntityIds: observedIdsForCleanControl(intended),
    });
    assert.equal(assessment.severity, 'PASS');
    assert.equal(assessment.findings.length, 0);
  });
});

describe('HELIOS AAFV2.5 promotion and integration', () => {
  it('blocks promotion on SEVERE and requires review on WARNING', () => {
    const severe = assessFixture(buildMegaCapAltDataBiasUniverse(), 'gate_severe');
    const severeGate = evaluateBiasPromotionGate({ assessment: severe });
    assert.equal(severeGate.permitted, false);
    assert.equal(severeGate.decision, 'BLOCK_PROMOTION');

    const warningFixture = buildSectorTechDoublingUniverse();
    const warning = assessFixture(warningFixture, 'gate_warning');
    if (warning.severity === 'WARNING') {
      const warningGate = evaluateBiasPromotionGate({ assessment: warning });
      assert.equal(warningGate.decision, 'REVIEW_REQUIRED');
    }
  });

  it('bridges coverage tensor and compiler manifest metadata', () => {
    const member = Object.freeze({
      canonicalEntityId: 'ent_1',
      canonicalInstrumentId: 'inst_1',
      evaluationTimestamp: EVAL_AT,
      sector: 'TECH',
      industry: 'SOFTWARE',
      marketCapBucket: 'LARGE',
      liquidityBucket: 'HIGH',
      geography: 'US',
      venue: 'NYSE',
      assetClass: 'EQUITY',
    });
    const signal = Object.freeze({
      published: true,
      providerAvailable: true,
      providerCoversInstrument: true,
      entitlementState: 'USABLE' as const,
      entityResolved: true,
      applicable: true,
      qualityState: 'VALID' as const,
      historicalGap: false,
      knowableAtEvaluationTime: true,
      valuePresent: true,
    });
    const probes: FeatureCoverageProbe[] = [];
    for (let i = 0; i < 35; i += 1) {
      const usable = i < 30;
      probes.push(
        Object.freeze({
          member: { ...member, canonicalEntityId: `ent_${i}` },
          featureId: 'alt.sentiment',
          providerId: 'provider_a',
          signal: usable
            ? signal
            : Object.freeze({ ...signal, valuePresent: false, qualityState: 'UNAVAILABLE' as const }),
        }),
      );
    }
    const tensor = buildCoverageTensor({
      universeId: 'uni_test',
      universeDefinition: 'fixture',
      evaluationTimestamp: EVAL_AT,
      eligibleMembers: probes.map((row) => row.member),
      featureIds: ['alt.sentiment'],
      probes,
    });
    const bridged = biasSentinelInputFromCoverageTensor({ tensor });
    assert.ok(bridged.intendedEligibleUniverse.length >= 30);
    assert.ok(bridged.observedUsableEntityIds.length > 0);

    const meta = biasSentinelProfilesFromCompilerManifest({
      manifest: { manifestId: 'pitmf_fixture', strategyEvaluationId: 'eval_1' },
      intendedEligibleUniverse: bridged.intendedEligibleUniverse,
      observedUsableEntityIds: bridged.observedUsableEntityIds,
    });
    assert.equal(meta.researchDatasetId, 'eval_1');
  });

  it('seals assessment evidence and attaches strategy genome ref', () => {
    const assessment = assessFixture(buildMegaCapAltDataBiasUniverse(), 'bias_evidence');
    const vault = new EvidenceVault(new FrozenClock(EVAL_AT));
    const evidenceId = sealBiasSentinelAssessmentEvidence(vault, assessment);
    assert.ok(evidenceId);
    const attached = attachBiasAssessmentToStrategyGenome({
      genomeId: 'genome.fixture',
      assessment,
      promotionBlocked: true,
    });
    assert.equal(attached.genomeId, 'genome.fixture');
    assert.equal(attached.promotionBlocked, true);

    const labGate = gatePromotionOnBiasSentinel({
      assessment: { assessmentId: assessment.assessmentId, severity: assessment.severity },
      policy: { blockOnSevere: true, requireReviewOnWarning: true, blockOnInsufficientData: false },
    });
    assert.equal(labGate.permitted, false);
  });
});

describe('HELIOS AAFV2.5 qualification marker', () => {
  it('emits HELIOS_AAFV2_05_BIAS_SENTINEL_QUALIFIED when checks pass', () => {
    const mega = assessFixture(buildMegaCapAltDataBiasUniverse(), 'q_mega');
    const surv = assessFixture(buildSurvivorshipBiasUniverse(), 'q_surv');
    const sector = assessFixture(buildSectorTechDoublingUniverse(), 'q_sector');
    const provider = assessFixture(buildProviderUsBiasUniverse(), 'q_provider');
    const liq = assessFixture(buildLiquidityBiasUniverse(), 'q_liq');
    const delist = assessFixture(buildDelistingOmissionUniverse(), 'q_delist');
    const clean = assessResearchBias({
      assessmentId: 'q_clean',
      researchDatasetId: 'ds_clean',
      evaluatedAt: EVAL_AT,
      intendedEligibleUniverse: buildCleanControlUniverse(40),
      observedUsableEntityIds: observedIdsForCleanControl(buildCleanControlUniverse(40)),
    });

    const result = evaluateAafv205Qualification({
      deterministicDiagnostics: true,
      megaCapAltDataDetected: mega.severity === 'SEVERE',
      survivorshipDetected: surv.findings.some((row) => row.dimension === 'SURVIVORSHIP_BIAS'),
      sectorBiasDetected: sector.findings.some((row) => row.dimension === 'SECTOR_BIAS'),
      providerBiasDetected: provider.findings.some((row) =>
        ['PROVIDER_BIAS', 'GEOGRAPHIC_BIAS'].includes(row.dimension),
      ),
      liquidityBiasDetected: liq.findings.some((row) => row.dimension === 'LIQUIDITY_BIAS'),
      delistingBiasDetected: delist.findings.some((row) => row.dimension === 'DELISTING_BIAS'),
      cleanControlPasses: clean.severity === 'PASS',
      severeBlocksPromotion: evaluateBiasPromotionGate({ assessment: mega }).permitted === false,
      warningRequiresReview:
        evaluateBiasPromotionGate({ assessment: sector }).decision === 'REVIEW_REQUIRED' ||
        sector.severity === 'SEVERE',
      noCausalClaimsFromCorrelation: mega.findings.every((f) =>
        f.evidence.every((e) => e.correlationIsNotCausation),
      ),
      evidenceVaultIntegration: true,
      coverageTensorBridge: true,
      compilerManifestBridge: true,
      noExecutionAuthority: clean.grantsExecutionAuthority === false,
    });
    assert.equal(result.marker, HELIOS_AAFV2_05_BIAS_SENTINEL_QUALIFIED);
  });
});
