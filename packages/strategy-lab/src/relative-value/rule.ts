import type { UtcInstant } from '@solstice/domain';
import { HELIOS_M12_RULE_ID } from './constants.ts';
import { resolveM12PairDefinition, type M12PairId } from './ids.ts';
import { buildM12StrategyProposal } from './proposal.ts';
import type { M12StrategyParameters } from './parameters.ts';
import { discoverRelationship, indexAtOrBefore, barsForInstrument } from './relationship.ts';
import { validatePair } from './validation.ts';
import type {
  M12BarObservation,
  M12EvaluationContext,
  M12ExitReason,
  M12OpenSpreadPosition,
  M12StrategyProposal,
} from './types.ts';

export { HELIOS_M12_RULE_ID };

function absBigint(value: bigint): bigint {
  return value < 0n ? -value : value;
}

function isStale(bar: M12BarObservation, now: UtcInstant, maxAgeMs: number): boolean {
  return Date.parse(now) - Date.parse(bar.knowableAt) > maxAgeMs;
}

function governanceBlock(ctx: M12EvaluationContext): string | null {
  if (!ctx.workOrderActive) {
    return 'WORK_ORDER_INACTIVE';
  }
  if (!ctx.mandateActive) {
    return 'MANDATE_INACTIVE';
  }
  if (!ctx.envelopeValid) {
    return 'ENVELOPE_INVALID';
  }
  if (!ctx.pairEligible) {
    return 'PAIR_INELIGIBLE';
  }
  if (ctx.strategyInvalidated) {
    return 'STRATEGY_INVALIDATED';
  }
  return null;
}

function exitReason(input: {
  readonly relationship: NonNullable<ReturnType<typeof discoverRelationship>>;
  readonly params: M12StrategyParameters;
  readonly position: M12OpenSpreadPosition;
  readonly barIndex: number;
  readonly ctx: M12EvaluationContext;
  readonly validationOutcome: string;
}): M12ExitReason {
  if (ctxForce(input.ctx)) {
    return 'FORCED_UNWIND';
  }
  if (input.validationOutcome === 'CORRELATION_COLLAPSE') {
    return 'CORRELATION_COLLAPSE';
  }
  if (absBigint(input.relationship.spreadZScoreScaled) >= input.params.stopZScoreThresholdScaled) {
    return 'SPREAD_WIDENING';
  }
  if (input.barIndex - input.position.entryBarIndex >= input.params.maxHoldBars) {
    return 'TIME_STOP';
  }
  const reverted =
    input.position.direction === 'LONG_SPREAD'
      ? input.relationship.spreadZScoreScaled >= -input.params.exitZScoreTargetScaled
      : input.relationship.spreadZScoreScaled <= input.params.exitZScoreTargetScaled;
  if (reverted) {
    return 'MEAN_REVERSION_TARGET';
  }
  return 'NONE';
}

function ctxForce(ctx: M12EvaluationContext): boolean {
  return ctx.forceClose || ctx.strategyInvalidated;
}

export function evaluateM12RelativeValueStatArb(input: {
  readonly pairId: M12PairId;
  readonly allBars: readonly M12BarObservation[];
  readonly now: UtcInstant;
  readonly params: M12StrategyParameters;
  readonly ctx: M12EvaluationContext;
  readonly openPosition: M12OpenSpreadPosition | null;
  readonly marketRegime?: 'MEAN_REVERTING' | 'TRENDING' | 'HIGH_VOL' | 'UNKNOWN';
}): M12StrategyProposal {
  const pair = resolveM12PairDefinition(input.pairId);
  const governance = governanceBlock(input.ctx);
  const validation = validatePair({
    pairId: input.pairId,
    allBars: input.allBars,
    now: input.now,
    params: input.params,
    marketRegime: input.marketRegime,
  });
  const relationship = validation.relationship;

  const legA = barsForInstrument(input.allBars, pair.legAInstrumentId);
  const barIndex = indexAtOrBefore(legA, input.now);
  const barA = barIndex >= 0 ? legA[barIndex] : null;

  if (governance) {
    return buildM12StrategyProposal({
      pairId: input.pairId,
      action: 'NO_ACTION',
      spreadDirection: null,
      relationship,
      evidence: Object.freeze([`governance_block:${governance}`]),
      invalidatingConditions: Object.freeze([governance]),
      exitReason: 'NONE',
      rationale: `No action: ${governance}`,
      decidedAt: input.now,
      parameterVersion: input.params.version,
    });
  }

  if (barA && isStale(barA, input.now, input.params.maxObservationAgeMs)) {
    return buildM12StrategyProposal({
      pairId: input.pairId,
      action: 'NO_ACTION',
      spreadDirection: null,
      relationship,
      evidence: Object.freeze(['stale_observation']),
      invalidatingConditions: Object.freeze(['STALE_OBSERVATION']),
      exitReason: 'NONE',
      rationale: 'No action: stale observation',
      decidedAt: input.now,
      parameterVersion: input.params.version,
    });
  }

  if (input.openPosition) {
    if (!relationship) {
      return buildM12StrategyProposal({
        pairId: input.pairId,
        action: 'HOLD_SPREAD',
        spreadDirection: input.openPosition.direction,
        relationship: null,
        evidence: Object.freeze(['insufficient_history_during_open_position']),
        invalidatingConditions: Object.freeze(['INSUFFICIENT_HISTORY']),
        exitReason: 'NONE',
        rationale: 'Hold spread — insufficient feature history',
        decidedAt: input.now,
        parameterVersion: input.params.version,
      });
    }

    const reason = exitReason({
      relationship,
      params: input.params,
      position: input.openPosition,
      barIndex,
      ctx: input.ctx,
      validationOutcome: validation.outcome,
    });

    if (reason !== 'NONE') {
      return buildM12StrategyProposal({
        pairId: input.pairId,
        action: 'EXIT_SPREAD',
        spreadDirection: input.openPosition.direction,
        relationship,
        evidence: Object.freeze([
          `exit:${reason}`,
          `spread_z=${relationship.spreadZScoreScaled.toString()}`,
          `corr=${relationship.rollingCorrelationScaled.toString()}`,
        ]),
        invalidatingConditions: Object.freeze([
          'CORRELATION_COLLAPSE',
          'SPREAD_WIDENING',
          'MEAN_REVERSION_TARGET',
          'TIME_STOP',
        ]),
        exitReason: reason,
        rationale: `Exit spread: ${reason}`,
        decidedAt: input.now,
        parameterVersion: input.params.version,
      });
    }

    return buildM12StrategyProposal({
      pairId: input.pairId,
      action: 'HOLD_SPREAD',
      spreadDirection: input.openPosition.direction,
      relationship,
      evidence: Object.freeze([`spread_z=${relationship.spreadZScoreScaled.toString()}`]),
      invalidatingConditions: Object.freeze(['CORRELATION_COLLAPSE', 'SPREAD_WIDENING']),
      exitReason: 'NONE',
      rationale: `Hold open spread z=${relationship.spreadZScoreScaled.toString()}`,
      decidedAt: input.now,
      parameterVersion: input.params.version,
    });
  }

  if (!validation.qualified || !relationship) {
    return buildM12StrategyProposal({
      pairId: input.pairId,
      action: 'NO_ACTION',
      spreadDirection: null,
      relationship,
      evidence: Object.freeze([`validation:${validation.outcome}`, ...validation.blockers]),
      invalidatingConditions: Object.freeze([validation.outcome]),
      exitReason: 'NONE',
      rationale: `No entry: ${validation.outcome}`,
      decidedAt: input.now,
      parameterVersion: input.params.version,
    });
  }

  const z = relationship.spreadZScoreScaled;
  if (absBigint(z) < input.params.entryZScoreThresholdScaled) {
    return buildM12StrategyProposal({
      pairId: input.pairId,
      action: 'NO_ACTION',
      spreadDirection: null,
      relationship,
      evidence: Object.freeze([`spread_z=${z.toString()}`, 'below_entry_threshold']),
      invalidatingConditions: Object.freeze(['DEVIATION_BELOW_THRESHOLD']),
      exitReason: 'NONE',
      rationale: `No entry: |z| below threshold (${z.toString()})`,
      decidedAt: input.now,
      parameterVersion: input.params.version,
    });
  }

  const direction: 'LONG_SPREAD' | 'SHORT_SPREAD' = z < 0n ? 'LONG_SPREAD' : 'SHORT_SPREAD';
  return buildM12StrategyProposal({
    pairId: input.pairId,
    action: 'ENTER_SPREAD',
    spreadDirection: direction,
    relationship,
    evidence: Object.freeze([
      `spread_z=${z.toString()}`,
      `corr=${relationship.rollingCorrelationScaled.toString()}`,
      `cointegration=${relationship.cointegrationOutcome}`,
      'pair_validation_qualified',
    ]),
    invalidatingConditions: Object.freeze([
      'CORRELATION_COLLAPSE',
      'SPREAD_WIDENING',
      'STALE_OBSERVATION',
      'PROVIDER_DEGRADED',
    ]),
    exitReason: 'NONE',
    rationale: `Enter ${direction}: spread z=${z.toString()}`,
    decidedAt: input.now,
    parameterVersion: input.params.version,
  });
}
