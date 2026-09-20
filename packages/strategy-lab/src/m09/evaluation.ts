import { err, ok, type Result } from '../../../domain/src/result.ts';
import type { UtcInstant } from '../../../domain/src/time.ts';
import { calculateMetrics, type EquityPoint } from '../metrics.ts';
import { simulateRealisticFill } from '../evaluation/fill-model.ts';
import { buildExecutionTimeline, DEFAULT_CONSERVATIVE_LATENCY } from '../evaluation/latency-model.ts';
import { assertNoFutureInformationLeak, isKnowableAt } from '../evaluation/information-time.ts';
import { sortObservationsChronologically } from '../evaluation/chronology.ts';
import { buildEvaluationEconomics, extendMetrics } from '../evaluation/cost-model.ts';
import type { EvaluationDatasetManifest } from '../evaluation/manifest.ts';
import type { ChronologicalEvaluationConfig, EvaluationFailure, EvaluationLimitation } from '../evaluation/types.ts';
import { barsFromManifest } from './fixtures.ts';
import { M09_INSTRUMENT_UNIVERSE } from './ids.ts';
import type { M09StrategyParameters } from './parameters.ts';
import { evaluateM09Universe } from './rule.ts';
import type { M09EvaluationContext, M09OpenPosition } from './types.ts';

export type M09ChronologicalEvaluationResult = {
  readonly tradeCount: number;
  readonly equity: readonly EquityPoint[];
  readonly netEconomicsMinor: bigint;
  readonly limitations: readonly EvaluationLimitation[];
  readonly succeeded: boolean;
};

function observationAt(manifest: EvaluationDatasetManifest, instrumentId: string, at: UtcInstant) {
  return manifest.observations.find(
    (row) =>
      row.instrumentId === instrumentId &&
      row.informationTime.sourceEventTime === at &&
      isKnowableAt(at, row.informationTime.knowableAt),
  );
}

export function runM09ChronologicalEvaluation(input: {
  readonly manifest: EvaluationDatasetManifest;
  readonly params: M09StrategyParameters;
  readonly config: Pick<
    ChronologicalEvaluationConfig,
    'period' | 'startingCapitalMinor' | 'costs' | 'operatingResearchCostMinor'
  >;
  readonly ctx: Omit<M09EvaluationContext, 'forceClose' | 'riskEngineForcedClose' | 'strategyInvalidated'>;
}): Result<M09ChronologicalEvaluationResult, EvaluationFailure> {
  const bars = barsFromManifest(input.manifest);
  const sorted = sortObservationsChronologically(input.manifest.observations);
  const limitations: EvaluationLimitation[] = [];

  const stamps = sorted
    .map((row) => row.informationTime.sourceEventTime)
    .filter((at) => at >= input.config.period.start && at <= input.config.period.end)
    .filter((at, index, all) => all.indexOf(at) === index)
    .sort((a, b) => Date.parse(a) - Date.parse(b));

  let cash = input.config.startingCapitalMinor;
  const positions: Record<string, bigint> = {};
  const openMeta: Record<string, M09OpenPosition> = {};
  const equity: EquityPoint[] = [];
  let fees = 0n;
  let spreadCost = 0n;
  let slippageCost = 0n;
  let tradeCount = 0;

  for (const at of stamps) {
    for (const row of input.manifest.observations) {
      const leak = assertNoFutureInformationLeak({
        evaluationTime: at,
        knowableAt: row.informationTime.knowableAt,
        observationId: row.observationId,
      });
      if (!leak.ok && row.informationTime.sourceEventTime <= at) {
        return err({ code: 'FUTURE_INFORMATION_LEAK', message: leak.reason });
      }
    }

    const ctx: M09EvaluationContext = Object.freeze({
      ...input.ctx,
      forceClose: false,
      riskEngineForcedClose: false,
      strategyInvalidated: false,
    });

    const decisions = evaluateM09Universe({
      instrumentIds: M09_INSTRUMENT_UNIVERSE,
      allBars: bars,
      now: at,
      params: input.params,
      ctx,
      openPositions: Object.values(openMeta),
    });

    for (const decision of decisions) {
      const timeline = buildExecutionTimeline({
        observationAvailableAt: at,
        latency: DEFAULT_CONSERVATIVE_LATENCY,
      });
      const execAt = timeline.executionEligibilityAt;
      const obs = observationAt(input.manifest, decision.instrumentId, at);
      if (!obs || !obs.available || !obs.sessionOpen) {
        if (decision.action === 'BUY' || decision.action === 'SELL') {
          limitations.push(
            Object.freeze({
              code: 'MARKET_CLOSED',
              message: `no fill for ${decision.instrumentId} at ${at}`,
            }),
          );
        }
        continue;
      }

      if (decision.action === 'BUY' && (positions[decision.instrumentId] ?? 0n) === 0n) {
        const notional = (cash * BigInt(decision.recommendedExposureBps)) / 10_000n;
        if (notional <= 0n || obs.askMinor === null) {
          continue;
        }
        const quantity = notional / obs.askMinor;
        if (quantity <= 0n) {
          continue;
        }
        const fill = simulateRealisticFill({
          side: 'BUY',
          quantity,
          observation: obs,
          costs: input.config.costs,
          cashMinor: cash,
          ownedQuantity: 0n,
          executionAt: execAt,
        });
        if (!fill.ok || !fill.value.filled) {
          continue;
        }
        cash += fill.value.cashDeltaMinor;
        positions[decision.instrumentId] = fill.value.filledQuantity;
        openMeta[decision.instrumentId] = Object.freeze({
          instrumentId: decision.instrumentId,
          entryBarIndex: 0,
          entryZScoreScaled: decision.zScoreScaled ?? 0n,
          openedAt: at,
        });
        fees += fill.value.feeMinor;
        spreadCost += fill.value.spreadCostMinor;
        slippageCost += fill.value.slippageCostMinor;
        tradeCount += 1;
      }

      if (decision.action === 'SELL' && (positions[decision.instrumentId] ?? 0n) > 0n) {
        const quantity = positions[decision.instrumentId] ?? 0n;
        const fill = simulateRealisticFill({
          side: 'SELL',
          quantity,
          observation: obs,
          costs: input.config.costs,
          cashMinor: cash,
          ownedQuantity: quantity,
          executionAt: execAt,
        });
        if (!fill.ok || !fill.value.filled) {
          continue;
        }
        cash += fill.value.cashDeltaMinor;
        positions[decision.instrumentId] = 0n;
        delete openMeta[decision.instrumentId];
        fees += fill.value.feeMinor;
        spreadCost += fill.value.spreadCostMinor;
        slippageCost += fill.value.slippageCostMinor;
        tradeCount += 1;
      }
    }

    let marked = cash;
    for (const [instrumentId, qty] of Object.entries(positions)) {
      const obs = observationAt(input.manifest, instrumentId, at);
      if (obs) {
        marked += qty * obs.closeMinor;
      }
    }
    equity.push(Object.freeze({ at, totalMinor: marked }));
  }

  const ending = equity[equity.length - 1]?.totalMinor ?? input.config.startingCapitalMinor;
  const baseMetrics = calculateMetrics({
    startingCapitalMinor: input.config.startingCapitalMinor,
    endingCapitalMinor: ending,
    equity,
    feesMinor: fees,
    tradedNotionalMinor: 0n,
    cashMinorSeries: equity.map(() => cash),
    tradeCount,
    winCount: 0,
    lossCount: 0,
    observationDays: stamps.length,
  });
  const economics = buildEvaluationEconomics({
    startingCapitalMinor: input.config.startingCapitalMinor,
    endingCapitalMinor: ending,
    feesMinor: fees,
    spreadCostMinor: spreadCost,
    slippageCostMinor: slippageCost,
    operatingResearchCostMinor: input.config.operatingResearchCostMinor,
  });
  const metrics = extendMetrics({
    base: baseMetrics,
    economics,
    startingCapitalMinor: input.config.startingCapitalMinor,
    averageHoldingDays: null,
    concentrationTopInstrumentBps: null,
    worstPeriodReturn: null,
  });

  return ok(
    Object.freeze({
      tradeCount,
      equity,
      netEconomicsMinor: metrics.netEconomicsMinor,
      limitations: Object.freeze(limitations),
      succeeded: true,
    }),
  );
}

export function m09BuyAndHoldEnding(
  manifest: EvaluationDatasetManifest,
  instrumentId: string,
  startingCapitalMinor: bigint,
  stamps: readonly UtcInstant[],
): bigint {
  let cash = startingCapitalMinor;
  let qty = 0n;
  for (const at of stamps) {
    const obs = observationAt(manifest, instrumentId, at);
    if (!obs || !obs.available) {
      continue;
    }
    if (qty === 0n && obs.sessionOpen) {
      qty = cash / obs.closeMinor;
      cash -= qty * obs.closeMinor;
    }
  }
  const last = stamps[stamps.length - 1];
  const lastObs = last ? observationAt(manifest, instrumentId, last) : null;
  return cash + qty * (lastObs?.closeMinor ?? 0n);
}
