/**
 * HELIOS H33 — pipeline latency instrumentation and distribution computation.
 * Preserves tail latency — does not average away severe tails.
 */

import { summarizeLatencyMs } from '../../../../../performance/lib/stats.ts';
import type {
  DecisionLatencySummary,
  DiscoveryLatencySummary,
  ExecutionLatencySummary,
  HeliosPipelineLatencySample,
  HeliosPipelineStage,
  LatencyDistribution,
  PipelineLatencySummary,
} from './types.ts';

export function toLatencyDistribution(samples: readonly number[]): LatencyDistribution {
  if (samples.length === 0) {
    return Object.freeze({
      count: 0,
      p50Ms: 0,
      p90Ms: 0,
      p95Ms: 0,
      p99Ms: 0,
      maxMs: 0,
      meanMs: 0,
    });
  }
  const sorted = [...samples].sort((a, b) => a - b);
  const summary = summarizeLatencyMs(sorted);
  const p90Index = Math.max(0, Math.ceil(0.9 * sorted.length) - 1);
  return Object.freeze({
    count: summary.count,
    p50Ms: summary.p50Ms,
    p90Ms: sorted[p90Index] ?? 0,
    p95Ms: summary.p95Ms,
    p99Ms: summary.p99Ms,
    maxMs: summary.maxMs,
    meanMs: summary.meanMs,
  });
}

export function stageDeltaMs(
  sample: HeliosPipelineLatencySample,
  from: HeliosPipelineStage,
  to: HeliosPipelineStage,
): number | null {
  const start = sample.stageTimestampsMs[from];
  const end = sample.stageTimestampsMs[to];
  if (start == null || end == null) return null;
  return Math.max(0, end - start);
}

export function computeDiscoveryLatency(samples: readonly HeliosPipelineLatencySample[]): DiscoveryLatencySummary {
  const deltas: number[] = [];
  for (const sample of samples) {
    const delta = stageDeltaMs(sample, 'SOURCE', 'CANDIDATE');
    if (delta != null) deltas.push(delta);
  }
  return Object.freeze({
    sourceToVerifiedCandidateMs: toLatencyDistribution(deltas),
    sampleCount: deltas.length,
  });
}

export function computeDecisionLatency(samples: readonly HeliosPipelineLatencySample[]): DecisionLatencySummary {
  const candidateToProposal: number[] = [];
  const riskCompliance: number[] = [];
  const modelTime: number[] = [];
  const deterministic: number[] = [];

  for (const sample of samples) {
    const toProposal = stageDeltaMs(sample, 'CANDIDATE', 'PROPOSAL_READY');
    if (toProposal != null) candidateToProposal.push(toProposal);
    const risk = stageDeltaMs(sample, 'DECISION_VALIDITY', 'RISK_COMPLIANCE');
    if (risk != null) riskCompliance.push(risk);
    if (sample.modelTimeMs > 0) modelTime.push(sample.modelTimeMs);
    if (sample.deterministicControlTimeMs > 0) deterministic.push(sample.deterministicControlTimeMs);
  }

  return Object.freeze({
    candidateToProposalMs: toLatencyDistribution(candidateToProposal),
    riskComplianceMs: toLatencyDistribution(riskCompliance),
    modelTimeMs: toLatencyDistribution(modelTime),
    deterministicControlTimeMs: toLatencyDistribution(deterministic),
    sampleCount: candidateToProposal.length,
  });
}

export function computeExecutionLatency(samples: readonly HeliosPipelineLatencySample[]): ExecutionLatencySummary {
  const submissionToAck: number[] = [];
  const ackToFill: number[] = [];
  const fillToReconciled: number[] = [];

  for (const sample of samples) {
    const s2a = stageDeltaMs(sample, 'SUBMITTED', 'ACKNOWLEDGED');
    if (s2a != null) submissionToAck.push(s2a);
    const a2f = stageDeltaMs(sample, 'ACKNOWLEDGED', 'FILLED');
    if (a2f != null) ackToFill.push(a2f);
    const f2r = stageDeltaMs(sample, 'FILLED', 'RECONCILED');
    if (f2r != null) fillToReconciled.push(f2r);
  }

  return Object.freeze({
    submissionToAckMs: toLatencyDistribution(submissionToAck),
    ackToFillMs: toLatencyDistribution(ackToFill),
    fillToReconciledMs: toLatencyDistribution(fillToReconciled),
    sampleCount: submissionToAck.length,
  });
}

export function computePipelineLatencySummary(
  samples: readonly HeliosPipelineLatencySample[],
): PipelineLatencySummary {
  const endToEnd: number[] = [];
  const byStage = new Map<HeliosPipelineStage, number[]>();

  const stagePairs: readonly [HeliosPipelineStage, HeliosPipelineStage][] = Object.freeze([
    ['SOURCE', 'ARRIVAL'],
    ['ARRIVAL', 'NORMALIZATION'],
    ['NORMALIZATION', 'EVENT_DETECTION'],
    ['EVENT_DETECTION', 'EVIDENCE_VERIFIED'],
    ['EVIDENCE_VERIFIED', 'CANDIDATE'],
    ['CANDIDATE', 'SPECIALIST_RESEARCH'],
    ['SPECIALIST_RESEARCH', 'STRATEGY_EVALUATION'],
    ['STRATEGY_EVALUATION', 'DECISION_VALIDITY'],
    ['DECISION_VALIDITY', 'RISK_COMPLIANCE'],
    ['RISK_COMPLIANCE', 'PROPOSAL_READY'],
    ['PROPOSAL_READY', 'SUBMITTED'],
    ['SUBMITTED', 'ACKNOWLEDGED'],
    ['ACKNOWLEDGED', 'FILLED'],
    ['FILLED', 'SETTLED'],
    ['SETTLED', 'RECONCILED'],
  ]);

  for (const sample of samples) {
    const source = sample.stageTimestampsMs.SOURCE;
    const reconciled = sample.stageTimestampsMs.RECONCILED;
    if (source != null && reconciled != null) {
      endToEnd.push(reconciled - source);
    }
    for (const [from, to] of stagePairs) {
      const delta = stageDeltaMs(sample, from, to);
      if (delta == null) continue;
      const bucket = byStage.get(to) ?? [];
      bucket.push(delta);
      byStage.set(to, bucket);
    }
  }

  const byStageRecord: Partial<Record<HeliosPipelineStage, LatencyDistribution>> = {};
  for (const [stage, values] of byStage) {
    byStageRecord[stage] = toLatencyDistribution(values);
  }

  return Object.freeze({
    endToEndMs: toLatencyDistribution(endToEnd),
    byStage: Object.freeze(byStageRecord),
    discovery: computeDiscoveryLatency(samples),
    decision: computeDecisionLatency(samples),
    execution: computeExecutionLatency(samples),
  });
}

export function createPipelineTrace(input: {
  readonly traceId: string;
  readonly customerId: string;
  readonly workOrderId: string;
  readonly baseTimeMs?: number;
}): {
  readonly sample: HeliosPipelineLatencySample;
  mark(stage: HeliosPipelineStage, offsetMs?: number): void;
  addModelTime(ms: number): void;
  addDeterministicTime(ms: number): void;
  freeze(): HeliosPipelineLatencySample;
} {
  const base = input.baseTimeMs ?? performance.now();
  const stageTimestampsMs: Partial<Record<HeliosPipelineStage, number>> = {};
  let modelTimeMs = 0;
  let deterministicControlTimeMs = 0;

  return {
    get sample() {
      return Object.freeze({
        traceId: input.traceId,
        customerId: input.customerId,
        workOrderId: input.workOrderId,
        stageTimestampsMs: Object.freeze({ ...stageTimestampsMs }),
        modelTimeMs,
        deterministicControlTimeMs,
        environment: 'simulation' as const,
      });
    },
    mark(stage, offsetMs) {
      stageTimestampsMs[stage] = base + (offsetMs ?? Object.keys(stageTimestampsMs).length * 2);
    },
    addModelTime(ms) {
      modelTimeMs += ms;
    },
    addDeterministicTime(ms) {
      deterministicControlTimeMs += ms;
    },
    freeze() {
      return this.sample;
    },
  };
}
