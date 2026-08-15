import { createHash } from 'node:crypto';

import type { UtcInstant } from '../../domain/src/time.ts';
import type { RiskDecision } from '../../risk/src/types.ts';
import type { MarketDataset } from './dataset.ts';
import { evaluateDecision } from './evaluate.ts';
import { asShadowDecisionId, asShadowRunId, type ShadowDecisionId, type ShadowRunId } from './ids.ts';
import type { StrategySpecification } from './specification.ts';

export type ShadowRun = {
  readonly runId: ShadowRunId;
  readonly strategyId: string;
  readonly strategyVersion: string;
  readonly datasetId: string;
  readonly datasetVersion: string;
  readonly startedAt: UtcInstant;
  readonly completedAt: UtcInstant | null;
  readonly sendsOrders: false;
  readonly changesInvestmentState: false;
};

export type ShadowDecision = {
  readonly decisionId: ShadowDecisionId;
  readonly runId: ShadowRunId;
  readonly timestamp: UtcInstant;
  readonly marketSnapshot: Readonly<Record<string, string>>;
  readonly strategyRule: string;
  readonly intendedAction: string;
  readonly riskAssessmentId: string | null;
  readonly riskOutcome: string | null;
  readonly wouldTrade: boolean;
  readonly reason: string;
  readonly brokerSubmission: false;
};

export function startShadowRun(input: {
  readonly strategyId: string;
  readonly strategyVersion: string;
  readonly dataset: MarketDataset;
  readonly startedAt: UtcInstant;
}): ShadowRun {
  const material = `${input.strategyId}@${input.strategyVersion}:${input.dataset.hash}:${input.startedAt}`;
  return Object.freeze({
    runId: asShadowRunId(`shd_${createHash('sha256').update(material).digest('hex').slice(0, 24)}`),
    strategyId: input.strategyId,
    strategyVersion: input.strategyVersion,
    datasetId: input.dataset.datasetId,
    datasetVersion: input.dataset.version,
    startedAt: input.startedAt,
    completedAt: null,
    sendsOrders: false,
    changesInvestmentState: false,
  });
}

export function shadowDecision(input: {
  readonly run: ShadowRun;
  readonly specification: StrategySpecification;
  readonly dataset: MarketDataset;
  readonly at: UtcInstant;
  readonly risk?: RiskDecision;
}): ShadowDecision {
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
  const material = `${input.run.runId}:${input.at}:${decision.rule}`;
  return Object.freeze({
    decisionId: asShadowDecisionId(`sdec_${createHash('sha256').update(material).digest('hex').slice(0, 20)}`),
    runId: input.run.runId,
    timestamp: input.at,
    marketSnapshot: Object.freeze(snapshot),
    strategyRule: decision.rule,
    intendedAction: JSON.stringify(decision.targetWeightsBps),
    riskAssessmentId: input.risk?.assessmentId ?? null,
    riskOutcome: input.risk?.outcome ?? null,
    wouldTrade,
    reason: wouldTrade ? 'strategy would rebalance in shadow mode' : 'no trade at this snapshot',
    brokerSubmission: false,
  });
}
