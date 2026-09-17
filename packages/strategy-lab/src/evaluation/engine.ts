import { createHash } from 'node:crypto';

import { err, ok, type Result } from '../../../domain/src/result.ts';
import type { UtcInstant } from '../../../domain/src/time.ts';
import { RATIO_UNIT, ratioFromUnits } from '../../../risk/src/arithmetic.ts';
import { applyDividend, applySplit } from '../simulator.ts';
import { evaluateDecision } from '../evaluate.ts';
import { membersAt } from '../dataset.ts';
import { calculateMetrics, type EquityPoint } from '../metrics.ts';
import { runWalkForward, walkForwardWindows } from '../walk-forward.ts';
import { verifyCapsuleFingerprint, type StrategyCapsule } from './capsule.ts';
import { runBenchmarkSuite } from './benchmarks.ts';
import { uniqueDecisionTimes, sortObservationsChronologically, chronologyTieBreakReport } from './chronology.ts';
import { buildEvaluationEconomics, extendMetrics } from './cost-model.ts';
import { simulateRealisticFill } from './fill-model.ts';
import { assertNoFutureInformationLeak, isKnowableAt } from './information-time.ts';
import { buildExecutionTimeline, validateLatencyModel } from './latency-model.ts';
import {
  manifestLimitations,
  manifestViewAt,
  type ChronologicalObservation,
  type EvaluationDatasetManifest,
} from './manifest.ts';
import { sealEvaluationRecord, type StrategyEvaluationRecord } from './record.ts';
import { ChronologicalEvaluationStore } from './store.ts';
import type {
  ChronologicalEvaluationConfig,
  EvaluationFailure,
  EvaluationLimitation,
  RegimeSlice,
} from './types.ts';

export type ChronologicalEvaluationResult = {
  readonly record: StrategyEvaluationRecord;
  readonly walkForwardRunId?: string;
};

function latestKnowableObservation(
  manifest: EvaluationDatasetManifest,
  instrumentId: string,
  executionAt: UtcInstant,
): ChronologicalObservation | null {
  const eligible = manifest.observations
    .filter(
      (row) =>
        row.instrumentId === instrumentId &&
        isKnowableAt(executionAt, row.informationTime.knowableAt) &&
        row.informationTime.sourceEventTime <= executionAt &&
        row.available &&
        row.sessionOpen,
    )
    .sort((a, b) => Date.parse(b.informationTime.sourceEventTime) - Date.parse(a.informationTime.sourceEventTime));
  return eligible[0] ?? null;
}

function markToMarket(
  positions: Readonly<Record<string, bigint>>,
  manifest: EvaluationDatasetManifest,
  at: UtcInstant,
): bigint {
  let total = 0n;
  for (const [instrumentId, quantity] of Object.entries(positions)) {
    const obs = latestKnowableObservation(manifest, instrumentId, at);
    if (obs) {
      total += quantity * obs.closeMinor;
    }
  }
  return total;
}

function runChronologicalLoop(input: {
  readonly capsule: StrategyCapsule;
  readonly manifest: EvaluationDatasetManifest;
  readonly config: ChronologicalEvaluationConfig;
}): Result<
  {
    readonly metrics: ReturnType<typeof extendMetrics>;
    readonly benchmarks: ReturnType<typeof runBenchmarkSuite>;
    readonly regimeSlices: readonly RegimeSlice[];
    readonly limitations: readonly EvaluationLimitation[];
    readonly succeeded: boolean;
    readonly failureCode: string | null;
    readonly failureMessage: string | null;
  },
  EvaluationFailure
> {
  const latencyCheck = validateLatencyModel(input.config.latency);
  if (!latencyCheck.ok) {
    return latencyCheck;
  }
  if (!verifyCapsuleFingerprint(input.capsule)) {
    return err({
      code: 'CAPSULE_FINGERPRINT_MISMATCH',
      message: 'strategy capsule fingerprint does not match frozen content',
    });
  }

  const sorted = sortObservationsChronologically(input.manifest.observations);
  const tieBreaks = chronologyTieBreakReport(sorted);
  const limitations: EvaluationLimitation[] = [...manifestLimitations(input.manifest)];
  if (tieBreaks.some((row) => row.uncertaintyRecorded)) {
    limitations.push(
      Object.freeze({
        code: 'CHRONOLOGY_TIE_UNCERTAINTY',
        message: 'Observations share knowableAt and providerSequence; deterministic observationId tie-break applied.',
      }),
    );
  }

  let cash = input.config.startingCapitalMinor;
  const positions: Record<string, bigint> = {};
  const equity: EquityPoint[] = [];
  const cashSeries: bigint[] = [];
  let fees = 0n;
  let spreadCost = 0n;
  let slippageCost = 0n;
  let tradedNotional = 0n;
  let tradeCount = 0;
  let winCount = 0;
  let lossCount = 0;
  let previousTotal = input.config.startingCapitalMinor;
  let holdingDays = 0;
  let openDays = 0;

  const stamps = uniqueDecisionTimes(input.manifest.observations, input.config.period);
  for (const at of stamps) {
    for (const action of input.manifest.corporateActions.filter((row) => row.at === at)) {
      const owned = positions[action.instrumentId] ?? 0n;
      if (owned <= 0n) {
        continue;
      }
      if (action.kind === 'SPLIT' && action.splitNumerator && action.splitDenominator) {
        positions[action.instrumentId] = applySplit(owned, action.splitNumerator, action.splitDenominator);
      }
      if (action.kind === 'DIVIDEND' && action.cashMinorPerShare) {
        cash += applyDividend(owned, action.cashMinorPerShare);
      }
    }

    const view = manifestViewAt(input.manifest, at);
    if (!view.ok) {
      limitations.push(Object.freeze({ code: 'MISSING_DATA_EXPLICIT', message: view.error.message }));
      continue;
    }

    for (const row of input.manifest.observations) {
      const leak = assertNoFutureInformationLeak({
        evaluationTime: at,
        knowableAt: row.informationTime.knowableAt,
        observationId: row.observationId,
      });
      if (!leak.ok && row.informationTime.sourceEventTime <= at && row.instrumentId in positions) {
        return err({
          code: 'FUTURE_INFORMATION_LEAK',
          message: leak.reason,
        });
      }
    }

    const decisionTimeline = buildExecutionTimeline({
      observationAvailableAt: at,
      latency: input.config.latency,
    });

    const decision = evaluateDecision({
      specification: input.capsule.specification,
      dataset: view.value,
      at: decisionTimeline.decisionAt,
      start: input.config.period.start,
      cashBps: input.capsule.specification.cashAllocationBps,
    });

    const execAt = decisionTimeline.executionEligibilityAt;
    const members = membersAt(view.value, at);

    if (decision.shouldRebalance || decision.exit) {
      const targets = decision.exit ? { CASH: 10_000 } : decision.targetWeightsBps;
      const total = cash + markToMarket(positions, input.manifest, execAt);
      for (const instrumentId of new Set([...Object.keys(positions), ...Object.keys(targets), ...members])) {
        if (instrumentId === 'CASH') {
          continue;
        }
        const obs = latestKnowableObservation(input.manifest, instrumentId, execAt);
        if (!obs) {
          limitations.push(
            Object.freeze({
              code: 'MISSING_DATA_EXPLICIT',
              message: `no knowable observation for ${instrumentId} at execution ${execAt}`,
            }),
          );
          continue;
        }
        const targetBps = targets[instrumentId] ?? 0;
        const targetValue = (total * BigInt(targetBps)) / 10_000n;
        const currentQty = positions[instrumentId] ?? 0n;
        const currentValue = currentQty * obs.closeMinor;
        const deltaValue = targetValue - currentValue;
        if (deltaValue === 0n || obs.closeMinor <= 0n) {
          continue;
        }
        const side = deltaValue > 0n ? 'BUY' : 'SELL';
        const quantity = (deltaValue < 0n ? -deltaValue : deltaValue) / obs.closeMinor;
        if (quantity <= 0n) {
          continue;
        }
        const fill = simulateRealisticFill({
          side,
          quantity,
          observation: obs,
          costs: input.config.costs,
          cashMinor: cash,
          ownedQuantity: currentQty,
          executionAt: execAt,
        });
        if (!fill.ok) {
          if ('code' in fill.error && fill.error.code === 'FUTURE_INFORMATION_LEAK') {
            return fill as Result<never, EvaluationFailure>;
          }
          continue;
        }
        if (!fill.value.filled || fill.value.filledQuantity === 0n) {
          if (fill.value.marketClosed) {
            limitations.push(
              Object.freeze({ code: 'MARKET_CLOSED', message: `no fill for ${instrumentId} — session closed` }),
            );
          }
          continue;
        }
        cash += fill.value.cashDeltaMinor;
        if (cash < 0n) {
          return err({ code: 'TRAIN_TEST_CONTAMINATION', message: 'chronological evaluation produced negative cash' });
        }
        positions[instrumentId] =
          side === 'BUY' ? currentQty + fill.value.filledQuantity : currentQty - fill.value.filledQuantity;
        fees += fill.value.feeMinor;
        spreadCost += fill.value.spreadCostMinor;
        slippageCost += fill.value.slippageCostMinor;
        tradedNotional += fill.value.priceMinor * fill.value.filledQuantity;
        tradeCount += 1;
      }
    }

    const marked = cash + markToMarket(positions, input.manifest, at);
    if (marked < previousTotal) {
      lossCount += 1;
    } else if (marked > previousTotal) {
      winCount += 1;
    }
    previousTotal = marked;
    cashSeries.push(cash);
    equity.push(Object.freeze({ at, totalMinor: marked }));
    if (Object.values(positions).some((qty) => qty > 0n)) {
      openDays += 1;
    }
    holdingDays += openDays > 0 ? 1 : 0;
  }

  const ending = equity[equity.length - 1]?.totalMinor ?? input.config.startingCapitalMinor;
  const baseMetrics = calculateMetrics({
    startingCapitalMinor: input.config.startingCapitalMinor,
    endingCapitalMinor: ending,
    equity,
    feesMinor: fees,
    tradedNotionalMinor: tradedNotional,
    cashMinorSeries: cashSeries,
    tradeCount,
    winCount,
    lossCount,
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

  let worstPeriod: bigint | null = null;
  for (let i = 1; i < equity.length; i += 1) {
    const prev = equity[i - 1];
    const current = equity[i];
    if (!prev || !current || prev.totalMinor <= 0n) {
      continue;
    }
    const ret = ((current.totalMinor - prev.totalMinor) * RATIO_UNIT) / prev.totalMinor;
    if (worstPeriod === null || ret < worstPeriod) {
      worstPeriod = ret;
    }
  }

  const metrics = extendMetrics({
    base: baseMetrics,
    economics,
    startingCapitalMinor: input.config.startingCapitalMinor,
    averageHoldingDays: tradeCount > 0 ? holdingDays / tradeCount : null,
    concentrationTopInstrumentBps: null,
    worstPeriodReturn: worstPeriod === null ? null : ratioFromUnits(worstPeriod),
  });

  const benchmarks = runBenchmarkSuite({
    manifest: input.manifest,
    specification: input.capsule.specification,
    plan: input.capsule.plan,
    parameterSet: input.capsule.parameterSet,
    startingCapitalMinor: input.config.startingCapitalMinor,
    period: input.config.period,
    strategyNetReturn: metrics.netReturn,
  });

  const mid = Math.floor(equity.length / 2);
  const regimeSlices: RegimeSlice[] = [];
  if (mid > 1) {
    const firstHalf = equity.slice(0, mid);
    const secondHalf = equity.slice(mid);
    const firstEnding = firstHalf[firstHalf.length - 1]?.totalMinor ?? input.config.startingCapitalMinor;
    const secondEnding = secondHalf[secondHalf.length - 1]?.totalMinor ?? firstEnding;
    regimeSlices.push(
      Object.freeze({
        label: 'FIRST_HALF',
        start: input.config.period.start,
        end: firstHalf[firstHalf.length - 1]?.at ?? input.config.period.start,
        metrics: calculateMetrics({
          startingCapitalMinor: input.config.startingCapitalMinor,
          endingCapitalMinor: firstEnding,
          equity: firstHalf,
          feesMinor: fees,
          tradedNotionalMinor: tradedNotional,
          cashMinorSeries: cashSeries.slice(0, mid),
          tradeCount,
          winCount,
          lossCount,
          observationDays: firstHalf.length,
        }),
        observationCount: firstHalf.length,
      }),
      Object.freeze({
        label: 'SECOND_HALF',
        start: secondHalf[0]?.at ?? input.config.period.start,
        end: input.config.period.end,
        metrics: calculateMetrics({
          startingCapitalMinor: firstEnding,
          endingCapitalMinor: secondEnding,
          equity: secondHalf,
          feesMinor: 0n,
          tradedNotionalMinor: 0n,
          cashMinorSeries: cashSeries.slice(mid),
          tradeCount: 0,
          winCount: 0,
          lossCount: 0,
          observationDays: secondHalf.length,
        }),
        observationCount: secondHalf.length,
      }),
    );
  }

  const succeeded = metrics.netEconomicsMinor >= 0n || input.config.runKind === 'EXPERIMENT';
  return ok(
    Object.freeze({
      metrics,
      benchmarks,
      regimeSlices: Object.freeze(regimeSlices),
      limitations: Object.freeze(limitations),
      succeeded,
      failureCode: metrics.netEconomicsMinor < 0n ? 'NEGATIVE_NET_ECONOMICS' : null,
      failureMessage: metrics.netEconomicsMinor < 0n ? 'strategy produced negative net economics under realistic costs' : null,
    }),
  );
}

export function runChronologicalEvaluation(input: {
  readonly capsule: StrategyCapsule;
  readonly manifest: EvaluationDatasetManifest;
  readonly config: ChronologicalEvaluationConfig;
  readonly createdAt: UtcInstant;
  readonly store?: ChronologicalEvaluationStore;
}): Result<ChronologicalEvaluationResult, EvaluationFailure> {
  if (input.config.customerId) {
    const store = input.store ?? new ChronologicalEvaluationStore();
    for (const prior of store.listForCustomer(input.config.customerId)) {
      if (prior.customerId !== input.config.customerId) {
        return err({
          code: 'CUSTOMER_ISOLATION_VIOLATION',
          message: 'customer evaluation isolation violated on read',
        });
      }
    }
  }

  const loop = runChronologicalLoop(input);
  if (!loop.ok) {
    const record = sealEvaluationRecord({
      capsule: input.capsule,
      manifest: input.manifest,
      config: input.config,
      metrics: extendMetrics({
        base: calculateMetrics({
          startingCapitalMinor: input.config.startingCapitalMinor,
          endingCapitalMinor: input.config.startingCapitalMinor,
          equity: [],
          feesMinor: 0n,
          tradedNotionalMinor: 0n,
          cashMinorSeries: [],
          tradeCount: 0,
          winCount: 0,
          lossCount: 0,
          observationDays: 0,
        }),
        economics: buildEvaluationEconomics({
          startingCapitalMinor: input.config.startingCapitalMinor,
          endingCapitalMinor: input.config.startingCapitalMinor,
          feesMinor: 0n,
          spreadCostMinor: 0n,
          slippageCostMinor: 0n,
          operatingResearchCostMinor: input.config.operatingResearchCostMinor,
        }),
        startingCapitalMinor: input.config.startingCapitalMinor,
        averageHoldingDays: null,
        concentrationTopInstrumentBps: null,
        worstPeriodReturn: null,
      }),
      benchmarks: Object.freeze([]),
      regimeSlices: Object.freeze([]),
      limitations: Object.freeze([...manifestLimitations(input.manifest)]),
      qualificationOutcome: 'FAILED',
      succeeded: false,
      failureCode: loop.error.code,
      failureMessage: loop.error.message,
      createdAt: input.createdAt,
    });
    const store = input.store ?? new ChronologicalEvaluationStore();
    store.persist(record);
    return err(loop.error);
  }

  const outcome =
    loop.value.metrics.netEconomicsMinor > 0n
      ? 'PASSED'
      : loop.value.metrics.netEconomicsMinor === 0n
        ? 'INCONCLUSIVE'
        : 'FAILED';

  const record = sealEvaluationRecord({
    capsule: input.capsule,
    manifest: input.manifest,
    config: input.config,
    metrics: loop.value.metrics,
    benchmarks: loop.value.benchmarks,
    regimeSlices: loop.value.regimeSlices,
    limitations: loop.value.limitations,
    qualificationOutcome: outcome,
    succeeded: true,
    failureCode: loop.value.failureCode,
    failureMessage: loop.value.failureMessage,
    artifactRefs: Object.freeze([`manifest:${input.manifest.hash}`, `capsule:${input.capsule.fingerprint}`]),
    createdAt: input.createdAt,
  });

  const store = input.store ?? new ChronologicalEvaluationStore();
  store.persist(record);

  if (input.config.mode === 'WALK_FORWARD' && input.config.walkForward) {
    const view = manifestViewAt(input.manifest, input.config.period.end);
    if (view.ok) {
      const wf = runWalkForward({
        specification: input.capsule.specification,
        plan: input.capsule.plan,
        dataset: view.value,
        parameterSet: input.capsule.parameterSet,
        startingCapitalMinor: input.config.startingCapitalMinor,
        trainDays: input.config.walkForward.trainDays,
        testDays: input.config.walkForward.testDays,
        generatedAt: input.createdAt,
      });
      if (wf.ok) {
        return ok(Object.freeze({ record, walkForwardRunId: wf.value.runId }));
      }
    }
  }

  return ok(Object.freeze({ record }));
}

export function assertEvaluationReproducible(
  first: StrategyEvaluationRecord,
  second: StrategyEvaluationRecord,
): boolean {
  return first.outputHash === second.outputHash && first.capsuleFingerprint === second.capsuleFingerprint;
}

export function deterministicEvaluationSeed(capsule: StrategyCapsule, manifest: EvaluationDatasetManifest): string {
  return createHash('sha256')
    .update(`${capsule.fingerprint}:${manifest.hash}:${manifest.observationCount}`)
    .digest('hex')
    .slice(0, 16);
}
