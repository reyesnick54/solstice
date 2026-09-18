import type {
  CapitalEfficiencyMetrics,
  ContinuousCoverageMetrics,
  DecisionLatencyMetrics,
  DiscoveryLatencyMetrics,
  ExecutionQualityMetrics,
  LatencyPercentiles,
} from './types.ts';
import { evaluationMoney } from './money.ts';

function percentiles(valuesMs: readonly number[]): LatencyPercentiles {
  if (valuesMs.length === 0) {
    return Object.freeze({ p50Ms: 0, p95Ms: 0, p99Ms: 0, sampleCount: 0 });
  }
  const sorted = [...valuesMs].sort((a, b) => a - b);
  const pick = (pct: number) => sorted[Math.min(sorted.length - 1, Math.floor((pct / 100) * sorted.length))] ?? 0;
  return Object.freeze({
    p50Ms: pick(50),
    p95Ms: pick(95),
    p99Ms: pick(99),
    sampleCount: sorted.length,
  });
}

export function buildContinuousCoverage(input: {
  readonly approvedInstrumentsMonitored: number;
  readonly approvedSourcesMonitored: number;
  readonly marketSessionsCovered: number;
  readonly outageDurationMs: number;
  readonly coverageGapsMs: readonly number[];
}): ContinuousCoverageMetrics {
  return Object.freeze({
    approvedInstrumentsMonitored: input.approvedInstrumentsMonitored,
    approvedSourcesMonitored: input.approvedSourcesMonitored,
    marketSessionsCovered: input.marketSessionsCovered,
    outageDurationMs: input.outageDurationMs,
    coverageGapCount: input.coverageGapsMs.length,
    coverageGapMs: input.coverageGapsMs.reduce((acc, row) => acc + row, 0),
  });
}

export function buildDiscoveryLatency(input: {
  readonly sourceToDetectionMs: readonly number[];
  readonly detectionToVerificationMs: readonly number[];
  readonly verificationToCandidateMs: readonly number[];
}): DiscoveryLatencyMetrics {
  return Object.freeze({
    sourceArrivalToDetection: percentiles(input.sourceToDetectionMs),
    detectionToEvidenceVerification: percentiles(input.detectionToVerificationMs),
    verificationToCandidate: percentiles(input.verificationToCandidateMs),
  });
}

export function buildDecisionLatency(input: {
  readonly candidateToResearchMs: readonly number[];
  readonly researchToDecisionValidityMs: readonly number[];
  readonly decisionValidityToRiskMs: readonly number[];
  readonly riskToProposalMs: readonly number[];
}): DecisionLatencyMetrics {
  return Object.freeze({
    candidateToResearch: percentiles(input.candidateToResearchMs),
    researchToDecisionValidity: percentiles(input.researchToDecisionValidityMs),
    decisionValidityToRisk: percentiles(input.decisionValidityToRiskMs),
    riskToExecutableProposal: percentiles(input.riskToProposalMs),
  });
}

export function buildExecutionQuality(input: {
  readonly submissionToAckMs: readonly number[];
  readonly ackToFillMs: readonly number[];
  readonly spreadBpsSamples: readonly number[];
  readonly slippageBpsSamples: readonly number[];
  readonly adverseSelectionBps: number;
  readonly completed: number;
  readonly rejected: number;
  readonly total: number;
}): ExecutionQualityMetrics {
  const avg = (rows: readonly number[]) =>
    rows.length === 0 ? 0 : rows.reduce((acc, row) => acc + row, 0) / rows.length;
  const total = input.total === 0 ? 1 : input.total;
  return Object.freeze({
    submissionToAcknowledgement: percentiles(input.submissionToAckMs),
    acknowledgementToFill: percentiles(input.ackToFillMs),
    averageSpreadBps: Math.round(avg(input.spreadBpsSamples)),
    averageSlippageBps: Math.round(avg(input.slippageBpsSamples)),
    adverseSelectionBps: input.adverseSelectionBps,
    completionRateBps: Math.round((input.completed * 10_000) / total),
    rejectionRateBps: Math.round((input.rejected * 10_000) / total),
  });
}

export function buildCapitalEfficiency(input: {
  readonly currency: string;
  readonly deployedMinor: string;
  readonly idleCashMinor: string;
  readonly reservedCashMinor: string;
  readonly maxDrawdownBps: number;
  readonly concentrationBps: number;
  readonly turnoverBps: number;
  readonly liquidityRatioBps: number;
}): CapitalEfficiencyMetrics {
  return Object.freeze({
    deployedCapital: evaluationMoney(input.deployedMinor, input.currency),
    idleCash: evaluationMoney(input.idleCashMinor, input.currency),
    reservedCash: evaluationMoney(input.reservedCashMinor, input.currency),
    maxDrawdownBps: input.maxDrawdownBps,
    concentrationBps: input.concentrationBps,
    turnoverBps: input.turnoverBps,
    liquidityRatioBps: input.liquidityRatioBps,
  });
}
