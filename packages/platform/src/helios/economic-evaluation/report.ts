import { randomUUID } from 'node:crypto';

import type { UtcInstant } from '../../../../domain/src/time.ts';
import { buildIntelligenceComparison, compareToBenchmark } from './baseline-comparison.ts';
import { buildCalibrationBins } from './calibration.ts';
import { evaluateNoActionValue } from './no-action.ts';
import { computeNetEconomics } from './net-economics.ts';
import {
  buildCapitalEfficiency,
  buildContinuousCoverage,
  buildDecisionLatency,
  buildDiscoveryLatency,
  buildExecutionQuality,
} from './performance-metrics.ts';
import { summarizeRuns } from './statistics.ts';
import type {
  EconomicEvaluationReport,
  EvaluationRunRecord,
  FrozenExperimentSpec,
  MicrocapitalChallengeSpec,
  ResearchCostLine,
  TrackBEconomicActivity,
} from './types.ts';
import type { IntelligenceBaseline } from './taxonomy.ts';

export type BuildReportInput = {
  readonly experiment: FrozenExperimentSpec;
  readonly microcapitalChallenge: MicrocapitalChallengeSpec | null;
  readonly runs: readonly EvaluationRunRecord[];
  readonly researchCosts: readonly ResearchCostLine[];
  readonly trackBActivities?: readonly TrackBEconomicActivity[];
  readonly benchmarkNetMinor: string;
  readonly intelligenceComparisonSeed?: readonly {
    readonly baseline: IntelligenceBaseline;
    readonly researchBudgetMinor: string;
    readonly netResultMinor: string;
    readonly decisionCount: number;
  }[];
  readonly calibrationPredictions?: readonly { readonly confidenceBps: number; readonly succeeded: boolean }[];
  readonly noAction?: { readonly candidatesRejected: number; readonly observedLaterResultMinor: string | null };
  readonly coverage?: Parameters<typeof buildContinuousCoverage>[0];
  readonly discoveryLatency?: Parameters<typeof buildDiscoveryLatency>[0];
  readonly decisionLatency?: Parameters<typeof buildDecisionLatency>[0];
  readonly executionQuality?: Parameters<typeof buildExecutionQuality>[0];
  readonly capitalEfficiency?: Parameters<typeof buildCapitalEfficiency>[0];
  readonly costBreakdown?: {
    readonly spreadCostMinor: string;
    readonly slippageCostMinor: string;
    readonly fundingCostMinor: string;
    readonly dataCostMinor: string;
  };
  readonly failurePeriods?: readonly { readonly start: UtcInstant; readonly end: UtcInstant; readonly reason: string }[];
  readonly limitations?: readonly string[];
  readonly now: UtcInstant;
};

export function buildEconomicEvaluationReport(input: BuildReportInput): EconomicEvaluationReport {
  const currency = input.experiment.capital.currency;
  const latest = input.runs[input.runs.length - 1];
  const aggregateGross = input.runs.reduce((acc, row) => acc + BigInt(row.grossResult.minorUnits), 0n).toString();
  const aggregateResearch = input.runs.reduce((acc, row) => acc + BigInt(row.researchCost.minorUnits), 0n).toString();
  const aggregateFees = input.runs.reduce((acc, row) => acc + BigInt(row.fees.minorUnits), 0n).toString();
  const aggregateRealized = input.runs.reduce((acc, row) => acc + BigInt(row.realizableNetValue.minorUnits), 0n).toString();
  const costs = input.costBreakdown ?? {
    spreadCostMinor: '0',
    slippageCostMinor: '0',
    fundingCostMinor: '0',
    dataCostMinor: '0',
  };
  const netEconomics = computeNetEconomics({
    currency,
    grossResultMinor: aggregateGross,
    commissionsMinor: aggregateFees,
    spreadCostMinor: costs.spreadCostMinor,
    slippageCostMinor: costs.slippageCostMinor,
    fundingCostMinor: costs.fundingCostMinor,
    dataCostMinor: costs.dataCostMinor,
    researchCostMinor: aggregateResearch,
    realizedMinor: aggregateRealized,
    cashMinor: latest?.realizableNetValue.minorUnits ?? '0',
  });
  const stats = summarizeRuns(input.runs);
  return Object.freeze({
    schema: 'sunrey.helios.economic-evaluation-report.v1',
    reportId: `herep_${randomUUID()}`,
    generatedAt: input.now,
    experiment: input.experiment,
    microcapitalChallenge: input.microcapitalChallenge,
    runs: Object.freeze([...input.runs]),
    coverage: buildContinuousCoverage(
      input.coverage ?? {
        approvedInstrumentsMonitored: 0,
        approvedSourcesMonitored: 0,
        marketSessionsCovered: 0,
        outageDurationMs: 0,
        coverageGapsMs: [],
      },
    ),
    discoveryLatency: buildDiscoveryLatency(
      input.discoveryLatency ?? {
        sourceToDetectionMs: [],
        detectionToVerificationMs: [],
        verificationToCandidateMs: [],
      },
    ),
    decisionLatency: buildDecisionLatency(
      input.decisionLatency ?? {
        candidateToResearchMs: [],
        researchToDecisionValidityMs: [],
        decisionValidityToRiskMs: [],
        riskToProposalMs: [],
      },
    ),
    executionQuality: buildExecutionQuality(
      input.executionQuality ?? {
        submissionToAckMs: [],
        ackToFillMs: [],
        spreadBpsSamples: [],
        slippageBpsSamples: [],
        adverseSelectionBps: 0,
        completed: 0,
        rejected: 0,
        total: 0,
      },
    ),
    netEconomics,
    capitalEfficiency: buildCapitalEfficiency(
      input.capitalEfficiency ?? {
        currency,
        deployedMinor: latest?.startCapital.minorUnits ?? '0',
        idleCashMinor: '0',
        reservedCashMinor: '0',
        maxDrawdownBps: stats.maxDrawdownBps,
        concentrationBps: 0,
        turnoverBps: 0,
        liquidityRatioBps: 0,
      },
    ),
    researchCosts: Object.freeze([...input.researchCosts]),
    benchmarkComparison: compareToBenchmark({
      currency,
      benchmarkKind: input.experiment.benchmark.kind,
      methodology: input.experiment.benchmark.methodology,
      benchmarkNetMinor: input.benchmarkNetMinor,
      subjectNetMinor: latest?.netResult.minorUnits ?? '0',
    }),
    intelligenceComparison: buildIntelligenceComparison({
      currency,
      normalizedBudgetMinor: input.experiment.researchBudget.minorUnits,
      rows: input.intelligenceComparisonSeed ?? [],
    }),
    calibration: buildCalibrationBins(input.calibrationPredictions ?? []),
    noActionEvaluation: evaluateNoActionValue(
      input.noAction ?? { candidatesRejected: 0, observedLaterResultMinor: null },
    ),
    trackBActivities: Object.freeze([...(input.trackBActivities ?? [])]),
    statisticalSummary: stats,
    failurePeriods: Object.freeze([...(input.failurePeriods ?? [])]),
    limitations: Object.freeze([
      'Forward evaluation preferred; historical backtest is supporting evidence only.',
      'PERFORMANCE_CLAIM_ALLOWED remains false unless external governance authorizes marketing claims.',
      ...(input.limitations ?? []),
    ]),
    PERFORMANCE_CLAIM_ALLOWED: false,
  });
}
