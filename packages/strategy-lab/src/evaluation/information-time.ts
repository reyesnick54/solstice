/**
 * Information-time semantics aligned with HELIOS H08.
 * SOURCE EVENT TIME != INFORMATION AVAILABILITY TIME.
 *
 * Strategy Lab cannot import platform; this module mirrors
 * packages/platform/src/helios/observation/information-time.ts.
 */

import { asUtcInstant, type UtcInstant } from '../../../domain/src/time.ts';

export type InformationTimeFields = {
  readonly sourceEventTime: UtcInstant;
  readonly sourcePublishedTime: UtcInstant | null;
  readonly providerAvailabilityTime: UtcInstant | null;
  readonly sunreyArrivalTime: UtcInstant;
  readonly ingestionTime: UtcInstant;
  readonly knowableAt: UtcInstant;
};

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
    if (!Number.isFinite(latestMs)) {
      return current;
    }
    if (!Number.isFinite(currentMs)) {
      return latest;
    }
    return currentMs > latestMs ? current : latest;
  });
}

export function buildInformationTimeFields(input: {
  readonly sourceEventTime: UtcInstant;
  readonly sourcePublishedTime?: UtcInstant | null;
  readonly providerAvailabilityTime?: UtcInstant | null;
  readonly sunreyArrivalTime: UtcInstant;
  readonly ingestionTime: UtcInstant;
}): InformationTimeFields {
  const knowableAt = computeKnowableAt({
    providerAvailabilityTime: input.providerAvailabilityTime ?? null,
    sunreyArrivalTime: input.sunreyArrivalTime,
    ingestionTime: input.ingestionTime,
  });
  return Object.freeze({
    sourceEventTime: input.sourceEventTime,
    sourcePublishedTime: input.sourcePublishedTime ?? null,
    providerAvailabilityTime: input.providerAvailabilityTime ?? null,
    sunreyArrivalTime: input.sunreyArrivalTime,
    ingestionTime: input.ingestionTime,
    knowableAt,
  });
}

/** Chronological evaluation must not use an observation before knowableAt. */
export function isKnowableAt(evaluationTimeUtc: UtcInstant, knowableAt: UtcInstant): boolean {
  const evalMs = Date.parse(evaluationTimeUtc);
  const knowableMs = Date.parse(knowableAt);
  if (!Number.isFinite(evalMs) || !Number.isFinite(knowableMs)) {
    return false;
  }
  return evalMs >= knowableMs;
}

export function addMilliseconds(instant: UtcInstant, ms: number): UtcInstant {
  return asUtcInstant(new Date(Date.parse(instant) + ms).toISOString());
}

export function assertNoFutureInformationLeak(input: {
  readonly evaluationTime: UtcInstant;
  readonly knowableAt: UtcInstant;
  readonly observationId: string;
}): { readonly ok: true } | { readonly ok: false; readonly reason: string } {
  if (isKnowableAt(input.evaluationTime, input.knowableAt)) {
    return { ok: true };
  }
  return Object.freeze({
    ok: false,
    reason: `observation ${input.observationId} knowable at ${input.knowableAt} is not eligible at evaluation ${input.evaluationTime}`,
  });
}
