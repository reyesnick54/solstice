/**
 * Post-event realized comparison — must never be merged into pre-event expectation state.
 */

import { HELIOS_EARN07_OPTIONS_INTELLIGENCE_SCHEMA } from './taxonomy.ts';
import { assertRealizedComparisonTiming } from './certification.ts';
import type { OptionsEarningsRealizedComparison, OptionsPreEventMetrics } from './types.ts';
import type { UtcInstant } from '@solstice/domain';

export function computeRealizedComparison(input: {
  readonly earningsEventId: string;
  readonly eventScheduledAt: UtcInstant;
  readonly preEventMetrics: OptionsPreEventMetrics;
  readonly preEventSpotMinor: bigint;
  readonly postEventSpotMinor: bigint;
  readonly postEventNearTermIvBps: number | null;
  readonly realizedAt: UtcInstant;
}): OptionsEarningsRealizedComparison {
  const timing = assertRealizedComparisonTiming({
    preEventEvaluationTime: input.preEventMetrics.evaluationTime,
    eventScheduledAt: input.eventScheduledAt,
    realizedAt: input.realizedAt,
  });
  if (!timing.ok) {
    throw new Error(`realized_comparison_timing:${timing.reason}`);
  }
  const preSpot = Number(input.preEventSpotMinor);
  const postSpot = Number(input.postEventSpotMinor);
  const realizedMoveBps =
    preSpot > 0 ? Math.round(((postSpot - preSpot) / preSpot) * 10_000) : 0;
  const implied =
    input.preEventMetrics.ATMStraddleImpliedMoveBps ??
    input.preEventMetrics.IVExpectedMoveBps ??
    null;
  const impliedMoveErrorBps =
    implied !== null ? Math.abs(realizedMoveBps) - implied : null;
  const volatilityCrushBps =
    input.preEventMetrics.NearTermIVBps !== null && input.postEventNearTermIvBps !== null
      ? input.postEventNearTermIvBps - input.preEventMetrics.NearTermIVBps
      : null;
  const imbalance = input.preEventMetrics.CallPutDemandImbalanceScaled;
  const directionalDemandAccuracyScaled =
    imbalance === null
      ? null
      : realizedMoveBps === 0
        ? 5000
        : Math.round(
            (Math.sign(realizedMoveBps) === Math.sign(imbalance) ? 10_000 : 0) *
              (Math.min(Math.abs(realizedMoveBps), Math.abs(imbalance)) /
                Math.max(Math.abs(realizedMoveBps), Math.abs(imbalance), 1)),
          );

  return Object.freeze({
    schema: HELIOS_EARN07_OPTIONS_INTELLIGENCE_SCHEMA,
    earningsEventId: input.earningsEventId,
    realizedAt: input.realizedAt,
    preEventEvaluationTime: input.preEventMetrics.evaluationTime,
    realizedMoveBps,
    impliedMoveErrorBps,
    volatilityCrushBps,
    directionalDemandAccuracyScaled,
    grantsExecutionAuthority: false,
  });
}
