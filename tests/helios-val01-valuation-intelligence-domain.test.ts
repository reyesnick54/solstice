/**
 * VAL01 — canonical probabilistic valuation intelligence domain qualification.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { asUtcInstant } from '../packages/domain/src/time.ts';
import { ENVIRONMENT, LIVE_TRADING_ENABLED } from '../packages/config/src/index.ts';
import {
  VALUATION_METHODS,
  HELIOS_VAL01_VALUATION_DOMAIN_QUALIFIED,
  applicableMethodsOnly,
  attachSecFundamentalsToValuationInput,
  compileValuationEvidenceManifest,
  createValuationIntelligenceStore,
  demoVal01BaseScenario,
  demoVal01EvaluationTime,
  demoVal01FundamentalSnapshot,
  demoVal01FutureLeakAssumption,
  demoVal01IntrinsicDistribution,
  demoVal01IssuerProfile,
  demoVal01Snapshot,
  demoVal01WaccAssumption,
  evaluateVal01DomainQualification,
  evaluateValuationMethodApplicability,
  filterKnowableValuationArtifacts,
  listApplicableValuationMethods,
} from '../packages/platform/src/helios/valuation-intelligence/index.ts';
import {
  compileValuationFeaturePlaneFromManifest,
  valuationFeaturePlaneAt,
} from '../packages/platform/src/helios/feature-fabric/valuation/index.ts';

describe('HELIOS VAL01 valuation intelligence domain', () => {
  it('simulation posture', () => {
    assert.equal(ENVIRONMENT, 'simulation');
    assert.equal(LIVE_TRADING_ENABLED, false);
  });

  it('taxonomy lists all valuation methods', () => {
    assert.deepEqual(VALUATION_METHODS, [
      'DCF_FCFF',
      'DCF_FCFE',
      'DIVIDEND_DISCOUNT',
      'RESIDUAL_INCOME',
      'REVERSE_DCF',
      'COMPARABLE_MULTIPLES',
      'SUM_OF_PARTS',
    ]);
  });

  it('applicability rules — dividend discount blocked for non-payers', () => {
    const profile = demoVal01IssuerProfile();
    const verdict = evaluateValuationMethodApplicability(profile, 'DIVIDEND_DISCOUNT');
    assert.equal(verdict.applicable, false);
    assert.ok(verdict.reasons.includes('not_dividend_payer'));
  });

  it('applicability rules — DCF FCFF allowed with cash flow anchor', () => {
    const profile = demoVal01IssuerProfile();
    const applicable = applicableMethodsOnly(profile, VALUATION_METHODS);
    assert.ok(applicable.includes('DCF_FCFF'));
    assert.ok(applicable.includes('REVERSE_DCF'));
    assert.ok(!applicable.includes('DIVIDEND_DISCOUNT'));
    assert.equal(listApplicableValuationMethods(profile, VALUATION_METHODS).length, VALUATION_METHODS.length);
  });

  it('consumes SEC fundamentals without duplicating OS10 engine', () => {
    const snapshot = demoVal01FundamentalSnapshot();
    const attached = attachSecFundamentalsToValuationInput({ snapshot });
    assert.equal(attached.grantsExecutionAuthority, false);
    assert.equal(attached.binding.source, 'sec_point_in_time_fundamentals');
    assert.equal(attached.issuerProfile.hasPositiveOperatingCashFlow, true);
  });

  it('no leakage — future assumptions hidden until evaluation time', () => {
    const store = createValuationIntelligenceStore();
    store.upsertAssumption(demoVal01WaccAssumption());
    store.upsertAssumption(demoVal01FutureLeakAssumption());

    const before = store.snapshotKnowableAt(demoVal01EvaluationTime);
    assert.equal(before.assumptions.length, 1);
    assert.equal(before.assumptions[0]?.assumptionId, 'assumption.val01.wacc');

    const visible = filterKnowableValuationArtifacts(demoVal01EvaluationTime, [
      demoVal01WaccAssumption(),
      demoVal01FutureLeakAssumption(),
    ]);
    assert.equal(visible.length, 1);
  });

  it('evidence manifest compile rejects leakage', () => {
    const store = createValuationIntelligenceStore();
    store.upsertSnapshot(demoVal01Snapshot());
    store.upsertScenario(demoVal01BaseScenario());
    store.upsertAssumption(demoVal01FutureLeakAssumption());

    assert.throws(() =>
      compileValuationEvidenceManifest({
        evaluationTime: demoVal01EvaluationTime,
        compiledAt: demoVal01EvaluationTime,
        snapshot: store.snapshot(),
      }),
    );
  });

  it('feature fabric bridge respects knowableAt', () => {
    const store = createValuationIntelligenceStore();
    store.upsertSnapshot(demoVal01Snapshot());
    store.upsertScenario(demoVal01BaseScenario());
    store.upsertAssumption(demoVal01WaccAssumption());
    store.upsertIntrinsicDistribution(demoVal01IntrinsicDistribution());

    const manifest = compileValuationEvidenceManifest({
      evaluationTime: demoVal01EvaluationTime,
      compiledAt: demoVal01EvaluationTime,
      snapshot: store.snapshotKnowableAt(demoVal01EvaluationTime),
    });

    const plane = compileValuationFeaturePlaneFromManifest({
      manifest,
      issuerProfile: demoVal01IssuerProfile(),
    });
    assert.ok(plane);
    const equity = plane!.features.find((row) => row.featureId === 'val01.intrinsic_equity_value_minor');
    assert.equal(equity?.valueMinor, 180_000_000_000n);

    const early = valuationFeaturePlaneAt(asUtcInstant('2024-07-01T15:00:00.000Z'), plane!);
    assert.ok(early.features.length < plane!.features.length);
  });

  it('domain qualification marker', () => {
    const result = evaluateVal01DomainQualification({
      coreTypesDefined: true,
      valuationMethodsComplete: true,
      applicabilityRulesEnforced: true,
      assumptionsExplicitAndVersioned: true,
      knowableAtEnforced: true,
      noExecutionAuthorityOnArtifacts: true,
      consumesSecFundamentalsNotDuplicate: true,
      consumesEarn09NotDuplicate: true,
      consumesAafV2NotDuplicate: true,
      consumesMacroYieldRates: true,
      strategyLabBindingDefined: true,
      featureFabricBridgeDefined: true,
    });
    assert.equal(result.marker, HELIOS_VAL01_VALUATION_DOMAIN_QUALIFIED);
    assert.equal(result.qualified, true);
  });
});
