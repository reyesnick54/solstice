import type { UtcInstant } from '@solstice/domain';
import { err, ok, type Result } from '@solstice/domain';

import { filterKnowableMarketEvents, midPriceMinorFromQuote } from '../alpha03/knowable-at.ts';
import { labelFromMidDelta } from '../alpha03/seal.ts';
import type { PrequentialChronologicalObservation } from '../alpha03/types.ts';

import { digestOutcomeMaturityContent } from './digest.ts';
import { HELIOS_ALPHA19_OUTCOME_MATURITY_SCHEMA } from './taxonomy.ts';
import type {
  MaturedOutcome,
  OutcomeMaturityEngineFailure,
  OutcomeObservationWindow,
  OutcomeRealizedLabel,
  OutcomeSealedDecisionBinding,
} from './types.ts';

export type OutcomeObservationSlice = Readonly<{
  readonly realizedMidMinor: string;
  readonly realizedLabel: OutcomeRealizedLabel;
  readonly observationEventIdsChronological: readonly string[];
}>;

function instrumentObservationsThroughHorizon(
  window: OutcomeObservationWindow,
  instrumentId: string,
  observations: readonly PrequentialChronologicalObservation[],
): readonly PrequentialChronologicalObservation[] {
  const endMs = Date.parse(window.windowEnd);
  return Object.freeze(
    observations
      .filter((row) => row.event.instrumentId === instrumentId)
      .filter((row) => Date.parse(row.event.knowableAt) <= endMs)
      .sort((a, b) => a.chronologicalIndex - b.chronologicalIndex),
  );
}

function observationsKnowableNowThroughWindow(input: {
  readonly now: UtcInstant;
  readonly window: OutcomeObservationWindow;
  readonly instrumentId: string;
  readonly observations: readonly PrequentialChronologicalObservation[];
}): readonly PrequentialChronologicalObservation[] {
  const knowableAtNow = filterKnowableMarketEvents(input.now, input.observations);
  const endMs = Date.parse(input.window.windowEnd);
  return Object.freeze(
    knowableAtNow
      .filter((row) => row.event.instrumentId === input.instrumentId)
      .filter((row) => Date.parse(row.event.knowableAt) <= endMs)
      .sort((a, b) => a.chronologicalIndex - b.chronologicalIndex),
  );
}

function horizonObservationsAwaitingKnowability(input: {
  readonly now: UtcInstant;
  readonly window: OutcomeObservationWindow;
  readonly instrumentId: string;
  readonly observations: readonly PrequentialChronologicalObservation[];
}): boolean {
  const nowMs = Date.parse(input.now);
  const endMs = Date.parse(input.window.windowEnd);
  return input.observations.some((row) => {
    if (row.event.instrumentId !== input.instrumentId) {
      return false;
    }
    const k = Date.parse(row.event.knowableAt);
    return k > nowMs && k <= endMs;
  });
}

export function assertNoPartialFuturePathInSlice(
  window: OutcomeObservationWindow,
  slice: readonly PrequentialChronologicalObservation[],
): Result<true, OutcomeMaturityEngineFailure> {
  const endMs = Date.parse(window.windowEnd);
  for (const row of slice) {
    if (Date.parse(row.event.knowableAt) > endMs) {
      return err({
        code: 'PARTIAL_FUTURE_PATH_FORBIDDEN',
        message: `observation ${row.event.eventId} knowable after horizon`,
      });
    }
  }
  return ok(true);
}

export function computeOutcomeObservationSlice(input: {
  readonly now: UtcInstant;
  readonly window: OutcomeObservationWindow;
  readonly binding: OutcomeSealedDecisionBinding;
  readonly observations: readonly PrequentialChronologicalObservation[];
}): Result<OutcomeObservationSlice, OutcomeMaturityEngineFailure> {
  if (Date.parse(input.now) < Date.parse(input.window.windowEnd)) {
    return err({
      code: 'OUTCOME_BEFORE_MATURITY',
      message: `maturity at ${input.window.windowEnd}`,
    });
  }
  if (horizonObservationsAwaitingKnowability(input)) {
    return err({
      code: 'NOT_YET_KNOWABLE',
      message: 'horizon observations not yet knowable at now',
    });
  }
  const chronological = observationsKnowableNowThroughWindow({
    now: input.now,
    window: input.window,
    instrumentId: input.binding.instrumentId,
    observations: input.observations,
  });
  const gate = assertNoPartialFuturePathInSlice(input.window, chronological);
  if (!gate.ok) {
    return gate;
  }
  const throughHorizon = instrumentObservationsThroughHorizon(
    input.window,
    input.binding.instrumentId,
    input.observations,
  );
  if (throughHorizon.length === 0) {
    return err({
      code: 'OUTCOME_DATA_INCOMPLETE',
      message: 'no observations exist through horizon',
    });
  }
  if (chronological.length === 0) {
    return err({
      code: 'OUTCOME_DATA_INCOMPLETE',
      message: 'knowable observations missing through horizon',
    });
  }
  const latest = chronological[chronological.length - 1]!;
  const mid = midPriceMinorFromQuote(latest.event);
  if (mid === null) {
    return err({
      code: 'OUTCOME_DATA_INCOMPLETE',
      message: 'latest observation has no quote mid',
    });
  }
  const realizedLabel = labelFromMidDelta(input.binding.referenceMidMinor, mid);
  return ok(
    Object.freeze({
      realizedMidMinor: mid,
      realizedLabel,
      observationEventIdsChronological: Object.freeze(chronological.map((row) => row.event.eventId)),
    }),
  );
}

export function sealMaturedOutcome(input: {
  readonly pendingId: string;
  readonly binding: OutcomeSealedDecisionBinding;
  readonly window: OutcomeObservationWindow;
  readonly slice: OutcomeObservationSlice;
  readonly realizedAt: UtcInstant;
}): MaturedOutcome {
  const bindingDigest = digestOutcomeMaturityContent(input.binding);
  const core = {
    schema: HELIOS_ALPHA19_OUTCOME_MATURITY_SCHEMA,
    maturedOutcomeId: `mout_${input.pendingId}`,
    pendingId: input.pendingId,
    decisionId: input.binding.decisionId,
    horizonId: input.window.horizonId,
    observationWindow: input.window,
    realizedAt: input.realizedAt,
    realizedMidMinor: input.slice.realizedMidMinor,
    realizedLabel: input.slice.realizedLabel,
    observationEventIdsChronological: input.slice.observationEventIdsChronological,
    bindingDigest,
    immutable: true as const,
  };
  const contentHash = digestOutcomeMaturityContent(core);
  return Object.freeze({
    ...core,
    seal: Object.freeze({
      sealedAt: input.realizedAt,
      contentHash,
    }),
  });
}
