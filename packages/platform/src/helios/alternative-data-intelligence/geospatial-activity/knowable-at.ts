import type { UtcInstant } from '@solstice/domain';

import type { GeoObservation, GeospatialActivityManifest } from './types.ts';

export function isGeoObservationKnowableAt(evaluationTime: UtcInstant, knowableAt: UtcInstant): boolean {
  return knowableAt <= evaluationTime;
}

export function filterKnowableGeoObservations<T extends { readonly knowableAt: UtcInstant }>(
  evaluationTime: UtcInstant,
  rows: readonly T[],
): readonly T[] {
  return Object.freeze(rows.filter((row) => isGeoObservationKnowableAt(evaluationTime, row.knowableAt)));
}

export function assertNoGeospatialLeakage(
  evaluationTime: UtcInstant,
  observations: readonly GeoObservation[],
): void {
  const leaking = observations.filter((row) => !isGeoObservationKnowableAt(evaluationTime, row.knowableAt));
  if (leaking.length > 0) {
    throw new Error(`geospatial_activity_leak:${leaking.map((row) => row.observationId).join(',')}`);
  }
}

export function filterKnowableManifest(
  evaluationTime: UtcInstant,
  manifest: GeospatialActivityManifest,
): GeospatialActivityManifest {
  const observations = filterKnowableGeoObservations(evaluationTime, manifest.observations);
  const estimateIds = new Set(
    observations.map((row) => row.geoAssetId),
  );
  const estimates = manifest.estimates.filter((row) => estimateIds.has(row.geoAssetId));
  return Object.freeze({
    ...manifest,
    evaluationTime,
    observations,
    estimates,
  });
}
