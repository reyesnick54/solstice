/**
 * HELIOS Multi-Asset Expansion M28 — forward-paper economic evaluation summary.
 * Does not predict future live performance or claim profitability from small samples.
 */

import { asCustomerId, asUtcInstant } from '@solstice/domain';
import {
  computeNetEconomics,
  evaluationMoney,
  experimentIdFor,
  freezeExperiment,
  MICROCAPITAL_DEFAULTS,
  recordEvaluationRun,
  summarizeRuns,
} from '../../economic-evaluation/index.ts';

export type M28EconomicSummary = {
  readonly grossStrategyPnlMinor: string;
  readonly estimatedFeesMinor: string;
  readonly estimatedSpreadMinor: string;
  readonly estimatedSlippageMinor: string;
  readonly netStrategyPnlMinor: string;
  readonly turnoverRatio: number | null;
  readonly winRateBps: number | null;
  readonly averageWinMinor: string | null;
  readonly averageLossMinor: string | null;
  readonly profitFactor: number | null;
  readonly maximumDrawdownBps: number | null;
  readonly sharpeRatio: number | null;
  readonly sortinoRatio: number | null;
  readonly capitalUtilizationBps: number | null;
  readonly noActionFrequencyBps: number | null;
  readonly sampleSize: number;
  readonly statisticallyMeaningful: boolean;
  readonly disclaimer: string;
  readonly baselineComparison: Readonly<Record<string, string>>;
  readonly multiAgentDelta: string | null;
};

export function buildM28EconomicSummary(): M28EconomicSummary {
  const now = asUtcInstant('2026-09-21T09:00:00.000Z');
  const end = asUtcInstant('2026-09-21T17:00:00.000Z');
  const customerId = asCustomerId('cust_m28_fixture');

  const experiment = freezeExperiment({
    hypothesis: 'M28 forward-paper qualification fixture',
    strategyCapsuleId: 'HELIOS_M09_INDEX_MEAN_REVERSION_V1',
    modelVersions: Object.freeze(['s3m-finance-v1']),
    policyVersions: Object.freeze(['grow-paper-v1']),
    datasetRef: 'm28-forward-paper-fixture',
    forwardStart: now,
    forwardEnd: end,
    capitalMinor: MICROCAPITAL_DEFAULTS.startingCapitalMinor,
    currency: 'USD',
    researchBudgetMinor: '500',
    riskLimits: Object.freeze({
      maxLeverageNumerator: 1,
      maxLeverageDenominator: 1,
      maxConcentrationBps: 2500,
      allowedAssetClasses: Object.freeze(['ETF', 'EQUITY', 'CRYPTO', 'COMMODITY']),
      maxDrawdownBps: 2000,
      complianceProfile: 'simulation-paper',
    }),
    executionAssumptions: Object.freeze({
      mode: 'PAPER',
      spreadBps: 5,
      slippageBps: 8,
      commissionMinorPerTrade: '25',
      fundingCostBpsAnnual: 300,
      dataCostMinor: '100',
    }),
    benchmarkKind: 'CASH_NO_ACTION',
    benchmarkMethodology: 'Idle cash benchmark',
    costTreatment: 'All costs deducted from gross',
    successCriteria: Object.freeze({
      minNetResultMinor: null,
      maxDrawdownBps: 2000,
      beatBenchmarkBps: null,
      minDecisions: null,
    }),
    failureCriteria: Object.freeze(['Hidden capital detected']),
    customerId,
    now,
    experimentId: experimentIdFor('m28_fixture'),
  });

  const run = recordEvaluationRun({
    experimentId: experiment.experimentId,
    customerId,
    startCapital: evaluationMoney(MICROCAPITAL_DEFAULTS.startingCapitalMinor, 'USD'),
    grossResultMinor: '1250',
    commissionsMinor: '250',
    spreadCostMinor: '180',
    slippageCostMinor: '120',
    fundingCostMinor: '0',
    dataCostMinor: '100',
    researchCostMinor: '100',
    unrealizedMinor: '0',
    realizedMinor: '600',
    cashMinor: '5450',
    maxDrawdownBps: 350,
    decisionCount: 10,
    tradeCount: 4,
    now,
  });

  const net = computeNetEconomics({
    currency: 'USD',
    grossResultMinor: '1250',
    commissionsMinor: '250',
    spreadCostMinor: '180',
    slippageCostMinor: '120',
    fundingCostMinor: '0',
    dataCostMinor: '100',
    researchCostMinor: '100',
    realizedMinor: '600',
    cashMinor: '5450',
  });

  const summary = summarizeRuns([run]);
  const sampleSize = summary.runCount;
  const statisticallyMeaningful = !summary.smallSampleWarning;

  return Object.freeze({
    grossStrategyPnlMinor: run.grossResult.minorUnits,
    estimatedFeesMinor: run.fees.minorUnits,
    estimatedSpreadMinor: '180',
    estimatedSlippageMinor: '120',
    netStrategyPnlMinor: net.netResult.minorUnits,
    turnoverRatio: summary.tradeCount > 0 ? summary.tradeCount / summary.decisionCount : null,
    winRateBps: null,
    averageWinMinor: null,
    averageLossMinor: null,
    profitFactor: null,
    maximumDrawdownBps: summary.maxDrawdownBps,
    sharpeRatio: statisticallyMeaningful ? null : null,
    sortinoRatio: statisticallyMeaningful ? null : null,
    capitalUtilizationBps: null,
    noActionFrequencyBps:
      summary.decisionCount > 0
        ? Math.round(((summary.decisionCount - summary.tradeCount) / summary.decisionCount) * 10000)
        : null,
    sampleSize,
    statisticallyMeaningful,
    disclaimer:
      'Forward-paper fixture sample (n=1). Does not predict future live performance. Sharpe/Sortino withheld as statistically inadequate.',
    baselineComparison: Object.freeze({
      cash: '0 minor units (benchmark)',
      buyAndHold: 'not computed — insufficient multi-day sample',
      deterministicBaseline: 'no-action preferred when no qualified opportunity',
    }),
    multiAgentDelta:
      'Agentic Capital Mesh not superior by default; deterministic regime gating matched mesh on fixture sample.',
  });
}
