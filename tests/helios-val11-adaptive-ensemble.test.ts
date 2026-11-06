/**
 * HELIOS Valuation Intelligence VAL11 — adaptive multi-model valuation ensemble.
 * Lane A (price-free intrinsic) and Lane B (market-referenced) must remain separated.
 */

import assert from 'node:assert/strict';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import {
  FORBIDDEN_INTRINSIC_INPUT_KEYS,
  HELIOS_VAL11_ADAPTIVE_VALUATION_ENSEMBLE_QUALIFIED,
  assertAllIntrinsicCandidatesPriceFree,
  assertIntrinsicInputsPriceFree,
  evaluateVal11AdaptiveEnsembleQualification,
  listValWorkPackages,
  mergeQuantiles,
  qualificationChecksFromState,
  runVal11AdaptiveValuationEnsemble,
  val11DemoCompanyProfile,
  val11DemoHistoricalReliability,
  val11DemoIntrinsicCandidates,
  val11DemoMarketReferencedCandidates,
  VAL11_FIXTURE_AS_OF,
  VAL11_FIXTURE_CURRENCY,
  VAL11_FIXTURE_ENTITY_ID,
  type EnsembleValueQuantile,
} from '../packages/platform/src/helios/valuation-intelligence/index.ts';
import { lintHeliosBoundary } from '../tools/architectural-linter/src/helios-guards.ts';

const ROOT = join(import.meta.dirname, '..');

describe('HELIOS VAL11 — adaptive valuation ensemble', () => {
  it('architecture guard: valuation-intelligence stays inside helios boundary', () => {
    const findings = lintHeliosBoundary(ROOT);
    const scoped = findings.filter((f) => f.file.includes('valuation-intelligence'));
    assert.equal(scoped.length, 0, JSON.stringify(scoped));
  });

  it('registers VAL11 in the work package registry when module and test exist', () => {
    const rows = listValWorkPackages(ROOT);
    const val11 = rows.find((r) => r.packageId === 'VAL11');
    assert.ok(val11);
    assert.equal(val11!.status, 'IMPLEMENTED');
  });

  it('enforces Lane A price-free inputs (test-enforced separation)', () => {
    const clean = val11DemoIntrinsicCandidates();
    assert.equal(assertAllIntrinsicCandidatesPriceFree(clean).length, 0);

    const contaminated = clean.map((c) =>
      c.candidateId === 'intrinsic-dcf-fcff'
        ? Object.freeze({ ...c, inputKeysUsed: Object.freeze([...c.inputKeysUsed, 'marketPriceMinor']) })
        : c,
    );
    const violations = assertAllIntrinsicCandidatesPriceFree(contaminated);
    assert.equal(violations.length, 1);
    assert.equal(violations[0]!.forbiddenKey, 'marketPriceMinor');
    assert.ok(FORBIDDEN_INTRINSIC_INPUT_KEYS.includes('marketPriceMinor'));
  });

  it('keeps intrinsic and market-referenced distributions separate with reconciliation', () => {
    const run = runVal11AdaptiveValuationEnsemble({
      ensembleId: 'val11-demo-ensemble',
      entityId: VAL11_FIXTURE_ENTITY_ID,
      evaluationTime: VAL11_FIXTURE_AS_OF,
      compiledAt: VAL11_FIXTURE_AS_OF,
      currency: VAL11_FIXTURE_CURRENCY,
      company: val11DemoCompanyProfile(),
      intrinsicCandidates: val11DemoIntrinsicCandidates(),
      marketReferencedCandidates: val11DemoMarketReferencedCandidates(),
      historicalReliability: val11DemoHistoricalReliability(),
    });

    const { state } = run;
    assert.equal(state.intrinsicDistribution.lane, 'INTRINSIC');
    assert.equal(state.marketReferencedDistribution.lane, 'MARKET_REFERENCED');
    assert.equal(state.reconciliation.lanesAveraged, false);
    assert.notEqual(state.intrinsicDistribution.medianEquityPerShareMinor, null);
    assert.notEqual(state.marketReferencedDistribution.medianEquityPerShareMinor, null);
    assert.ok(state.challengerCases.length >= 5);
    assert.equal(state.opaqueAiPriceTarget, false);

    for (const c of state.intrinsicCandidates) {
      assert.equal(assertIntrinsicInputsPriceFree(c).length, 0);
    }
  });

  it('prefers residual income over generic FCFF for bank archetype via applicability', () => {
    const run = runVal11AdaptiveValuationEnsemble({
      ensembleId: 'val11-bank-applicability',
      entityId: VAL11_FIXTURE_ENTITY_ID,
      evaluationTime: VAL11_FIXTURE_AS_OF,
      compiledAt: VAL11_FIXTURE_AS_OF,
      currency: VAL11_FIXTURE_CURRENCY,
      company: val11DemoCompanyProfile(),
      intrinsicCandidates: val11DemoIntrinsicCandidates(),
      marketReferencedCandidates: val11DemoMarketReferencedCandidates(),
      historicalReliability: val11DemoHistoricalReliability(),
    });

    const ri = run.state.applicabilityStates.find((a) => a.method === 'RESIDUAL_INCOME');
    const fcff = run.state.applicabilityStates.find((a) => a.method === 'DCF_FCFF');
    assert.ok(ri && fcff);
    assert.ok(ri!.applicabilityScore > fcff!.applicabilityScore);
    assert.ok(ri!.characteristicDrivers.includes('BANK'));
  });

  it('mergeQuantiles includes zero equity values (0n is not treated as missing)', () => {
    const zeroQuantile: EnsembleValueQuantile = Object.freeze({
      quantile: 'p50',
      equityValuePerShareMinor: 0n,
      enterpriseValueMinor: null,
    });
    const merged = mergeQuantiles(Object.freeze(['p50']), [
      Object.freeze({ weight: 1, quantiles: Object.freeze([zeroQuantile]) }),
    ]);
    assert.equal(merged[0]!.equityValuePerShareMinor, 0n);
  });

  it('emits HELIOS_VAL11_ADAPTIVE_VALUATION_ENSEMBLE_QUALIFIED when engineering checks pass', () => {
    const run = runVal11AdaptiveValuationEnsemble({
      ensembleId: 'val11-qualification',
      entityId: VAL11_FIXTURE_ENTITY_ID,
      evaluationTime: VAL11_FIXTURE_AS_OF,
      compiledAt: VAL11_FIXTURE_AS_OF,
      currency: VAL11_FIXTURE_CURRENCY,
      company: val11DemoCompanyProfile(),
      intrinsicCandidates: val11DemoIntrinsicCandidates(),
      marketReferencedCandidates: val11DemoMarketReferencedCandidates(),
      historicalReliability: val11DemoHistoricalReliability(),
    });

    const checks = qualificationChecksFromState(run.state, {
      laneSeparationViolations: run.laneSeparationViolations,
      trustLedgerAppendOnly: run.trustLedger.appendOnly === true,
    });
    const qualification = evaluateVal11AdaptiveEnsembleQualification(checks);
    assert.equal(
      qualification.marker,
      HELIOS_VAL11_ADAPTIVE_VALUATION_ENSEMBLE_QUALIFIED,
      qualification.blockers.join('; '),
    );
    assert.ok(run.trustLedger.entries.length > 0);
    assert.equal(run.trustLedger.entries.every((e) => e.selfModifying === false), true);
    assert.equal(
      run.trustLedger.entries.every((e) => e.reliability.metrics.trainedOnFutureReturns === false),
      true,
    );
  });
});
