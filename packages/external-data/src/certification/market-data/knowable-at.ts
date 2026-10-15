/**
 * Minimal knowable-at rule for certification harness (mirrors HELIOS observation fabric).
 */

import type { UtcInstant } from '../../../../domain/src/time.ts';

export function computeKnowableAtForCertification(input: {
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
    return currentMs >= latestMs ? current : latest;
  });
}

export function knowableAtCorrectnessCheck(input: {
  readonly knowableAt: UtcInstant;
  readonly sunreyArrivalTime: UtcInstant;
  readonly ingestionTime: UtcInstant;
}): boolean {
  const knowableMs = Date.parse(input.knowableAt);
  const arrivalMs = Date.parse(input.sunreyArrivalTime);
  const ingestionMs = Date.parse(input.ingestionTime);
  if (!Number.isFinite(knowableMs) || !Number.isFinite(arrivalMs) || !Number.isFinite(ingestionMs)) {
    return false;
  }
  return knowableMs >= arrivalMs && knowableMs >= ingestionMs;
}
