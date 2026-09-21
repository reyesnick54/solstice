import { err, ok, type Result, type UtcInstant } from '@solstice/domain';
import { calculateMetrics, type EquityPoint } from '../metrics.ts';
import { simulateRealisticFill } from '../evaluation/fill-model.ts';
import { buildExecutionTimeline, DEFAULT_CONSERVATIVE_LATENCY } from '../evaluation/latency-model.ts';
import { assertNoFutureInformationLeak, isKnowableAt } from '../evaluation/information-time.ts';
import { sortObservationsChronologically } from '../evaluation/chronology.ts';
import { buildEvaluationEconomics, extendMetrics } from '../evaluation/cost-model.ts';
import type { EvaluationDatasetManifest } from '../evaluation/manifest.ts';
import type { ChronologicalEvaluationConfig, EvaluationFailure, EvaluationLimitation } from '../evaluation/types.ts';
import { resolveM12PairDefinition, type M12PairId } from './ids.ts';
import { barsFromManifest } from './fixtures.ts';
import type { M12StrategyParameters } from './parameters.ts';
import { evaluateM12RelativeValueStatArb } from './rule.ts';
import type { M12EvaluationContext, M12OpenSpreadPosition } from './types.ts';

export type M12ChronologicalEvaluationResult = {
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

export function runM12ChronologicalEvaluation(input: {
  readonly pairId: M12PairId;
  readonly manifest: EvaluationDatasetManifest;
  readonly params: M12StrategyParameters;
  readonly config: Pick<
    ChronologicalEvaluationConfig,
    'period' | 'startingCapitalMinor' | 'costs' | 'operatingResearchCostMinor'
  >;
  readonly ctx: Omit<M12EvaluationContext, 'forceClose' | 'strategyInvalidated'>;
}): Result<M12ChronologicalEvaluationResult, EvaluationFailure> {
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
  let openSpread: M12OpenSpreadPosition | null = null;
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

    const ctx: M12EvaluationContext = Object.freeze({
      ...input.ctx,
      forceClose: false,
      strategyInvalidated: false,
    });

    const proposal = evaluateM12RelativeValueStatArb({
      pairId: input.pairId,
      allBars: bars,
      now: at,
      params: input.params,
      ctx,
      openPosition: openSpread,
    });

    if (proposal.action === 'ENTER_SPREAD' || proposal.action === 'EXIT_SPREAD') {
      for (const leg of proposal.legs) {
        const obs = observationAt(input.manifest, leg.instrumentId, at);
        if (!obs || !obs.available || !obs.sessionOpen) {
          limitations.push(
            Object.freeze({
              code: 'LEG_UNAVAILABLE',
              message: `Leg ${leg.instrumentId} unavailable at ${at}`,
            }),
          );
          continue;
        }

        const timeline = buildExecutionTimeline({
          observationAvailableAt: at,
          latency: DEFAULT_CONSERVATIVE_LATENCY,
        });
        const owned = positions[leg.instrumentId] ?? 0n;
        const quantity =
          leg.direction === 'BUY'
            ? ((cash / 2n) * BigInt(leg.relativeWeightBps)) / (10_000n * (obs.askMinor ?? obs.closeMinor))
            : owned;
        if (quantity <= 0n) {
          continue;
        }

        const fill = simulateRealisticFill({
          side: leg.direction,
          quantity,
          observation: obs,
          costs: input.config.costs,
          cashMinor: cash,
          ownedQuantity: owned,
          executionAt: timeline.executionEligibilityAt,
        });
        if (!fill.ok) {
          limitations.push(
            Object.freeze({
              code: 'FILL_REJECTED',
              message: fill.error.message,
            }),
          );
          continue;
        }
        if (!fill.value.filled) {
          limitations.push(
            Object.freeze({
              code: 'FILL_REJECTED',
              message: fill.value.reason,
            }),
          );
          continue;
        }

        cash += fill.value.cashDeltaMinor;
        positions[leg.instrumentId] =
          leg.direction === 'BUY' ? fill.value.filledQuantity : owned - fill.value.filledQuantity;
        fees += fill.value.feeMinor;
        spreadCost += fill.value.spreadCostMinor;
        slippageCost += fill.value.slippageCostMinor;
        tradeCount += 1;
      }

      if (proposal.action === 'ENTER_SPREAD' && proposal.legs.length > 0) {
        openSpread = Object.freeze({
          pairId: input.pairId,
          direction: proposal.legs[0]!.direction === 'BUY' ? 'LONG_SPREAD' : 'SHORT_SPREAD',
          entryBarIndex: 0,
          entryZScoreScaled: proposal.spreadZScoreScaled ?? 0n,
          openedAt: at,
        });
      }
      if (proposal.action === 'EXIT_SPREAD') {
        openSpread = null;
      }
    }

    let marked = cash;
    for (const [instrumentId, qty] of Object.entries(positions)) {
      const obs = observationAt(input.manifest, instrumentId, at);
      if (obs && qty > 0n) {
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
    cashMinorSeries: equity.map((row) => row.totalMinor),
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
