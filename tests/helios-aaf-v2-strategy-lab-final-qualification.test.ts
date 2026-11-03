/**
 * HELIOS AAF V2.6 — Strategy Lab binding and final qualification simulation.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { FrozenClock } from '../packages/config/src/clock.ts';
import { asUtcInstant, type UtcInstant } from '../packages/domain/src/time.ts';
import { EvidenceVault } from '../packages/evidence/src/vault.ts';
import {
  HELIOS_ADAPTIVE_ALPHA_FABRIC_V2_QUALIFIED,
  adaptiveAlphaQualificationMarker,
  assertAdaptiveAlphaActorMayCertify,
  buildAdaptiveAlphaCompilerContext,
  runAdaptiveAlphaResearchPipeline,
  toStrategyLabAdaptiveAlphaQualificationRef,
} from '../packages/platform/src/helios/adaptive-alpha-v2/index.ts';
import { compileFeatureVector } from '../packages/platform/src/helios/feature-fabric/compiler/compile.ts';
import type { TemporalObservation } from '../packages/platform/src/helios/feature-fabric/temporal-types.ts';
import type { FeatureCoverageProbe } from '../packages/platform/src/helios/feature-fabric/feature-coverage/types.ts';
import type { UniverseEntityCharacteristics } from '../packages/platform/src/helios/feature-fabric/aaf06/coverage-bias-types.ts';
import {
  StrategyPromotionService,
  createQualificationPolicy,
  gateResearchToEvaluation,
} from '../packages/strategy-lab/src/index.ts';
import { lintHeliosBoundary } from '../tools/architectural-linter/src/helios-guards.ts';

const DECISION = asUtcInstant('2026-03-15T21:00:00.000Z');
const MARKET_CLOSE = asUtcInstant('2026-03-15T20:00:00.000Z');
const FUTURE_KNOWABLE = asUtcInstant('2026-03-15T21:30:00.000Z');
const ENTITY = 'ent_aaf_v2_acme';
const INSTRUMENT = 'inst_aaf_v2_acme';

function obs(partial: TemporalObservation): TemporalObservation {
  return Object.freeze(partial);
}

function balancedUniverse(): UniverseEntityCharacteristics[] {
  const rows: UniverseEntityCharacteristics[] = [];
  for (let i = 0; i < 40; i += 1) {
    rows.push(
      Object.freeze({
        entityId: `ent_v2_${i}`,
        marketCapMinor: 5_000_000_000n,
        liquidityScore: 55,
        volatilityBps: 1_100,
        sector: i % 2 === 0 ? 'TECH' : 'HEALTH',
        geography: 'US',
        listingAgeDays: 900,
        historicalReturnBps: 400,
        assetClass: 'EQUITY',
      }),
    );
  }
  return rows;
}

function biasedUniverse(): { readonly eligible: UniverseEntityCharacteristics[]; readonly covered: readonly string[] } {
  const eligible = balancedUniverse().map((row, index) =>
    Object.freeze({
      ...row,
      marketCapMinor: index < 20 ? 50_000_000_000n : 100_000_000n,
      sector: index < 20 ? 'TECH' : 'ENERGY',
      geography: index < 20 ? 'US' : 'EM',
    }),
  );
  const covered = eligible.filter((row) => (row.marketCapMinor ?? 0n) >= 10_000_000_000n).map((row) => row.entityId);
  return { eligible, covered };
}

function heterogeneousObservations(): TemporalObservation[] {
  return [
    obs({
      observationRef: 'mkt',
      kind: 'MARKET_BAR',
      entityId: ENTITY,
      instrumentId: INSTRUMENT,
      sourceEventTime: MARKET_CLOSE,
      knowableAt: MARKET_CLOSE,
      validUntil: null,
      revisionSequence: 0,
      periodEnd: null,
      publishedKnowableAt: null,
      valueMinor: 12_500n,
      metadata: Object.freeze({}),
    }),
    obs({
      observationRef: 'sec',
      kind: 'CORPORATE_FILING',
      entityId: ENTITY,
      instrumentId: INSTRUMENT,
      sourceEventTime: MARKET_CLOSE,
      knowableAt: MARKET_CLOSE,
      validUntil: null,
      revisionSequence: 0,
      periodEnd: null,
      publishedKnowableAt: MARKET_CLOSE,
      valueMinor: 1n,
      metadata: Object.freeze({ form: '10-K' }),
    }),
    obs({
      observationRef: 'macro',
      kind: 'MACRO_RELEASE',
      entityId: ENTITY,
      instrumentId: null,
      sourceEventTime: MARKET_CLOSE,
      knowableAt: MARKET_CLOSE,
      validUntil: null,
      revisionSequence: 0,
      periodEnd: null,
      publishedKnowableAt: null,
      valueMinor: 310n,
      metadata: Object.freeze({ series: 'NFP' }),
    }),
    obs({
      observationRef: 'alt',
      kind: 'ALT_DATA',
      entityId: ENTITY,
      instrumentId: INSTRUMENT,
      sourceEventTime: MARKET_CLOSE,
      knowableAt: MARKET_CLOSE,
      validUntil: null,
      revisionSequence: 0,
      periodEnd: null,
      publishedKnowableAt: null,
      valueMinor: 7n,
      metadata: Object.freeze({ signal: 'web_traffic' }),
    }),
    obs({
      observationRef: 'future_leak',
      kind: 'CORPORATE_FILING',
      entityId: ENTITY,
      instrumentId: INSTRUMENT,
      sourceEventTime: MARKET_CLOSE,
      knowableAt: FUTURE_KNOWABLE,
      validUntil: null,
      revisionSequence: 0,
      periodEnd: null,
      publishedKnowableAt: FUTURE_KNOWABLE,
      valueMinor: 99n,
      metadata: Object.freeze({ form: '8-K', leakProbe: 'true' }),
    }),
  ];
}

function member(at: UtcInstant) {
  return Object.freeze({
    canonicalEntityId: ENTITY,
    canonicalInstrumentId: INSTRUMENT,
    evaluationTimestamp: at,
    sector: 'TECH',
    industry: null,
    marketCapBucket: 'LARGE',
    liquidityBucket: 'HIGH',
    geography: 'US',
    venue: 'sandbox',
    assetClass: 'EQUITY',
  });
}

function probes(at: UtcInstant): FeatureCoverageProbe[] {
  return [
    Object.freeze({
      member: member(at),
      featureId: 'close_minor',
      providerId: 'sandbox',
      signal: Object.freeze({
        published: true,
        providerAvailable: true,
        providerCoversInstrument: true,
        entitlementState: 'USABLE',
        entityResolved: true,
        applicable: true,
        qualityState: 'VALID',
        historicalGap: false,
        knowableAtEvaluationTime: true,
        valuePresent: true,
      }),
    }),
  ];
}

describe('HELIOS AAF V2.6 Strategy Lab final qualification', () => {
  it('runs end-to-end research pipeline and seals evidence', () => {
    const clock = new FrozenClock(DECISION);
    const evidence = new EvidenceVault(clock);
    const eligible = balancedUniverse();
    const context = buildAdaptiveAlphaCompilerContext({
      observations: heterogeneousObservations().filter((row) => row.observationRef !== 'future_leak'),
      entityResolutionVersion: 'eres_aaf_v2_fixture_v1',
    });
    const pipeline = runAdaptiveAlphaResearchPipeline({
      hypothesisRef: 'genome_candidate_v2',
      strategyId: 'str_aaf_v2_demo',
      strategyVersion: 'v1',
      strategyEvaluationId: 'eval_aaf_v2_demo',
      featureRequirements: Object.freeze(['close_minor']),
      featureDefinitions: Object.freeze([
        Object.freeze({
          featureId: 'close_minor',
          version: '1',
          computeKind: 'AS_OF_SCALAR',
          observationKind: 'MARKET_BAR',
          instrumentId: INSTRUMENT,
        }),
      ]),
      entityId: ENTITY,
      instrumentId: INSTRUMENT,
      decisionTimes: Object.freeze([DECISION]),
      compilerContext: context,
      universeVersion: 'univ_aaf_v2',
      eligibleMembers: Object.freeze([member(DECISION)]),
      coverageProbes: Object.freeze(probes(DECISION)),
      biasAssessmentInput: {
        assessmentId: 'cba_v2_balanced',
        researchDatasetId: 'eval_aaf_v2_demo',
        evaluatedAt: DECISION,
        eligibleUniverse: eligible,
        featureCoveredEntityIds: eligible.map((row) => row.entityId),
      },
      actorKind: 'QUALIFICATION_SERVICE',
      qualifiedAt: clock.now(),
      evidenceVault: evidence,
    });
    assert.equal(pipeline.ok, true);
    if (!pipeline.ok) return;
    assert.equal(pipeline.qualification.qualified, true);
    assert.equal(adaptiveAlphaQualificationMarker(pipeline.qualification), HELIOS_ADAPTIVE_ALPHA_FABRIC_V2_QUALIFIED);
    assert.ok(pipeline.qualification.evidenceBundle.evidenceVaultRefs.length > 0);
    assert.ok(evidence.list().length > 0);
    assert.equal(pipeline.qualification.certification.voiSummary.counterfactualManifestReady, true);
  });

  it('rejects future observations during leakage probe', () => {
    const futureOnly = heterogeneousObservations().filter((row) => row.observationRef === 'future_leak');
    const leakContext = buildAdaptiveAlphaCompilerContext({
      observations: futureOnly,
      entityResolutionVersion: 'eres_aaf_v2_fixture_v1',
    });
    const leakProbe = compileFeatureVector({
      entityId: ENTITY,
      instrumentId: INSTRUMENT,
      decisionTime: DECISION,
      universeVersion: 'univ_leak',
      featureDefinitions: Object.freeze([
        Object.freeze({
          featureId: 'eps_minor',
          version: '1',
          computeKind: 'AS_OF_SCALAR',
          observationKind: 'CORPORATE_FILING',
          entityId: ENTITY,
        }),
      ]),
      context: leakContext,
    });
    assert.equal(leakProbe.ok, false);
    if (leakProbe.ok) return;
    assert.equal(leakProbe.error.code, 'LEAKAGE_DETECTED');
  });

  it('blocks Strategy Lab promotion when bias sentinel is SEVERE', () => {
    const clock = new FrozenClock(DECISION);
    const { eligible, covered } = biasedUniverse();
    const context = buildAdaptiveAlphaCompilerContext({
      observations: heterogeneousObservations().filter((row) => row.observationRef !== 'future_leak'),
      entityResolutionVersion: 'eres_aaf_v2_fixture_v1',
    });
    const pipeline = runAdaptiveAlphaResearchPipeline({
      hypothesisRef: 'biased_dataset',
      strategyId: 'str_aaf_v2_biased',
      strategyVersion: 'v1',
      strategyEvaluationId: 'eval_biased',
      featureRequirements: Object.freeze(['close_minor']),
      featureDefinitions: Object.freeze([
        Object.freeze({
          featureId: 'close_minor',
          version: '1',
          computeKind: 'AS_OF_SCALAR',
          observationKind: 'MARKET_BAR',
          instrumentId: INSTRUMENT,
        }),
      ]),
      entityId: ENTITY,
      instrumentId: INSTRUMENT,
      decisionTimes: Object.freeze([DECISION]),
      compilerContext: context,
      universeVersion: 'univ_biased',
      eligibleMembers: Object.freeze([member(DECISION)]),
      coverageProbes: Object.freeze(probes(DECISION)),
      biasAssessmentInput: {
        assessmentId: 'cba_v2_severe',
        researchDatasetId: 'eval_biased',
        evaluatedAt: DECISION,
        eligibleUniverse: eligible,
        featureCoveredEntityIds: covered,
      },
      actorKind: 'QUALIFICATION_SERVICE',
      qualifiedAt: clock.now(),
    });
    assert.equal(pipeline.ok, true);
    if (!pipeline.ok) return;
    assert.equal(pipeline.qualification.promotionPermitted, false);
    const promotion = new StrategyPromotionService({
      clock,
      policy: createQualificationPolicy(),
    });
    const ref = toStrategyLabAdaptiveAlphaQualificationRef(pipeline.qualification);
    promotion.recordAdaptiveAlphaQualification({
      strategyId: 'str_aaf_v2_biased',
      version: 'v1',
      qualification: ref,
    });
    const gate = gateResearchToEvaluation({
      capsule: {
        capsuleId: 'cap_test' as never,
        strategyId: 'str_aaf_v2_biased',
        version: 'v1',
        fingerprint: 'fp',
        specification: {} as never,
        compiledHash: 'hash',
        compilerVersion: 'v1',
        instrumentUniverse: Object.freeze(['inst']),
        featureDependencies: Object.freeze(['close_minor']),
        dataDependencies: Object.freeze(['close_minor']),
        costAssumptionsHash: 'cost',
        executionAssumptionsHash: 'exec',
        evidenceRefs: Object.freeze([{ evidenceKind: 'VALIDATION', refId: 'r', hash: 'h' }]),
        schemaDefects: Object.freeze([]),
        subjectId: 'cust',
        frozenAt: DECISION,
        simulationOnly: true,
        liveEligible: false,
      },
      policy: createQualificationPolicy(),
      adaptiveAlphaQualification: promotion.store.getLatestAdaptiveAlphaQualification('str_aaf_v2_biased', 'v1') ?? null,
    });
    assert.equal(gate.ok, true);
    if (!gate.ok) return;
    assert.equal(gate.value.passed, false);
  });

  it('forbids agents from self-certifying AAF qualification', () => {
    const blocked = assertAdaptiveAlphaActorMayCertify('AGENT');
    assert.ok(blocked);
    assert.equal(blocked?.code, 'AAF_AGENT_SELF_QUALIFY_FORBIDDEN');
  });

  it('passes HELIOS boundary lint', () => {
    const findings = lintHeliosBoundary('/agent/repos/solstice');
    assert.equal(findings.length, 0, findings.map((row) => row.message).join('\n'));
  });
});
