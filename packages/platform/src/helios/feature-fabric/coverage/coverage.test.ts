import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { asUtcInstant } from '../../../../../domain/src/time.ts';
import {
  buildCoverageManifest,
  buildCoverageTensor,
  classifyMissingness,
  createHeliosCoverageStore,
  detectCoverageDrift,
  entitlementFailureIsMissingNotZero,
  evaluateAaf05Qualification,
  HELIOS_AAF05_COVERAGE_TENSOR_QUALIFIED,
  sealCoverageSnapshot,
  type EligibleUniverseMember,
  type FeatureCoverageProbe,
} from './index.ts';

const T0 = asUtcInstant('2025-01-15T16:00:00.000Z');

function member(id: string, overrides: Partial<EligibleUniverseMember> = {}): EligibleUniverseMember {
  return Object.freeze({
    canonicalEntityId: `ent:${id}`,
    canonicalInstrumentId: `inst:${id}`,
    evaluationTimestamp: T0,
    sector: 'TECH',
    industry: 'SOFTWARE',
    marketCapBucket: 'LARGE',
    liquidityBucket: 'HIGH',
    geography: 'US',
    venue: 'NASDAQ',
    assetClass: 'EQUITY',
    ...overrides,
  });
}

function probe(
  member: EligibleUniverseMember,
  featureId: string,
  signal: FeatureCoverageProbe['signal'],
  providerId = 'prov-a',
): FeatureCoverageProbe {
  return Object.freeze({ member, featureId, providerId, signal });
}

describe('AAF05 coverage tensor', () => {
  it('preserves eligible-universe denominator when only a subset has usable features', () => {
    const eligible = Object.freeze([member('1'), member('2'), member('3'), member('4'), member('5')]);
    const probes = [
      probe(member('1'), 'feat.alpha', {
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
    ];
    const tensor = buildCoverageTensor({
      universeId: 'u-test',
      universeDefinition: 'eligible=5000 fixture=5',
      evaluationTimestamp: T0,
      eligibleMembers: eligible,
      featureIds: ['feat.alpha'],
      probes,
    });
    assert.equal(tensor.eligibleUniverseCount, 5);
    assert.equal(tensor.usableFeatureCount, 1);
    assert.equal(tensor.expectedCellCount, 5);
    assert.equal(tensor.metrics.coverageRatioBps, 2000);
  });

  it('makes coverage changes visible via drift events', () => {
    const eligible = Object.freeze([member('1'), member('2')]);
    const baseTensor = buildCoverageTensor({
      universeId: 'u-drift',
      universeDefinition: 'drift-fixture',
      evaluationTimestamp: T0,
      eligibleMembers: eligible,
      featureIds: ['feat.alpha'],
      probes: [
        probe(member('1'), 'feat.alpha', {
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
        probe(member('2'), 'feat.alpha', {
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
      ],
    });
    const currentTensor = buildCoverageTensor({
      universeId: 'u-drift',
      universeDefinition: 'drift-fixture',
      evaluationTimestamp: T0,
      eligibleMembers: eligible,
      featureIds: ['feat.alpha'],
      probes: [
        probe(member('1'), 'feat.alpha', {
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
      ],
      baselineCoverageRatioBps: baseTensor.metrics.coverageRatioBps,
    });
    const baseline = sealCoverageSnapshot({ tensor: baseTensor, capturedAt: T0 });
    const current = sealCoverageSnapshot({ tensor: currentTensor, capturedAt: T0 });
    const drift = detectCoverageDrift({
      detectedAt: T0,
      universeId: 'u-drift',
      baseline,
      current,
      materialDriftThresholdBps: 1000,
    });
    assert.ok(drift);
    assert.equal(drift!.driftBps, 5000);
  });

  it('distinguishes provider outage from structural absence', () => {
    const outage = classifyMissingness({
      published: true,
      providerAvailable: false,
      providerCoversInstrument: true,
      entitlementState: 'USABLE',
      entityResolved: true,
      applicable: true,
      qualityState: 'VALID',
      historicalGap: false,
      knowableAtEvaluationTime: true,
      valuePresent: false,
    });
    const structural = classifyMissingness({
      published: true,
      providerAvailable: true,
      providerCoversInstrument: false,
      entitlementState: 'USABLE',
      entityResolved: true,
      applicable: true,
      qualityState: 'VALID',
      historicalGap: false,
      knowableAtEvaluationTime: true,
      valuePresent: false,
    });
    assert.equal(outage, 'PROVIDER_UNAVAILABLE');
    assert.equal(structural, 'NOT_COVERED_BY_PROVIDER');
  });

  it('treats entitlement failure as missingness, not numeric zero', () => {
    assert.equal(entitlementFailureIsMissingNotZero('RESTRICTED'), true);
    const reason = classifyMissingness({
      published: true,
      providerAvailable: true,
      providerCoversInstrument: true,
      entitlementState: 'RESTRICTED',
      entityResolved: true,
      applicable: true,
      qualityState: 'VALID',
      historicalGap: false,
      knowableAtEvaluationTime: true,
      valuePresent: false,
    });
    assert.equal(reason, 'ENTITLEMENT_RESTRICTED');
  });

  it('restart preserves coverage state via store snapshot', () => {
    const store = createHeliosCoverageStore();
    const tensor = buildCoverageTensor({
      universeId: 'u-restart',
      universeDefinition: 'restart-fixture',
      evaluationTimestamp: T0,
      eligibleMembers: [member('1')],
      featureIds: ['feat.alpha'],
      probes: [],
    });
    const snapshot = sealCoverageSnapshot({ tensor, capturedAt: T0 });
    store.putSnapshot(snapshot);
    const saved = store.snapshot();
    const restored = createHeliosCoverageStore();
    restored.restore(saved);
    assert.deepEqual(restored.listSnapshots(), store.listSnapshots());
  });

  it('builds coverage manifest for strategy evaluation evidence', () => {
    const tensor = buildCoverageTensor({
      universeId: 'u-eval',
      universeDefinition: 'strategy-lab-eval',
      evaluationTimestamp: T0,
      eligibleMembers: [member('1'), member('2')],
      featureIds: ['feat.beta'],
      probes: [],
    });
    const evaluationSnapshot = sealCoverageSnapshot({ tensor, capturedAt: T0 });
    const manifest = buildCoverageManifest({
      evaluationId: 'seval_test',
      universeDefinition: tensor.universeDefinition,
      universeId: tensor.universeId,
      featureIds: tensor.featureIds,
      evaluationTensor: tensor,
      evaluationSnapshot,
    });
    assert.equal(manifest.eligibleUniverseCount, 2);
    assert.equal(manifest.usableFeatureCount, 0);
    assert.ok(manifest.manifestFingerprint.length > 0);
    assert.equal(manifest.exclusionByReason.UNKNOWN, 2);
  });

  it('exports HELIOS_AAF05_COVERAGE_TENSOR_QUALIFIED marker', () => {
    assert.equal(HELIOS_AAF05_COVERAGE_TENSOR_QUALIFIED, 'HELIOS_AAF05_COVERAGE_TENSOR_QUALIFIED');
    const result = evaluateAaf05Qualification({
      denominatorSurvivesFiltering: true,
      coverageChangesVisible: true,
      providerOutageDistinctFromStructuralAbsence: true,
      entitlementFailureNotInterpretedAsZero: true,
      restartPreservesCoverageState: true,
      strategyEvaluationContainsCoverageEvidence: true,
    });
    assert.equal(result.marker, HELIOS_AAF05_COVERAGE_TENSOR_QUALIFIED);
  });
});
