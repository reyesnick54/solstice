/**
 * HELIOS ALT13 — incremental information, signal decay, and feature discovery qualification.
 */

import assert from 'node:assert/strict';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { asUtcInstant } from '../packages/domain/src/time.ts';
import {
  ALT13_CORE_BASELINES,
  ALT13_DEMAND_PROXY_CHANNELS,
  ALT13_INCREMENTAL_METRICS,
  HELIOS_ALT13_INCREMENTAL_INFORMATION_BLOCKED,
  HELIOS_ALT13_INCREMENTAL_INFORMATION_QUALIFIED,
  assertEveryHypothesisTrialRecorded,
  buildAlt13IncrementalInformationEvidence,
  createAltFeatureHypothesisTrialRegistry,
  detectDemandRedundancy,
  evaluateAlt13IncrementalInformationQualification,
  evaluateIncrementalInformationState,
  registerAlternativeSignalHypothesis,
  seedAlt13ReferencePanel,
} from '../packages/platform/src/helios/alternative-data/alt13/index.ts';
import { lintHeliosBoundary } from '../tools/architectural-linter/src/helios-guards.ts';

const ROOT = join(import.meta.dirname, '..');
const NOW = asUtcInstant('2026-11-07T09:00:00.000Z');

describe('HELIOS ALT13 incremental information', () => {
  it('exposes baselines, metrics, and state types on the reference panel', () => {
    assert.deepEqual(ALT13_CORE_BASELINES.includes('CORE_HELIOS'), true);
    assert.deepEqual(ALT13_CORE_BASELINES.includes('CORE_HELIOS_PLUS_ALT_SIGNAL'), true);
    assert.ok(ALT13_INCREMENTAL_METRICS.includes('ORTHOGONALIZED_RESIDUAL_PREDICTION'));
    assert.equal(ALT13_DEMAND_PROXY_CHANNELS.length, 4);

    const panel = seedAlt13ReferencePanel();
    assert.ok(panel.length >= 48);

    const hypothesis = registerAlternativeSignalHypothesis({
      featureId: 'alt_unique_supply',
      providerIds: Object.freeze(['provider-a', 'provider-b']),
      target: 'REVENUE_FORECAST',
      registeredAt: NOW,
      economicJustification: 'Supply-chain alt signal beyond core HELIOS',
    });
    const incremental = evaluateIncrementalInformationState({ hypothesis, rows: panel });
    assert.equal(incremental.grantsExecutionAuthority, false);
    assert.equal(incremental.metrics.length, ALT13_INCREMENTAL_METRICS.length);
    assert.equal(incremental.primaryTarget, true);
  });

  it('detects redundant demand proxies and registers every hypothesis trial for EVOL09 FDR', () => {
    const panel = seedAlt13ReferencePanel();
    const redundancy = detectDemandRedundancy({
      alt_job_growth: panel.map((r) => r.altFeatures.alt_job_growth ?? 0),
      alt_search_growth: panel.map((r) => r.altFeatures.alt_search_growth ?? 0),
      alt_web_traffic: panel.map((r) => r.altFeatures.alt_web_traffic ?? 0),
      alt_product_demand: panel.map((r) => r.altFeatures.alt_product_demand ?? 0),
    });
    assert.equal(redundancy.inflationRisk, true);
    assert.ok(redundancy.clusters.length >= 1);

    const registry = createAltFeatureHypothesisTrialRegistry();
    const before = registry.listTrials().length;
    registry.recordTrial({
      hypothesisId: 'alt13:hyp:alt_unique_supply:REVENUE_FORECAST' as never,
      featureId: 'alt_unique_supply',
      recordedAt: NOW,
      target: 'REVENUE_FORECAST',
      rawPValues: Object.freeze([0.02, 0.04]),
      outcome: 'COMPLETED',
    });
    const after = registry.listTrials().length;
    assert.equal(assertEveryHypothesisTrialRecorded(before, after, 1), true);

    const summary = registry.buildMultipleTestingSummary();
    assert.equal(summary.evol09Schema, 'sunrey.helios.strategy-evolution.evol09.v1');
  });

  it('qualifies incremental-information evidence with decay, stability, and provider dependence', () => {
    const evidence = buildAlt13IncrementalInformationEvidence();
    assert.ok(evidence.decayStates.length >= 1);
    assert.ok(evidence.stabilityStates.length >= 1);
    assert.ok(evidence.providerDependence.length >= 1);
    assert.equal(evidence.grantsExecutionAuthority, false);
    assert.ok(evidence.multipleTesting.trialCount >= 1);

    const result = evaluateAlt13IncrementalInformationQualification();
    assert.equal(result.qualified, true);
    assert.equal(result.marker, HELIOS_ALT13_INCREMENTAL_INFORMATION_QUALIFIED);
    assert.equal(result.evidence.hypotheses.every((h) => h.target !== 'STOCK_RETURN_SECONDARY'), true);
  });

  it('respects HELIOS architectural boundary rules', () => {
    const findings = lintHeliosBoundary(ROOT);
    const scoped = findings.filter((f) => f.file.includes('alternative-data/alt13'));
    assert.deepEqual(scoped, []);
  });
});
