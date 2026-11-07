/**
 * ALT08 geospatial physical-activity engine (simulation fixtures).
 */

import type { UtcInstant } from '@solstice/domain';
import type { ExternalGeoAssetRecord, ExternalGeoObservation } from '@solstice/external-data';

import { mapExternalGeoAsset, mapExternalGeoObservation } from './map-external.ts';
import { fusePhysicalActivityEstimate } from './fusion.ts';
import { compileGeospatialActivityManifest } from './manifest.ts';
import { createGeospatialActivityStore, type GeospatialActivityStore } from './store.ts';
import type { GeospatialActivityManifest, PhysicalActivityEstimate } from './types.ts';

export function ingestExternalGeospatialBatch(input: {
  readonly assets: readonly ExternalGeoAssetRecord[];
  readonly observations: readonly ExternalGeoObservation[];
  readonly store?: GeospatialActivityStore;
}): GeospatialActivityStore {
  const store = input.store ?? createGeospatialActivityStore();
  for (const asset of input.assets) {
    store.upsertAsset(mapExternalGeoAsset(asset));
  }
  for (const obs of input.observations) {
    store.appendObservation(mapExternalGeoObservation(obs));
  }
  return store;
}

export function buildPhysicalActivityEstimates(input: {
  readonly store: GeospatialActivityStore;
  readonly evaluationTime: UtcInstant;
}): readonly PhysicalActivityEstimate[] {
  const snap = input.store.snapshotKnowableAt(input.evaluationTime);
  const assetIds = new Set(snap.assets.map((row) => row.geoAssetId));
  const estimates: PhysicalActivityEstimate[] = [];
  for (const geoAssetId of assetIds) {
    const estimate = fusePhysicalActivityEstimate({
      geoAssetId,
      evaluationTime: input.evaluationTime,
      observations: snap.observations,
    });
    input.store.setEstimate(estimate);
    estimates.push(estimate);
  }
  return Object.freeze(estimates);
}

export function runGeospatialActivityPipeline(input: {
  readonly assets: readonly ExternalGeoAssetRecord[];
  readonly observations: readonly ExternalGeoObservation[];
  readonly evaluationTime: UtcInstant;
  readonly compiledAt: UtcInstant;
}): GeospatialActivityManifest {
  const store = ingestExternalGeospatialBatch({
    assets: input.assets,
    observations: input.observations,
  });
  buildPhysicalActivityEstimates({ store, evaluationTime: input.evaluationTime });
  return compileGeospatialActivityManifest({
    evaluationTime: input.evaluationTime,
    compiledAt: input.compiledAt,
    snapshot: store.snapshot(),
  });
}
