import type { UtcInstant } from '@solstice/domain';

import { filterKnowableMarketEvents } from './knowable-at.ts';
import { buildPrequentialDecisionId, predictPrequentialAt } from './predict.ts';
import { sealPrequentialDecision } from './seal.ts';
import type { PrequentialChronologicalObservation } from './types.ts';

/**
 * Returns false when a not-yet-knowable observation would change the sealed decision.
 */
export function verifyPrequentialPointInTimeIsolation(input: {
  readonly campaignId: string;
  readonly instrumentId: string;
  readonly decisionTime: UtcInstant;
  readonly baseline: readonly PrequentialChronologicalObservation[];
  readonly withFutureProbe: readonly PrequentialChronologicalObservation[];
  readonly outcomeHorizonMs: number;
  readonly modelVersion: string;
}): boolean {
  const baseDraft = predictPrequentialAt({
    decisionTime: input.decisionTime,
    instrumentId: input.instrumentId,
    observations: input.baseline,
  });
  const probeDraft = predictPrequentialAt({
    decisionTime: input.decisionTime,
    instrumentId: input.instrumentId,
    observations: input.withFutureProbe,
  });
  if (baseDraft === null || probeDraft === null) {
    return false;
  }
  if (baseDraft.contextDigest !== probeDraft.contextDigest) {
    return false;
  }
  const decisionId = buildPrequentialDecisionId(input.campaignId, input.decisionTime);
  const sealed = sealPrequentialDecision({
    decisionId,
    campaignId: input.campaignId,
    decisionTime: input.decisionTime,
    predictedLabel: baseDraft.predictedLabel,
    predictedReferenceMidMinor: baseDraft.predictedReferenceMidMinor,
    instrumentId: input.instrumentId,
    contextDigest: baseDraft.contextDigest,
    observationEventIdsAtDecision: baseDraft.observationEventIdsAtDecision,
    outcomeHorizonMs: input.outcomeHorizonMs,
    modelVersion: input.modelVersion,
    sealedAt: input.decisionTime,
  });
  const knowableIds = new Set(
    filterKnowableMarketEvents(input.decisionTime, input.withFutureProbe).map((row) => row.event.eventId),
  );
  for (const id of sealed.observationEventIdsAtDecision) {
    if (!knowableIds.has(id)) {
      return false;
    }
  }
  return (
    baseDraft.predictedLabel === probeDraft.predictedLabel &&
    baseDraft.predictedReferenceMidMinor === probeDraft.predictedReferenceMidMinor
  );
}
