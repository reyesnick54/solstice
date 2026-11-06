import { createHash } from 'node:crypto';

import { err, ok, type Result } from '@solstice/domain';
import type { UtcInstant } from '@solstice/domain';
import type { MarketDataset } from './dataset.ts';
import { evaluateDecision } from './evaluate.ts';
import {
  asForwardShadowDecisionId,
  asForwardShadowRunId,
  asRejectedOpportunityShadowOpportunityId,
  type ForwardShadowDecisionId,
  type ForwardShadowRunId,
  type RejectedOpportunityShadowOpportunityId,
} from './ids.ts';
import type { PromotionCapsule } from './promotion-capsule.ts';
import type { StrategySpecification } from './specification.ts';
import type { StrategyFailure } from './types.ts';
import type { Evol11ForwardShadowRole } from './evol11-champion-challenger.ts';

export type ForwardShadowRun = {
  readonly runId: ForwardShadowRunId;
  readonly capsuleId: string;
  readonly capsuleFingerprint: string;
  readonly strategyId: string;
  readonly strategyVersion: string;
  readonly startedAt: UtcInstant;
  readonly completedAt: UtcInstant | null;
  readonly observationRef: string;
  /** HELIOS EVOL11 — challenger track labels this run as challenging an incumbent (simulation only). */
  readonly evol11Role: Evol11ForwardShadowRole;
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
  readonly evol11Role: Evol11ForwardShadowRole;
};

/**
 * HELIOS CF02 — internal research: rejected/delayed/reduced/ignored opportunity shadow book.
 * Observed market paths are not achievable P&L; counterfactuals are estimates only.
 * Customer-facing invariant stays REJECTED_OPPORTUNITY_NOT_COUNTERFACTUAL (see REJECTED_OPPORTUNITY_NOT_COUNTERFACTUAL_CUSTOMER_INVARIANT).
 */
export const HELIOS_CF02_REJECTED_OPPORTUNITY_BOOK_QUALIFIED =
  'HELIOS_CF02_REJECTED_OPPORTUNITY_BOOK_QUALIFIED' as const;

/** Horizons used where economically meaningful (omit horizons with no meaningful observation). */
export type ShadowObservationHorizon = '1m' | '5m' | '30m' | '1h' | '1d' | '5d' | '20d' | '60d';

export const SHADOW_OBSERVATION_HORIZONS: readonly ShadowObservationHorizon[] = Object.freeze([
  '1m',
  '5m',
  '30m',
  '1h',
  '1d',
  '5d',
  '20d',
  '60d',
]);

export type ShadowBenchmark =
  | 'CASH_NO_ACTION'
  | 'MARKET'
  | 'SECTOR'
  | 'STRATEGY_CHAMPION'
  | 'PORTFOLIO_BASELINE';

export const SHADOW_BENCHMARKS: readonly ShadowBenchmark[] = Object.freeze([
  'CASH_NO_ACTION',
  'MARKET',
  'SECTOR',
  'STRATEGY_CHAMPION',
  'PORTFOLIO_BASELINE',
]);

/** What was recorded in the market after the decision (not execution-attributed P&L). */
export const MARKET_PATH_OBSERVED = 'MARKET_PATH_OBSERVED' as const;
/** Estimated path had the proposed execution been followed (research estimate only). */
export const EXECUTION_COUNTERFACTUAL_ESTIMATED = 'EXECUTION_COUNTERFACTUAL_ESTIMATED' as const;
/** Estimated path under alternate policy rules (research estimate only). */
export const POLICY_COUNTERFACTUAL_ESTIMATED = 'POLICY_COUNTERFACTUAL_ESTIMATED' as const;

/**
 * Customer-facing promise: we do not present rejections as “you would have made $X”.
 * Internal book rows still carry {@link MARKET_PATH_OBSERVED} vs counterfactual estimate lanes.
 */
export const REJECTED_OPPORTUNITY_NOT_COUNTERFACTUAL_CUSTOMER_INVARIANT =
  'REJECTED_OPPORTUNITY_NOT_COUNTERFACTUAL' as const;

export type ShadowPricePathSlice = {
  /** Instrument id to close in minor units (string), point-in-time or slice summary. */
  readonly pricesByInstrumentId: Readonly<Record<string, string>>;
};

export type ShadowBenchmarkPathRow = {
  readonly benchmark: ShadowBenchmark;
  readonly path: ShadowPricePathSlice;
};

export type ShadowHorizonObservation = {
  /** Observed market prices after rejection — not equal to achievable counterfactual P&L. */
  readonly marketPathObserved: ShadowPricePathSlice | null;
  /** Optional: estimated path if the proposed execution plan had been followed. */
  readonly executionCounterfactualEstimated: ShadowPricePathSlice | null;
  /** Optional: estimated path under alternate policy (still not customer-facing money claim). */
  readonly policyCounterfactualEstimated: ShadowPricePathSlice | null;
  readonly benchmarkPaths: readonly ShadowBenchmarkPathRow[];
};

export type ShadowOutcome = {
  readonly recordedAt: UtcInstant;
  readonly byHorizon: Readonly<Partial<Record<ShadowObservationHorizon, ShadowHorizonObservation>>>;
  readonly notes: string;
};

export type ShadowOriginalDecisionSnapshot = {
  readonly decisionId: ForwardShadowDecisionId;
  readonly decisionTime: UtcInstant;
  readonly actionKind: ForwardShadowDecision['actionKind'];
  readonly proposedAction: string;
  readonly strategyFacingRejectionReason: string | null;
  readonly marketStateAtDecision: Readonly<Record<string, string>>;
};

export type ShadowOpportunity = {
  readonly shadowOpportunityId: RejectedOpportunityShadowOpportunityId;
  readonly bookId: string;
  readonly forwardShadowRunId: ForwardShadowRunId;
  readonly originalDecision: ShadowOriginalDecisionSnapshot;
  /** Why HELIOS (or policy) rejected, delayed, reduced scope, or did not act. */
  readonly reasonRejected: string;
  readonly proposedDirection: string;
  readonly proposedSize: string;
  readonly proposedExecutionPlan: string;
  readonly marketStateAtDecision: Readonly<Record<string, string>>;
  readonly outcome: ShadowOutcome;
  readonly invariant: typeof REJECTED_OPPORTUNITY_NOT_COUNTERFACTUAL_CUSTOMER_INVARIANT;
  /** Internal research only; never a customer profit claim. */
  readonly researchOnly: true;
};

export type RejectedOpportunityShadowBook = {
  readonly bookId: string;
  readonly observationRef: string;
  readonly createdAt: UtcInstant;
  readonly entries: readonly ShadowOpportunity[];
  readonly researchOnly: true;
};

function daysBetween(start: UtcInstant, end: UtcInstant): number {
  const ms = new Date(end).getTime() - new Date(start).getTime();
  return Math.max(0, Math.ceil(ms / (24 * 60 * 60 * 1000)));
}

export function startForwardShadowRun(input: {
  readonly capsule: PromotionCapsule;
  readonly observationRef: string;
  readonly startedAt: UtcInstant;
  readonly modelVersions?: readonly string[];
  readonly toolVersions?: readonly string[];
  /** Defaults to INCUBATION when omitted. */
  readonly evol11Role?: Evol11ForwardShadowRole;
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
    evol11Role: input.evol11Role ?? 'INCUBATION',
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
    evol11Role: input.run.evol11Role,
  });
}

function assertHorizonsEconomicallyRelevant(byHorizon: ShadowOutcome['byHorizon']): void {
  for (const h of Object.keys(byHorizon)) {
    if (!(SHADOW_OBSERVATION_HORIZONS as readonly string[]).includes(h)) {
      throw new TypeError(`unknown shadow observation horizon: ${h}`);
    }
  }
}

/**
 * Immutable rejected-opportunity book for internal research (CF02).
 */
export function createRejectedOpportunityShadowBook(input: {
  readonly bookId: string;
  readonly observationRef: string;
  readonly createdAt: UtcInstant;
  readonly entries?: readonly ShadowOpportunity[];
}): RejectedOpportunityShadowBook {
  return Object.freeze({
    bookId: input.bookId,
    observationRef: input.observationRef,
    createdAt: input.createdAt,
    entries: Object.freeze([...(input.entries ?? [])]),
    researchOnly: true as const,
  });
}

/**
 * Append one shadow opportunity entry; re-fingerprints opportunity id from stable material when omitted.
 */
export function appendRejectedOpportunityShadowEntry(input: {
  readonly book: RejectedOpportunityShadowBook;
  readonly forwardShadowRun: ForwardShadowRun;
  readonly originalDecision: ShadowOriginalDecisionSnapshot;
  readonly reasonRejected: string;
  readonly proposedDirection: string;
  readonly proposedSize: string;
  readonly proposedExecutionPlan: string;
  readonly outcome: ShadowOutcome;
  readonly shadowOpportunityId?: RejectedOpportunityShadowOpportunityId;
}): RejectedOpportunityShadowBook {
  assertHorizonsEconomicallyRelevant(input.outcome.byHorizon);
  const material = [
    input.book.bookId,
    input.forwardShadowRun.runId,
    input.originalDecision.decisionId,
    input.reasonRejected,
    input.proposedDirection,
    input.proposedSize,
    input.proposedExecutionPlan,
    input.outcome.recordedAt,
  ].join('|');
  const shadowOpportunityId =
    input.shadowOpportunityId ??
    asRejectedOpportunityShadowOpportunityId(
      `rosh_${createHash('sha256').update(material).digest('hex').slice(0, 20)}`,
    );
  const entry = Object.freeze({
    shadowOpportunityId,
    bookId: input.book.bookId,
    forwardShadowRunId: input.forwardShadowRun.runId,
    originalDecision: Object.freeze(input.originalDecision),
    reasonRejected: input.reasonRejected,
    proposedDirection: input.proposedDirection,
    proposedSize: input.proposedSize,
    proposedExecutionPlan: input.proposedExecutionPlan,
    marketStateAtDecision: Object.freeze({ ...input.originalDecision.marketStateAtDecision }),
    outcome: Object.freeze({
      ...input.outcome,
      byHorizon: Object.freeze({ ...input.outcome.byHorizon }),
    }),
    invariant: REJECTED_OPPORTUNITY_NOT_COUNTERFACTUAL_CUSTOMER_INVARIANT,
    researchOnly: true as const,
  }) satisfies ShadowOpportunity;
  return Object.freeze({
    ...input.book,
    entries: Object.freeze([...input.book.entries, entry]),
  });
}

/**
 * Build a snapshot of the original forward-shadow decision plus market state for the book.
 */
export function shadowOriginalDecisionFromForwardShadow(input: {
  readonly decision: ForwardShadowDecision;
}): ShadowOriginalDecisionSnapshot {
  return Object.freeze({
    decisionId: input.decision.decisionId,
    decisionTime: input.decision.decisionTime,
    actionKind: input.decision.actionKind,
    proposedAction: input.decision.proposedAction,
    strategyFacingRejectionReason: input.decision.rejectionReason,
    marketStateAtDecision: Object.freeze({ ...input.decision.marketTermsAtDecision }),
  });
}
