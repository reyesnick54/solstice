import { createHash } from 'node:crypto';

import { err, ok, type Result } from '../../domain/src/result.ts';
import type { UtcInstant } from '../../domain/src/time.ts';
import type { MarketDataset } from './dataset.ts';
import { evaluateDecision } from './evaluate.ts';
import {
  asForwardShadowDecisionId,
  asForwardShadowRunId,
  type ForwardShadowDecisionId,
  type ForwardShadowRunId,
} from './ids.ts';
import type { StrategyCapsule } from './capsule.ts';
import type { StrategySpecification } from './specification.ts';
import type { StrategyFailure } from './types.ts';

export type ForwardShadowRun = {
  readonly runId: ForwardShadowRunId;
  readonly capsuleId: string;
  readonly capsuleFingerprint: string;
  readonly strategyId: string;
  readonly strategyVersion: string;
  readonly startedAt: UtcInstant;
  readonly completedAt: UtcInstant | null;
  readonly observationRef: string;
  readonly sendsOrders: false;
  readonly changesInvestmentState: false;
  readonly financialEffectCreated: false;
  readonly modelVersions: readonly string[];
  readonly toolVersions: readonly string[];
};

export type ForwardShadowDecision = {
  readonly decisionId: ForwardShadowDecisionId;
  readonly runId: ForwardShadowRunId;
  readonly capsuleFingerprint: string;
  readonly decisionTime: UtcInstant;
  readonly proposedAction: string;
  readonly actionKind: 'TRADE' | 'NO_ACTION' | 'WAIT';
  readonly rejectionReason: string | null;
  readonly predictedAssumptions: Readonly<Record<string, string>>;
  readonly marketTermsAtDecision: Readonly<Record<string, string>>;
  readonly estimatedCostsMinor: bigint;
  readonly invalidations: readonly string[];
  readonly missedOpportunity: boolean;
  readonly subsequentOutcome: ForwardShadowOutcome | null;
  readonly outcomeRecordedAt: UtcInstant | null;
  readonly immutableAfterOutcome: boolean;
  readonly modelVersions: readonly string[];
  readonly toolVersions: readonly string[];
  readonly brokerSubmission: false;
};

export type ForwardShadowOutcome = {
  readonly observedAt: UtcInstant;
  readonly marketTerms: Readonly<Record<string, string>>;
  readonly outcomeKind: 'FAVORABLE' | 'UNFAVORABLE' | 'NEUTRAL' | 'UNKNOWN';
  readonly notes: string;
};

export type ForwardShadowEvidenceSummary = {
  readonly runId: ForwardShadowRunId;
  readonly durationDays: number;
  readonly decisionCount: number;
  readonly noActionCount: number;
  readonly tradeCount: number;
  readonly maxDrawdownProxyBps: number;
  readonly costSensitivityPassed: boolean;
  readonly benchmarkComparisonPassed: boolean;
  readonly calibrationPassed: boolean;
  readonly financialEffectCreated: false;
  readonly outcomesRecorded: number;
};

function daysBetween(start: UtcInstant, end: UtcInstant): number {
  const ms = new Date(end).getTime() - new Date(start).getTime();
  return Math.max(0, Math.ceil(ms / (24 * 60 * 60 * 1000)));
}

export function startForwardShadowRun(input: {
  readonly capsule: StrategyCapsule;
  readonly observationRef: string;
  readonly startedAt: UtcInstant;
  readonly modelVersions?: readonly string[];
  readonly toolVersions?: readonly string[];
}): ForwardShadowRun {
  const material = `${input.capsule.capsuleId}:${input.capsule.fingerprint}:${input.startedAt}`;
  return Object.freeze({
    runId: asForwardShadowRunId(`fshd_${createHash('sha256').update(material).digest('hex').slice(0, 20)}`),
    capsuleId: input.capsule.capsuleId,
    capsuleFingerprint: input.capsule.fingerprint,
    strategyId: input.capsule.strategyId,
    strategyVersion: input.capsule.version,
    startedAt: input.startedAt,
    completedAt: null,
    observationRef: input.observationRef,
    sendsOrders: false,
    changesInvestmentState: false,
    financialEffectCreated: false,
    modelVersions: Object.freeze([...(input.modelVersions ?? [])]),
    toolVersions: Object.freeze([...(input.toolVersions ?? ['strategy-lab-v1'])]),
  });
}

export function recordForwardShadowDecision(input: {
  readonly run: ForwardShadowRun;
  readonly specification: StrategySpecification;
  readonly dataset: MarketDataset;
  readonly at: UtcInstant;
  readonly estimatedCostsMinor?: bigint;
  readonly modelVersions?: readonly string[];
}): ForwardShadowDecision {
  const decision = evaluateDecision({
    specification: input.specification,
    dataset: input.dataset,
    at: input.at,
    start: input.dataset.timeRange.start,
    cashBps: input.specification.cashAllocationBps,
  });
  const snapshot: Record<string, string> = {};
  for (const row of input.dataset.observations.filter((item) => item.at === input.at)) {
    snapshot[row.instrumentId] = row.closeMinor.toString();
  }
  const wouldTrade = decision.shouldRebalance || decision.exit;
  const actionKind = wouldTrade ? 'TRADE' : 'NO_ACTION';
  const material = `${input.run.runId}:${input.at}:${decision.rule}`;
  return Object.freeze({
    decisionId: asForwardShadowDecisionId(
      `fsdec_${createHash('sha256').update(material).digest('hex').slice(0, 20)}`,
    ),
    runId: input.run.runId,
    capsuleFingerprint: input.run.capsuleFingerprint,
    decisionTime: input.at,
    proposedAction: JSON.stringify(decision.targetWeightsBps),
    actionKind,
    rejectionReason: wouldTrade ? null : 'strategy chose no action at this observation',
    predictedAssumptions: Object.freeze({
      rule: decision.rule,
      cashBps: String(input.specification.cashAllocationBps),
      costMode: input.specification.transactionCosts.mode,
    }),
    marketTermsAtDecision: Object.freeze(snapshot),
    estimatedCostsMinor: input.estimatedCostsMinor ?? 0n,
    invalidations: Object.freeze([]),
    missedOpportunity: false,
    subsequentOutcome: null,
    outcomeRecordedAt: null,
    immutableAfterOutcome: false,
    modelVersions: Object.freeze([...(input.modelVersions ?? input.run.modelVersions)]),
    toolVersions: Object.freeze([...input.run.toolVersions]),
    brokerSubmission: false,
  });
}

export function attachForwardShadowOutcome(input: {
  readonly decision: ForwardShadowDecision;
  readonly outcome: ForwardShadowOutcome;
  readonly recordedAt: UtcInstant;
}): Result<ForwardShadowDecision, StrategyFailure> {
  if (input.decision.immutableAfterOutcome) {
    return err({
      code: 'INVALID_TRANSITION',
      message: 'forward shadow decision is immutable after outcome observation',
    });
  }
  return ok(
    Object.freeze({
      ...input.decision,
      subsequentOutcome: input.outcome,
      outcomeRecordedAt: input.recordedAt,
      immutableAfterOutcome: true,
    }),
  );
}

export function summarizeForwardShadowEvidence(input: {
  readonly run: ForwardShadowRun;
  readonly decisions: readonly ForwardShadowDecision[];
  readonly completedAt: UtcInstant;
  readonly costSensitivityPassed?: boolean;
  readonly benchmarkComparisonPassed?: boolean;
  readonly calibrationPassed?: boolean;
}): ForwardShadowEvidenceSummary {
  const durationDays = daysBetween(input.run.startedAt, input.completedAt);
  const noActionCount = input.decisions.filter((d) => d.actionKind === 'NO_ACTION' || d.actionKind === 'WAIT').length;
  const tradeCount = input.decisions.filter((d) => d.actionKind === 'TRADE').length;
  let peak = 0n;
  let trough = 0n;
  let cumulative = 0n;
  let maxDrawdown = 0;
  for (const decision of input.decisions) {
    cumulative -= decision.estimatedCostsMinor;
    if (cumulative > peak) peak = cumulative;
    if (cumulative < trough) trough = cumulative;
    const drawdown = peak > 0n ? Number(((peak - cumulative) * 10_000n) / peak) : 0;
    if (drawdown > maxDrawdown) maxDrawdown = drawdown;
  }
  return Object.freeze({
    runId: input.run.runId,
    durationDays,
    decisionCount: input.decisions.length,
    noActionCount,
    tradeCount,
    maxDrawdownProxyBps: maxDrawdown,
    costSensitivityPassed: input.costSensitivityPassed ?? true,
    benchmarkComparisonPassed: input.benchmarkComparisonPassed ?? true,
    calibrationPassed: input.calibrationPassed ?? true,
    financialEffectCreated: false,
    outcomesRecorded: input.decisions.filter((d) => d.subsequentOutcome !== null).length,
  });
}
