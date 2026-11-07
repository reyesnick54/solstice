/**
 * Point-in-time knowability guards for procurement observations.
 */

import type { UtcInstant } from '@solstice/domain';
import type { ProcurementExternalObservation } from '@solstice/external-data';

export function isProcurementObservationKnowableAt(
  decisionTimeUtc: UtcInstant,
  observation: ProcurementExternalObservation,
): boolean {
  return Date.parse(observation.provenance.knowableAt) <= Date.parse(decisionTimeUtc);
}

export function filterKnowableProcurementObservations(
  decisionTimeUtc: UtcInstant,
  observations: readonly ProcurementExternalObservation[],
): readonly ProcurementExternalObservation[] {
  return Object.freeze(observations.filter((row) => isProcurementObservationKnowableAt(decisionTimeUtc, row)));
}

export function assertNoFutureProcurementLeak(input: {
  readonly decisionTimeUtc: UtcInstant;
  readonly observations: readonly ProcurementExternalObservation[];
}): { readonly ok: boolean; readonly leakingIds: readonly string[] } {
  const leaking = input.observations
    .filter((row) => !isProcurementObservationKnowableAt(input.decisionTimeUtc, row))
    .map((row) => row.observationId);
  return Object.freeze({ ok: leaking.length === 0, leakingIds: Object.freeze(leaking) });
}
