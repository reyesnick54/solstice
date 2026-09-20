import type { UtcInstant } from '@solstice/domain';
import {
  buildFeatureSnapshot,
  barsForInstrument,
  indexAtOrBefore,
  absZScoreScaled,
} from './features.ts';
import type { M09StrategyParameters } from './parameters.ts';
import type {
  M09BarObservation,
  M09DecisionAction,
  M09EntryBlockReason,
  M09EvaluationContext,
  M09ExitReason,
  M09OpenPosition,
  M09StrategyDecision,
} from './types.ts';

export const HELIOS_M09_INDEX_MEAN_REVERSION_RULE_ID =
  'HELIOS_M09_INDEX_MEAN_REVERSION_V1' as const;

function recommendedExposureBps(zScoreScaled: bigint | null, params: M09StrategyParameters): number {
  if (zScoreScaled === null || zScoreScaled >= 0n) {
    return 0;
  }
  const magnitude = Number(absZScoreScaled(zScoreScaled));
  const scaled = Math.min(params.maxRecommendedExposureBps, Math.floor(magnitude * 10));
  return Math.max(0, scaled);
}

function entryBlockReason(input: {
  readonly features: ReturnType<typeof buildFeatureSnapshot>;
  readonly params: M09StrategyParameters;
  readonly ctx: M09EvaluationContext;
}): M09EntryBlockReason {
  if (!input.ctx.workOrderActive) {
    return 'WORK_ORDER_INACTIVE';
  }
  if (!input.ctx.mandateActive) {
    return 'MANDATE_INACTIVE';
  }
  if (!input.ctx.envelopeValid) {
    return 'ENVELOPE_INVALID';
  }
  if (!input.ctx.instrumentEligible) {
    return 'INSTRUMENT_INELIGIBLE';
  }
  if (input.ctx.strategyInvalidated) {
    return 'STRATEGY_INVALIDATED';
  }
  if (!input.features) {
    return 'INSUFFICIENT_HISTORY';
  }
  if (input.features.stale) {
    return 'STALE_OBSERVATION';
  }
  if (input.features.sessionState === 'CLOSED') {
    return 'MARKET_CLOSED';
  }
  if (input.features.marketState === 'STALE' || input.features.marketState === 'UNAVAILABLE') {
    return 'STALE_OBSERVATION';
  }
  if (input.features.historyBars < input.params.minHistoryBars) {
    return 'INSUFFICIENT_HISTORY';
  }
  if (
    input.features.spreadBps !== null &&
    input.features.spreadBps > input.params.maxSpreadBps
  ) {
    return 'SPREAD_TOO_WIDE';
  }
  if (
    input.features.realizedVolBps !== null &&
    input.features.realizedVolBps > input.params.maxRealizedVolBps
  ) {
    return 'VOLATILITY_TOO_HIGH';
  }
  if (
    input.features.zScoreScaled === null ||
    input.features.zScoreScaled > -input.params.entryZScoreThresholdScaled
  ) {
    return 'DEVIATION_BELOW_THRESHOLD';
  }
  return 'OK';
}

function exitReason(input: {
  readonly features: NonNullable<ReturnType<typeof buildFeatureSnapshot>>;
  readonly params: M09StrategyParameters;
  readonly position: M09OpenPosition;
  readonly barIndex: number;
  readonly ctx: M09EvaluationContext;
}): M09ExitReason {
  if (input.ctx.riskEngineForcedClose) {
    return 'RISK_ENGINE_FORCED_CLOSE';
  }
  if (input.ctx.forceClose) {
    return 'EMERGENCY_CLOSE';
  }
  if (input.ctx.strategyInvalidated) {
    return 'STRATEGY_INVALIDATION';
  }
  if (
    input.params.endOfSessionFlat &&
    (input.features.sessionState === 'CLOSED' || input.features.sessionState === 'POST_MARKET')
  ) {
    return 'END_OF_SESSION';
  }
  if (
    input.features.realizedVolBps !== null &&
    input.features.realizedVolBps > input.params.maxRealizedVolBps
  ) {
    return 'VOLATILITY_STOP';
  }
  if (input.barIndex - input.position.entryBarIndex >= input.params.maxHoldBars) {
    return 'TIME_STOP';
  }
  if (input.features.zScoreScaled !== null && input.features.zScoreScaled >= -input.params.exitZScoreTargetScaled) {
    return 'MEAN_REVERSION_TARGET';
  }
  return 'NONE';
}

function decision(
  action: M09DecisionAction,
  instrumentId: string,
  recommendedExposureBps: number,
  zScoreScaled: bigint | null,
  entryBlockReason: M09EntryBlockReason,
  exitReason: M09ExitReason,
  rationale: string,
  decidedAt: UtcInstant,
  parameterVersion: string,
): M09StrategyDecision {
  return Object.freeze({
    action,
    instrumentId,
    recommendedExposureBps,
    zScoreScaled,
    entryBlockReason,
    exitReason,
    rationale,
    decidedAt,
    parameterVersion,
  });
}

export function evaluateM09IndexMeanReversion(input: {
  readonly instrumentId: string;
  readonly allBars: readonly M09BarObservation[];
  readonly now: UtcInstant;
  readonly params: M09StrategyParameters;
  readonly ctx: M09EvaluationContext;
  readonly openPosition: M09OpenPosition | null;
}): M09StrategyDecision {
  const instrumentBars = barsForInstrument(input.allBars, input.instrumentId);
  const barIndex = indexAtOrBefore(instrumentBars, input.now);
  if (barIndex < 0) {
    return decision(
      'NO_ACTION',
      input.instrumentId,
      0,
      null,
      'INSUFFICIENT_HISTORY',
      'NONE',
      'No knowable bar history for instrument',
      input.now,
      input.params.version,
    );
  }

  const features = buildFeatureSnapshot({
    bars: instrumentBars,
    endIndex: barIndex,
    rollingWindow: input.params.rollingWindowBars,
    volWindow: input.params.volWindowBars,
    now: input.now,
    maxObservationAgeMs: input.params.maxObservationAgeMs,
  });

  if (input.openPosition) {
    if (!features) {
      return decision(
        'HOLD',
        input.instrumentId,
        0,
        null,
        'INSUFFICIENT_HISTORY',
        'NONE',
        'Hold — insufficient feature history during open position',
        input.now,
        input.params.version,
      );
    }
    const reason = exitReason({
      features,
      params: input.params,
      position: input.openPosition,
      barIndex,
      ctx: input.ctx,
    });
    if (reason !== 'NONE') {
      return decision(
        'SELL',
        input.instrumentId,
        0,
        features.zScoreScaled,
        'OK',
        reason,
        `Exit: ${reason} z=${features.zScoreScaled?.toString() ?? 'null'}`,
        input.now,
        input.params.version,
      );
    }
    return decision(
      'HOLD',
      input.instrumentId,
      0,
      features.zScoreScaled,
      'OK',
      'NONE',
      `Hold open position z=${features.zScoreScaled?.toString() ?? 'null'}`,
      input.now,
      input.params.version,
    );
  }

  const block = entryBlockReason({ features, params: input.params, ctx: input.ctx });
  if (block !== 'OK') {
    return decision(
      'NO_ACTION',
      input.instrumentId,
      0,
      features?.zScoreScaled ?? null,
      block,
      'NONE',
      `No entry: ${block}`,
      input.now,
      input.params.version,
    );
  }

  const exposure = recommendedExposureBps(features!.zScoreScaled, input.params);
  return decision(
    'BUY',
    input.instrumentId,
    exposure,
    features!.zScoreScaled,
    'OK',
    'NONE',
    `Entry: z=${features!.zScoreScaled?.toString() ?? 'null'} exposure=${exposure}bps`,
    input.now,
    input.params.version,
  );
}

/** Select the instrument with the strongest negative z-score eligible for entry. */
export function evaluateM09Universe(input: {
  readonly instrumentIds: readonly string[];
  readonly allBars: readonly M09BarObservation[];
  readonly now: UtcInstant;
  readonly params: M09StrategyParameters;
  readonly ctx: M09EvaluationContext;
  readonly openPositions: readonly M09OpenPosition[];
}): readonly M09StrategyDecision[] {
  const decisions: M09StrategyDecision[] = [];
  for (const instrumentId of input.instrumentIds) {
    const open = input.openPositions.find((row) => row.instrumentId === instrumentId) ?? null;
    decisions.push(
      evaluateM09IndexMeanReversion({
        instrumentId,
        allBars: input.allBars,
        now: input.now,
        params: input.params,
        ctx: input.ctx,
        openPosition: open,
      }),
    );
  }
  return Object.freeze(decisions);
}
