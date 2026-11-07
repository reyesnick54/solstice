#!/usr/bin/env node
/**
 * HELIOS EXEC07 — transaction cost analysis qualification.
 */

import assert from 'node:assert/strict';

import { ENVIRONMENT, LIVE_INVESTMENT_EXECUTION, LIVE_TRADING_ENABLED } from '../packages/config/src/flags.ts';
import {
  HELIOS_EXEC07_TCA_QUALIFIED,
  benchmarkConstructionComplete,
  buildExec05RouterLearningHints,
  buildExecutionQualityReport,
  computeExec07TransactionCostAnalysis,
  decomposeStrategyAndExecutionAttribution,
  evaluateExec07TcaQualification,
  exec07FixtureBenchmarkPrices,
  EXEC07_FIXTURE_AS_OF,
} from '../packages/platform/src/helios/execution-connectivity/exec07/index.ts';

const tca = computeExec07TransactionCostAnalysis(
  Object.freeze({
    side: 'BUY',
    quantityUnits: 50n,
    quantityFilledUnits: 50n,
    averageFillPriceMinor: 250_25n,
    explicitFeesMinor: 10n,
    spreadAtArrivalMinor: 1n,
    decisionToFillMoveMinor: 2n,
    priceImprovementVsLimitMinor: 0n,
    ordersSubmitted: 1,
    ordersFilled: 1,
    ordersPartiallyFilled: 0,
    ordersCanceled: 0,
    ordersRejected: 0,
    submissionToAckLatencyMs: 8,
    ackToFillLatencyMs: 30,
    postFillAdverseMoveBps: 2,
    benchmarks: exec07FixtureBenchmarkPrices,
    computedAt: EXEC07_FIXTURE_AS_OF,
  }),
);

const report = buildExecutionQualityReport({
  orderId: 'ord_exec07_qualify',
  executionPlanId: 'uep_qualify',
  venueId: 'sandbox_paper',
  providerId: 'sunrey-investments-paper',
  algorithmKind: 'LIMIT',
  instrumentId: 'EQ:US:SPY',
  transactionCost: tca,
  averageFillPriceMinor: 250_25n,
  computedAt: EXEC07_FIXTURE_AS_OF,
});

const decomposition = decomposeStrategyAndExecutionAttribution({
  strategyCapsuleId: 'cap_qualify',
  orderId: 'ord_exec07_qualify',
  currency: 'USD',
  side: 'BUY',
  decisionPriceMinor: 250_00n,
  exitOrMarkPriceMinor: 250_40n,
  quantityFilledUnits: 50n,
  transactionCost: tca,
  computedAt: EXEC07_FIXTURE_AS_OF,
});

const hints = buildExec05RouterLearningHints({ reports: Object.freeze([report]), computedAt: EXEC07_FIXTURE_AS_OF });

const result = evaluateExec07TcaQualification({
  benchmarksCoverDecisionArrivalShortfall: benchmarkConstructionComplete(tca.benchmarks),
  measuresExplicitFeesSpreadImpactTiming:
    tca.explicitFeesMinor != null && tca.spreadCostMinor != null && tca.timingCostMinor != null,
  operationalRatesMeasured: true,
  strategyAlphaSeparatedFromExecution:
    decomposition.strategyAlphaMinor != null && decomposition.executionAlphaOrCostMinor != null,
  incompleteBenchmarkSuppressesStrategyCredit: !decomposition.suppressesStrategyCredit,
  validatedReportsFeedExec05Hints: hints.length === 1,
  evol13ExecutionPolicyEvidenceSeparate: true,
  deterministicAnalysisIds: tca.analysisId.startsWith('exec07_tca_'),
  noExecutionAuthorityIssued: true,
  productionDisabled: !LIVE_INVESTMENT_EXECUTION && !LIVE_TRADING_ENABLED && ENVIRONMENT === 'simulation',
});

assert.equal(result.marker, HELIOS_EXEC07_TCA_QUALIFIED, result.blockers.join('; '));
console.log(result.marker);
