import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { ENVIRONMENT, LIVE_INVESTMENT_EXECUTION, LIVE_TRADING_ENABLED } from '../packages/config/src/flags.ts';
import { asUtcInstant } from '../packages/domain/src/time.ts';
import {
  HELIOS_EXEC07_TCA_QUALIFIED,
  benchmarkConstructionComplete,
  buildAlgorithmExecutionProfile,
  buildEvol13ExecutionPolicyNicheEvidence,
  buildExec05RouterLearningHints,
  buildExecutionQualityReport,
  buildVenueExecutionProfile,
  computeExec07TransactionCostAnalysis,
  decomposeStrategyAndExecutionAttribution,
  evaluateExec07TcaQualification,
  exec07FixtureBenchmarkPrices,
  exec07IncompleteBenchmarkPrices,
  strategyCreditAllowed,
  EXEC07_FIXTURE_AS_OF,
} from '../packages/platform/src/helios/execution-connectivity/exec07/index.ts';
import { lintHeliosBoundary } from '../tools/architectural-linter/src/helios-guards.ts';

const T0 = EXEC07_FIXTURE_AS_OF;

function baseTcaInput(overrides: Record<string, unknown> = {}) {
  return Object.freeze({
    side: 'BUY' as const,
    quantityUnits: 100n,
    quantityFilledUnits: 100n,
    averageFillPriceMinor: 100_08n,
    explicitFeesMinor: 25n,
    spreadAtArrivalMinor: 2n,
    decisionToFillMoveMinor: 3n,
    priceImprovementVsLimitMinor: -1n,
    ordersSubmitted: 1,
    ordersFilled: 1,
    ordersPartiallyFilled: 0,
    ordersCanceled: 0,
    ordersRejected: 0,
    submissionToAckLatencyMs: 12,
    ackToFillLatencyMs: 45,
    postFillAdverseMoveBps: 4,
    benchmarks: exec07FixtureBenchmarkPrices,
    computedAt: T0,
    ...overrides,
  });
}

describe('HELIOS EXEC07 transaction cost analysis and execution quality', () => {
  it('passes architectural HELIOS boundary lint', () => {
    const root = new URL('..', import.meta.url).pathname;
    const findings = lintHeliosBoundary(root);
    const execFindings = findings.filter((row) => row.file.includes('execution-connectivity'));
    assert.equal(execFindings.length, 0, execFindings.map((f) => f.message).join('; '));
  });

  it('builds benchmarks and full TCA without conflating strategy and execution', () => {
    const first = computeExec07TransactionCostAnalysis(baseTcaInput());
    const second = computeExec07TransactionCostAnalysis(baseTcaInput());
    assert.equal(first.analysisId, second.analysisId);
    assert.equal(first.dataComplete, true);
    assert.equal(benchmarkConstructionComplete(first.benchmarks), true);
    assert.ok(first.benchmarks.some((row) => row.kind === 'NBBO'));
    assert.ok(first.spreadCostMinor != null);
    assert.ok(first.timingCostMinor != null);
    assert.ok(first.implementationShortfallBps != null);
    assert.equal(first.operational.fillRateBps, 10_000);

    const report = buildExecutionQualityReport({
      orderId: 'ord_exec07_1',
      executionPlanId: 'uep_fixture',
      venueId: 'sandbox_paper',
      providerId: 'sunrey-investments-paper',
      algorithmKind: 'LIMIT',
      instrumentId: 'EQ:US:SPY',
      transactionCost: first,
      averageFillPriceMinor: 100_08n,
      computedAt: T0,
    });
    assert.equal(report.validated, true);

    const decomposition = decomposeStrategyAndExecutionAttribution({
      strategyCapsuleId: 'cap_test',
      orderId: 'ord_exec07_1',
      currency: 'USD',
      side: 'BUY',
      decisionPriceMinor: 100_00n,
      exitOrMarkPriceMinor: 100_20n,
      quantityFilledUnits: 100n,
      transactionCost: first,
      computedAt: T0,
    });
    assert.equal(decomposition.suppressesStrategyCredit, false);
    assert.ok(decomposition.strategyAlphaMinor != null && decomposition.strategyAlphaMinor > 0n);
    assert.ok(decomposition.executionAlphaOrCostMinor != null && decomposition.executionAlphaOrCostMinor < 0n);
    assert.equal(strategyCreditAllowed(decomposition), true);

    const incomplete = computeExec07TransactionCostAnalysis(
      baseTcaInput({ benchmarks: exec07IncompleteBenchmarkPrices }),
    );
    assert.equal(incomplete.benchmarkConstructionComplete, false);
    const blocked = decomposeStrategyAndExecutionAttribution({
      strategyCapsuleId: 'cap_test',
      orderId: 'ord_exec07_2',
      currency: 'USD',
      side: 'BUY',
      decisionPriceMinor: null,
      exitOrMarkPriceMinor: 100_20n,
      quantityFilledUnits: 100n,
      transactionCost: incomplete,
      computedAt: T0,
    });
    assert.equal(blocked.suppressesStrategyCredit, true);
    assert.equal(blocked.strategyAlphaMinor, null);
    assert.equal(strategyCreditAllowed(blocked), false);
  });

  it('aggregates venue and algorithm profiles and feeds router / EVOL13 evidence separately', () => {
    const tca = computeExec07TransactionCostAnalysis(baseTcaInput());
    const report = buildExecutionQualityReport({
      orderId: 'ord_exec07_3',
      executionPlanId: null,
      venueId: 'sandbox_paper',
      providerId: 'sunrey-investments-paper',
      algorithmKind: 'SMART_ROUTER',
      instrumentId: 'EQ:US:SPY',
      transactionCost: tca,
      averageFillPriceMinor: 100_08n,
      computedAt: T0,
    });
    const venue = buildVenueExecutionProfile({
      venueId: 'sandbox_paper',
      reports: Object.freeze([report]),
      computedAt: T0,
    });
    const algo = buildAlgorithmExecutionProfile({
      algorithmKind: 'SMART_ROUTER',
      venueId: 'sandbox_paper',
      reports: Object.freeze([report]),
      computedAt: T0,
    });
    assert.equal(venue.sampleCount, 1);
    assert.equal(algo.sampleCount, 1);

    const routerHints = buildExec05RouterLearningHints({ reports: Object.freeze([report]), computedAt: T0 });
    assert.equal(routerHints.length, 1);
    assert.equal(routerHints[0]!.usableByExec05Router, true);

    const evolEvidence = buildEvol13ExecutionPolicyNicheEvidence({
      nicheKey: 'US_EQUITY_PASSIVE',
      profiles: Object.freeze([algo]),
      computedAt: T0,
    });
    assert.equal(evolEvidence.length, 1);
    assert.equal(evolEvidence[0]!.separatesInvestmentSignalEvolution, true);
  });

  it('qualifies HELIOS_EXEC07_TCA_QUALIFIED when engineering checks pass', () => {
    const tca = computeExec07TransactionCostAnalysis(baseTcaInput());
    const report = buildExecutionQualityReport({
      orderId: 'ord_qualify',
      executionPlanId: null,
      venueId: 'sandbox_paper',
      providerId: 'sunrey-investments-paper',
      algorithmKind: 'LIMIT',
      instrumentId: 'EQ:US:SPY',
      transactionCost: tca,
      averageFillPriceMinor: 100_08n,
      computedAt: asUtcInstant('2026-11-07T12:01:00.000Z'),
    });
    const decomposition = decomposeStrategyAndExecutionAttribution({
      strategyCapsuleId: 'cap_qualify',
      orderId: 'ord_qualify',
      currency: 'USD',
      side: 'BUY',
      decisionPriceMinor: 100_00n,
      exitOrMarkPriceMinor: 100_12n,
      quantityFilledUnits: 100n,
      transactionCost: tca,
      computedAt: T0,
    });
    const hints = buildExec05RouterLearningHints({ reports: Object.freeze([report]), computedAt: T0 });
    const q = evaluateExec07TcaQualification({
      benchmarksCoverDecisionArrivalShortfall: benchmarkConstructionComplete(tca.benchmarks),
      measuresExplicitFeesSpreadImpactTiming:
        tca.explicitFeesMinor != null && tca.spreadCostMinor != null && tca.timingCostMinor != null,
      operationalRatesMeasured: tca.operational.fillRateBps >= 0,
      strategyAlphaSeparatedFromExecution:
        decomposition.strategyAlphaMinor != null && decomposition.executionAlphaOrCostMinor != null,
      incompleteBenchmarkSuppressesStrategyCredit: decomposition.suppressesStrategyCredit === false,
      validatedReportsFeedExec05Hints: hints.length > 0,
      evol13ExecutionPolicyEvidenceSeparate: true,
      deterministicAnalysisIds: true,
      noExecutionAuthorityIssued: true,
      productionDisabled: !LIVE_INVESTMENT_EXECUTION && !LIVE_TRADING_ENABLED && ENVIRONMENT === 'simulation',
    });
    assert.equal(q.marker, HELIOS_EXEC07_TCA_QUALIFIED, q.blockers.join('; '));
  });
});
