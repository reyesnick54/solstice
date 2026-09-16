/**
 * Information-time rule — separates "when did it happen" from "when could SunRey know it".
 */

import { asUtcInstant, type UtcInstant } from '../../../../domain/src/time.ts';
import type { ExternalObservation } from '../../../../provider-sdk/src/types.ts';
import type { InformationTime } from './types.ts';

export function buildInformationTime(input: {
  readonly observation: ExternalObservation<unknown>;
  readonly sourceEventTime?: UtcInstant | null;
  readonly sourcePublishedTime?: UtcInstant | null;
  readonly providerAvailabilityTime?: UtcInstant | null;
  readonly sunreyArrivalTime?: UtcInstant;
  readonly ingestionTime: UtcInstant;
}): InformationTime {
  const sourceEventTime =
    input.sourceEventTime ??
    input.observation.time.sourceTimestamp ??
    input.observation.time.effectiveAt ??
    null;
  const sourcePublishedTime = input.sourcePublishedTime ?? null;
  const providerAvailabilityTime = input.providerAvailabilityTime ?? null;
  const sunreyArrivalTime = input.sunreyArrivalTime ?? input.observation.time.retrievedAt;
  const ingestionTime = input.ingestionTime;

  const knowableAt = computeKnowableAt({
    providerAvailabilityTime,
    sunreyArrivalTime,
    ingestionTime,
  });

  return Object.freeze({
    sourceEventTime,
    sourcePublishedTime,
    providerAvailabilityTime,
    sunreyArrivalTime,
    ingestionTime,
    knowableAt,
  });
}

/**
 * Earliest instant SunRey could have known the observation.
 * Uses the latest of known availability/arrival times — never fabricates earlier knowability.
 */
export function computeKnowableAt(input: {
  readonly providerAvailabilityTime: UtcInstant | null;
  readonly sunreyArrivalTime: UtcInstant;
  readonly ingestionTime: UtcInstant;
}): UtcInstant {
  const candidates: UtcInstant[] = [input.sunreyArrivalTime, input.ingestionTime];
  if (input.providerAvailabilityTime) {
    candidates.push(input.providerAvailabilityTime);
  }
  return candidates.reduce((latest, current) => {
    const latestMs = Date.parse(latest);
    const currentMs = Date.parse(current);
    if (!Number.isFinite(latestMs)) return current;
    if (!Number.isFinite(currentMs)) return latest;
    return currentMs > latestMs ? current : latest;
  });
}

/** Chronological strategy evaluation must not use an observation before knowableAt. */
export function isKnowableAt(evaluationTimeUtc: UtcInstant, informationTime: InformationTime): boolean {
  const evalMs = Date.parse(evaluationTimeUtc);
  const knowableMs = Date.parse(informationTime.knowableAt);
  if (!Number.isFinite(evalMs) || !Number.isFinite(knowableMs)) {
    return false;
  }
  return evalMs >= knowableMs;
}

export function detectTimestampReversal(
  informationTime: InformationTime,
  priorSourceEventTime: UtcInstant | null,
): boolean {
  if (!informationTime.sourceEventTime || !priorSourceEventTime) {
    return false;
  }
  const currentMs = Date.parse(informationTime.sourceEventTime);
  const priorMs = Date.parse(priorSourceEventTime);
  if (!Number.isFinite(currentMs) || !Number.isFinite(priorMs)) {
    return false;
  }
  return currentMs < priorMs;
}

export function parseUtcInstantOrNull(value: string | null | undefined): UtcInstant | null {
  if (!value) return null;
  try {
    return asUtcInstant(value);
  } catch {
    return null;
  }
}
