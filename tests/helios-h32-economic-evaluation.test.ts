/**
 * HELIOS H32 — economic evaluation and Microcapital Challenge.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { FrozenClock } from '../packages/config/src/clock.ts';
import { asCustomerId } from '../packages/domain/src/customer.ts';
import { asUtcInstant } from '../packages/domain/src/time.ts';
import {
  assertRiskLimitsImmutable,
  assertRunPersists,
  buildEconomicEvaluationReport,
  buildIntelligenceComparison,
  buildMicrocapitalChallenge,
  challengeProgressBps,
  compareToBenchmark,
  computeNetEconomics,
  detectHiddenCapital,
  EVALUATION_RULE_FLAGS,
  evaluationMoney,
  evaluateNoActionValue,
  experimentIdFor,
  freezeExperiment,
  HeliosEconomicEvaluationService,
  InMemoryHeliosEconomicEvaluationStore,
  MICROCAPITAL_DEFAULTS,
  noActionMustNotInflateNetResult,
  normalizeBaselineBudget,
  principalExcludedGrowth,
  recordEvaluationRun,
  rejectRetroactiveTargetChange,
  summarizeRuns,
} from '../packages/platform/src/helios/economic-evaluation/index.ts';
import { lintHeliosBoundary } from '../tools/architectural-linter/src/helios-guards.ts';

const NOW = asUtcInstant('2026-09-18T09:00:00.000Z');
const END = asUtcInstant('2027-09-18T09:00:00.000Z');
const CUSTOMER_A = asCustomerId('cust_h32_a');
const CUSTOMER_B = asCustomerId('cust_h32_b');

const DEFAULT_RISK = Object.freeze({
  maxLeverageNumerator: 1,
  maxLeverageDenominator: 1,
  maxConcentrationBps: 2500,
  allowedAssetClasses: Object.freeze(['ETF', 'EQUITY']),
  maxDrawdownBps: 2000,
  complianceProfile: 'simulation-paper',
});

const DEFAULT_EXEC = Object.freeze({
  mode: 'PAPER' as const,
  spreadBps: 5,
  slippageBps: 8,
  commissionMinorPerTrade: '25',
  fundingCostBpsAnnual: 300,
  dataCostMinor: '100',
});

function draftExperiment(customerId: typeof CUSTOMER_A, suffix: string) {
  return freezeExperiment({
    hypothesis: `H32 qualification ${suffix}`,
    strategyCapsuleId: `scap_${suffix}`,
    modelVersions: Object.freeze(['s3m-finance-v1']),
    policyVersions: Object.freeze(['grow-paper-v1']),
    datasetRef: 'forward-shadow-2026-q4',
    forwardStart: NOW,
    forwardEnd: END,
    capitalMinor: MICROCAPITAL_DEFAULTS.startingCapitalMinor,
    currency: 'USD',
    researchBudgetMinor: '1000',
    riskLimits: DEFAULT_RISK,
    executionAssumptions: DEFAULT_EXEC,
    benchmarkKind: 'CASH_NO_ACTION',
    benchmarkMethodology: 'Idle cash benchmark with zero return',
    costTreatment: 'All operating and economically allocated costs deducted from gross',
    successCriteria: Object.freeze({
      minNetResultMinor: null,
      maxDrawdownBps: 2000,
      beatBenchmarkBps: 0,
      minDecisions: 1,
    }),
    failureCriteria: Object.freeze(['Hidden capital detected', 'Risk limit breach']),
    customerId,
    now: NOW,
    experimentId: experimentIdFor(`qual_${suffix}`),
  });
}

function baseRunInput(experimentId: ReturnType<typeof experimentIdFor>, customerId: typeof CUSTOMER_A) {
  return {
    experimentId,
    customerId,
    startCapital: evaluationMoney(MICROCAPITAL_DEFAULTS.startingCapitalMinor, 'USD'),
    grossResultMinor: '500',
    commissionsMinor: '25',
    spreadCostMinor: '10',
    slippageCostMinor: '12',
    fundingCostMinor: '5',
    dataCostMinor: '100',
    researchCostMinor: '250',
    unrealizedMinor: '100',
    realizedMinor: '98',
    cashMinor: '4902',
    maxDrawdownBps: 500,
    decisionCount: 3,
    tradeCount: 2,
  };
}

describe('HELIOS H32 economic evaluation and microcapital challenge', () => {
  it('passes HELIOS boundary lint', () => {
    assert.deepEqual(lintHeliosBoundary(process.cwd()), []);
  });

  it('1. detects hidden deposit / hidden capital', () => {
    const findings = detectHiddenCapital({
      startCapital: evaluationMoney('5000', 'USD'),
      endingCapital: evaluationMoney('7000', 'USD'),
      declaredDeposits: [],
      netResultMinor: '500',
      researchCostMinor: '0',
    });
    assert.equal(findings.some((row) => row.detected && row.kind === 'ADDITIONAL_DEPOSIT'), true);
  });

  it('2. excludes principal deposits from growth', () => {
    const growth = principalExcludedGrowth({
      startCapitalMinor: '5000',
      endingCapitalMinor: '8000',
      additionalDepositsMinor: ['2000'],
    });
    assert.equal(growth.growthMinor, '1000');
    assert.equal(growth.principalExcluded, true);
  });

  it('3. includes fees in net economics', () => {
    const net = computeNetEconomics({
      currency: 'USD',
      grossResultMinor: '1000',
      commissionsMinor: '100',
      spreadCostMinor: '0',
      slippageCostMinor: '0',
      fundingCostMinor: '0',
      dataCostMinor: '0',
      researchCostMinor: '0',
      realizedMinor: '900',
      cashMinor: '900',
    });
    assert.equal(net.netResult.minorUnits, '900');
    assert.equal(net.commissions.minorUnits, '100');
  });

  it('4. includes spread and slippage in net economics', () => {
    const net = computeNetEconomics({
      currency: 'USD',
      grossResultMinor: '1000',
      commissionsMinor: '0',
      spreadCostMinor: '40',
      slippageCostMinor: '60',
      fundingCostMinor: '0',
      dataCostMinor: '0',
      researchCostMinor: '0',
      realizedMinor: '900',
      cashMinor: '900',
    });
    assert.equal(net.netResult.minorUnits, '900');
    assert.equal(net.spreadCost.minorUnits, '40');
    assert.equal(net.slippageCost.minorUnits, '60');
  });

  it('5. accounts for research cost', () => {
    const net = computeNetEconomics({
      currency: 'USD',
      grossResultMinor: '1000',
      commissionsMinor: '0',
      spreadCostMinor: '0',
      slippageCostMinor: '0',
      fundingCostMinor: '0',
      dataCostMinor: '0',
      researchCostMinor: '250',
      realizedMinor: '750',
      cashMinor: '750',
    });
    assert.equal(net.researchCost.minorUnits, '250');
    assert.equal(net.netResult.minorUnits, '750');
  });

  it('6. separates Track A and Track B reporting', () => {
    const experiment = draftExperiment(CUSTOMER_A, 'track');
    const challenge = buildMicrocapitalChallenge({ experiment, now: NOW });
    const trackA = recordEvaluationRun({
      ...baseRunInput(experiment.experimentId, CUSTOMER_A),
      track: 'TRACK_A_INVESTMENT',
      now: NOW,
    });
    const report = buildEconomicEvaluationReport({
      experiment,
      microcapitalChallenge: challenge,
      runs: [trackA],
      researchCosts: [],
      benchmarkNetMinor: '0',
      trackBActivities: [
        Object.freeze({
          activityId: 'act_1',
          revenueReceived: evaluationMoney('500', 'USD'),
          directDeliveryCost: evaluationMoney('100', 'USD'),
          platformCost: evaluationMoney('50', 'USD'),
          researchCost: evaluationMoney('25', 'USD'),
          netEconomicValue: evaluationMoney('325', 'USD'),
          labeledAsInvestmentPnl: false,
        }),
      ],
      now: NOW,
    });
    assert.equal(trackA.track, 'TRACK_A_INVESTMENT');
    assert.equal(report.trackBActivities.length, 1);
    assert.equal(report.trackBActivities[0]?.labeledAsInvestmentPnl, false);
    assert.notEqual(report.netEconomics.netResult.minorUnits, report.trackBActivities[0]?.netEconomicValue.minorUnits);
  });

  it('7. keeps risk limits immutable during challenge when behind schedule', () => {
    const experiment = draftExperiment(CUSTOMER_A, 'risk');
    const challenge = buildMicrocapitalChallenge({ experiment, now: NOW });
    const loosened = Object.freeze({
      ...DEFAULT_RISK,
      maxConcentrationBps: 5000,
    });
    const result = assertRiskLimitsImmutable({
      original: challenge.riskLimits,
      proposed: loosened,
      challengeBehindSchedule: true,
    });
    assert.equal(result.ok, false);
    assert.match(result.error ?? '', /catch-up mode forbidden/i);
  });

  it('8. persists failed runs without deletion', () => {
    const experiment = draftExperiment(CUSTOMER_A, 'failed');
    const failed = recordEvaluationRun({
      ...baseRunInput(experiment.experimentId, CUSTOMER_A),
      outcome: 'FAILED',
      failedStrategies: Object.freeze(['scap_broken']),
      limitations: Object.freeze(['Provider outage during session']),
      now: NOW,
    });
    assert.equal(failed.outcome, 'FAILED');
    assert.equal(failed.deleted, false);
    assertRunPersists(failed);
    const store = new InMemoryHeliosEconomicEvaluationStore();
    store.appendRun(failed);
    assert.equal(store.listRuns(experiment.experimentId).length, 1);
  });

  it('9. compares subject net result to benchmark', () => {
    const comparison = compareToBenchmark({
      currency: 'USD',
      benchmarkKind: 'BUY_AND_HOLD',
      methodology: 'Equal-weight buy-and-hold SIM-ETF-1',
      benchmarkNetMinor: '200',
      subjectNetMinor: '148',
    });
    assert.equal(comparison.excessNetResult.minorUnits, '-52');
    assert.equal(comparison.benchmarkKind, 'BUY_AND_HOLD');
  });

  it('10. normalizes agent baseline budgets for intelligence comparison', () => {
    const rows = buildIntelligenceComparison({
      currency: 'USD',
      normalizedBudgetMinor: '1000',
      rows: [
        {
          baseline: 'DETERMINISTIC',
          researchBudgetMinor: '500',
          netResultMinor: '100',
          decisionCount: 5,
        },
        {
          baseline: 'FULL_HELIOS',
          researchBudgetMinor: '2000',
          netResultMinor: '400',
          decisionCount: 12,
        },
      ],
    });
    assert.equal(rows[0]?.budgetNormalized, true);
    assert.equal(rows[1]?.budgetNormalized, true);
    assert.equal(rows[0]?.netResult.minorUnits, '200');
    assert.equal(rows[1]?.netResult.minorUnits, '200');
  });

  it('11. does not count no-action avoided losses as realized profit', () => {
    const noAction = evaluateNoActionValue({
      candidatesRejected: 4,
      observedLaterResultMinor: '-300',
    });
    const adjusted = noActionMustNotInflateNetResult({
      netResultMinor: '150',
      noAction,
    });
    assert.equal(noAction.countedAsRealizedProfit, false);
    assert.equal(adjusted.adjustedNetMinor, '150');
    assert.equal(adjusted.avoidedLossNotCountedAsProfit, true);
  });

  it('12. computes realizable net value separately from mark-to-market', () => {
    const net = computeNetEconomics({
      currency: 'USD',
      grossResultMinor: '1200',
      commissionsMinor: '25',
      spreadCostMinor: '10',
      slippageCostMinor: '15',
      fundingCostMinor: '5',
      dataCostMinor: '100',
      researchCostMinor: '250',
      realizedMinor: '500',
      cashMinor: '5000',
    });
    assert.equal(net.realizableNetValue.minorUnits, '5500');
    assert.notEqual(net.realizableNetValue.minorUnits, net.grossResult.minorUnits);
  });

  it('13. supports restart/resume of official experiment', () => {
    const clock = new FrozenClock(NOW);
    const service = new HeliosEconomicEvaluationService({ clock });
    const experiment = service.createExperiment({
      hypothesis: 'resume test',
      modelVersions: Object.freeze(['s3m-v1']),
      policyVersions: Object.freeze(['p1']),
      datasetRef: 'ds1',
      forwardStart: NOW,
      forwardEnd: END,
      capitalMinor: '5000',
      currency: 'USD',
      researchBudgetMinor: '1000',
      riskLimits: DEFAULT_RISK,
      executionAssumptions: DEFAULT_EXEC,
      benchmarkKind: 'CASH_NO_ACTION',
      benchmarkMethodology: 'cash',
      costTreatment: 'full',
      successCriteria: Object.freeze({
        minNetResultMinor: null,
        maxDrawdownBps: null,
        beatBenchmarkBps: null,
        minDecisions: null,
      }),
      failureCriteria: Object.freeze([]),
      customerId: CUSTOMER_A,
      now: NOW,
    });
    const started = service.startExperiment(experiment.experimentId);
    assert.equal(started.ok, true);
    const paused = service.pauseExperiment(experiment.experimentId);
    assert.equal(paused.ok, true);
    if (paused.ok) {
      assert.equal(paused.value.state, 'PAUSED');
    }
    const resumed = service.resumeExperiment(experiment.experimentId);
    assert.equal(resumed.ok, true);
    if (resumed.ok) {
      assert.equal(resumed.value.state, 'RUNNING');
    }
  });

  it('14. enforces customer isolation', () => {
    const clock = new FrozenClock(NOW);
    const service = new HeliosEconomicEvaluationService({ clock });
    const experiment = service.createExperiment({
      hypothesis: 'isolation',
      modelVersions: Object.freeze(['s3m-v1']),
      policyVersions: Object.freeze(['p1']),
      datasetRef: 'ds1',
      forwardStart: NOW,
      forwardEnd: END,
      capitalMinor: '5000',
      currency: 'USD',
      researchBudgetMinor: '1000',
      riskLimits: DEFAULT_RISK,
      executionAssumptions: DEFAULT_EXEC,
      benchmarkKind: 'CASH_NO_ACTION',
      benchmarkMethodology: 'cash',
      costTreatment: 'full',
      successCriteria: Object.freeze({
        minNetResultMinor: null,
        maxDrawdownBps: null,
        beatBenchmarkBps: null,
        minDecisions: null,
      }),
      failureCriteria: Object.freeze([]),
      customerId: CUSTOMER_A,
      now: NOW,
    });
    assert.throws(
      () =>
        service.recordRun({
          ...baseRunInput(experiment.experimentId, CUSTOMER_B),
        }),
      /customer isolation violation/,
    );
    assert.equal(service.listRunsForCustomer(CUSTOMER_B).length, 0);
  });

  it('15. reporting includes negative results and failed runs', () => {
    const experiment = draftExperiment(CUSTOMER_A, 'negative');
    const losing = recordEvaluationRun({
      ...baseRunInput(experiment.experimentId, CUSTOMER_A),
      grossResultMinor: '-800',
      realizedMinor: '-800',
      cashMinor: '4200',
      outcome: 'FAILED',
      now: NOW,
    });
    const report = buildEconomicEvaluationReport({
      experiment,
      microcapitalChallenge: null,
      runs: [losing],
      researchCosts: [],
      benchmarkNetMinor: '0',
      now: NOW,
    });
    assert.ok(BigInt(report.netEconomics.netResult.minorUnits) < 0n);
    assert.equal(report.runs[0]?.outcome, 'FAILED');
    assert.equal(report.PERFORMANCE_CLAIM_ALLOWED, false);
  });

  it('16. emits small sample warning when run/decision count is low', () => {
    const experiment = draftExperiment(CUSTOMER_A, 'sample');
    const run = recordEvaluationRun({
      ...baseRunInput(experiment.experimentId, CUSTOMER_A),
      decisionCount: 2,
      now: NOW,
    });
    const summary = summarizeRuns([run]);
    assert.equal(summary.smallSampleWarning, true);
    assert.ok(summary.minimumSampleForSignificance >= 30);
  });

  it('qualification run: microcapital challenge $50→$5000 experiment target with full report', () => {
    const clock = new FrozenClock(NOW);
    const service = new HeliosEconomicEvaluationService({ clock });
    const experiment = service.createExperiment({
      hypothesis: 'Specialist mesh improves net economics after all costs',
      strategyCapsuleId: 'scap_h32_qual',
      modelVersions: Object.freeze(['s3m-finance-v1', 'grok-research-v1']),
      policyVersions: Object.freeze(['grow-paper-v1', 'meta-allocator-v1']),
      datasetRef: 'forward-paper-2026-q4',
      forwardStart: NOW,
      forwardEnd: END,
      capitalMinor: MICROCAPITAL_DEFAULTS.startingCapitalMinor,
      currency: 'USD',
      researchBudgetMinor: '1000',
      riskLimits: DEFAULT_RISK,
      executionAssumptions: DEFAULT_EXEC,
      benchmarkKind: 'SINGLE_AGENT',
      benchmarkMethodology: 'Single-agent baseline with equal research budget',
      costTreatment: 'Operating and economically allocated research/model/data costs deducted',
      successCriteria: Object.freeze({
        minNetResultMinor: null,
        maxDrawdownBps: 2000,
        beatBenchmarkBps: 0,
        minDecisions: 1,
      }),
      failureCriteria: Object.freeze(['Hidden capital', 'Risk breach', 'Catch-up mode']),
      customerId: CUSTOMER_A,
      now: NOW,
    });
    service.startExperiment(experiment.experimentId);
    const challengeResult = service.createMicrocapitalChallenge({
      experimentId: experiment.experimentId,
    });
    assert.equal(challengeResult.ok, true);
    if (!challengeResult.ok) {
      return;
    }
    const challenge = challengeResult.value;
    assert.equal(challenge.startingCapital.minorUnits, '5000');
    assert.equal(challenge.targetCapital.minorUnits, '500000');
    assert.equal(challenge.targetIsExperimentOnly, true);
    assert.equal(challenge.notGuaranteed, true);
    assert.equal(challenge.catchUpModeForbidden, true);

    const run = service.recordRun({
      ...baseRunInput(experiment.experimentId, CUSTOMER_A),
      track: 'TRACK_A_INVESTMENT',
      grossResultMinor: '350',
      spreadCostMinor: '10',
      slippageCostMinor: '12',
      researchCostMinor: '250',
      maxDrawdownBps: 400,
      decisionCount: 5,
      tradeCount: 3,
    });
    const progress = challengeProgressBps({
      startingMinor: challenge.startingCapital.minorUnits,
      currentMinor: run.endingCapital.minorUnits,
      targetMinor: challenge.targetCapital.minorUnits,
    });
    assert.ok(progress >= 0 && progress < 10000);

    const report = service.generateReport({
      experiment: service.store.getExperiment(experiment.experimentId)!,
      microcapitalChallenge: challenge,
      runs: [run],
      researchCosts: service.defaultResearchCosts(experiment),
      benchmarkNetMinor: '100',
      intelligenceComparisonSeed: [
        {
          baseline: 'DETERMINISTIC',
          researchBudgetMinor: '1000',
          netResultMinor: '50',
          decisionCount: 5,
        },
        {
          baseline: 'SINGLE_AGENT',
          researchBudgetMinor: '1000',
          netResultMinor: '100',
          decisionCount: 5,
        },
        {
          baseline: 'SPECIALIST_MESH',
          researchBudgetMinor: '1000',
          netResultMinor: run.netResult.minorUnits,
          decisionCount: 5,
        },
      ],
      costBreakdown: {
        spreadCostMinor: '10',
        slippageCostMinor: '12',
        fundingCostMinor: '5',
        dataCostMinor: '100',
      },
      coverage: {
        approvedInstrumentsMonitored: 3,
        approvedSourcesMonitored: 2,
        marketSessionsCovered: 1,
        outageDurationMs: 0,
        coverageGapsMs: [0],
      },
      discoveryLatency: {
        sourceToDetectionMs: [120, 180, 250],
        detectionToVerificationMs: [300, 450],
        verificationToCandidateMs: [500, 700, 900],
      },
      decisionLatency: {
        candidateToResearchMs: [1000, 1500],
        researchToDecisionValidityMs: [800],
        decisionValidityToRiskMs: [400],
        riskToProposalMs: [200],
      },
      executionQuality: {
        submissionToAckMs: [50, 75],
        ackToFillMs: [200, 350],
        spreadBpsSamples: [5, 6],
        slippageBpsSamples: [8, 9],
        adverseSelectionBps: 12,
        completed: 2,
        rejected: 1,
        total: 3,
      },
      calibrationPredictions: [
        { confidenceBps: 7000, succeeded: true },
        { confidenceBps: 7000, succeeded: false },
        { confidenceBps: 7000, succeeded: true },
      ],
      noAction: { candidatesRejected: 2, observedLaterResultMinor: '-120' },
    });

    assert.equal(report.schema, 'sunrey.helios.economic-evaluation-report.v1');
    assert.equal(report.PERFORMANCE_CLAIM_ALLOWED, false);
    assert.equal(EVALUATION_RULE_FLAGS.PERFORMANCE_CLAIM_ALLOWED, false);
    assert.equal(report.runs.length, 1);
    assert.equal(report.benchmarkComparison.benchmarkKind, 'SINGLE_AGENT');
    assert.equal(report.intelligenceComparison.length, 3);
    assert.equal(report.noActionEvaluation.countedAsRealizedProfit, false);
    assert.equal(report.statisticalSummary.smallSampleWarning, true);

    const mutation = rejectRetroactiveTargetChange({
      original: experiment,
      updatedSuccessCriteria: Object.freeze({
        minNetResultMinor: '500000',
        maxDrawdownBps: 2000,
        beatBenchmarkBps: 0,
        minDecisions: 1,
      }),
    });
    assert.equal(mutation.ok, false);

    const normalized = normalizeBaselineBudget({
      baselineBudgetMinor: '2000',
      subjectBudgetMinor: '1000',
      baselineNetMinor: '400',
      currency: 'USD',
    });
    assert.equal(normalized.budgetNormalized, true);
  });
});
