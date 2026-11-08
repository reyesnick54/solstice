import { createHash } from 'node:crypto';

import type { UtcInstant } from '@solstice/domain';

import type { PrequentialPredictedLabel } from './taxonomy.ts';
import { filterKnowableMarketEvents, midPriceMinorFromQuote } from './knowable-at.ts';
import { digestPrequentialContext, labelFromMidDelta } from './seal.ts';
import type { PrequentialChronologicalObservation } from './types.ts';

export type PrequentialPredictionDraft = Readonly<{
  readonly predictedLabel: PrequentialPredictedLabel;
  readonly predictedReferenceMidMinor: string;
  readonly contextDigest: string;
  readonly observationEventIdsAtDecision: readonly string[];
}>;

export function buildPrequentialDecisionId(
  campaignId: string,
  decisionTime: UtcInstant,
): string {
  const material = `${campaignId}:${decisionTime}`;
  return `pdec_${createHash('sha256').update(material).digest('hex').slice(0, 24)}`;
}

/**
 * Point-in-time predictor: only observations with knowableAt <= decisionTime.
 */
export function predictPrequentialAt(input: {
  readonly decisionTime: UtcInstant;
  readonly instrumentId: string;
  readonly observations: readonly PrequentialChronologicalObservation[];
}): PrequentialPredictionDraft | null {
  const knowable = filterKnowableMarketEvents(input.decisionTime, input.observations);
  const forInstrument = knowable.filter((row) => row.event.instrumentId === input.instrumentId);
  if (forInstrument.length === 0) {
    return null;
  }
  const sorted = [...forInstrument].sort((a, b) => a.chronologicalIndex - b.chronologicalIndex);
  const latest = sorted[sorted.length - 1]!;
  const currentMid = midPriceMinorFromQuote(latest.event);
  if (currentMid === null) {
    return null;
  }
  const prior = sorted.length >= 2 ? sorted[sorted.length - 2]! : null;
  const priorMid = prior ? midPriceMinorFromQuote(prior.event) : null;
  const predictedLabel = labelFromMidDelta(priorMid, currentMid);
  const midsByEventId: Record<string, string> = {};
  const ids: string[] = [];
  for (const row of sorted) {
    const mid = midPriceMinorFromQuote(row.event);
    if (mid !== null) {
      midsByEventId[row.event.eventId] = mid;
      ids.push(row.event.eventId);
    }
  }
  const contextDigest = digestPrequentialContext({
    decisionTime: input.decisionTime,
    instrumentId: input.instrumentId,
    observationEventIds: ids,
    midsByEventId,
  });
  return Object.freeze({
    predictedLabel,
    predictedReferenceMidMinor: currentMid,
    contextDigest,
    observationEventIdsAtDecision: Object.freeze([...ids]),
  });
}
