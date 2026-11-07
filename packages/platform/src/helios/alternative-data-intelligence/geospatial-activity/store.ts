import type { UtcInstant } from '@solstice/domain';

import type { GeoAsset, GeoObservation, GeospatialActivityStoreSnapshot, PhysicalActivityEstimate } from './types.ts';
import { filterKnowableGeoObservations } from './knowable-at.ts';

export type GeospatialActivityStore = {
  upsertAsset(asset: GeoAsset): void;
  appendObservation(observation: GeoObservation): void;
  setEstimate(estimate: PhysicalActivityEstimate): void;
  snapshotKnowableAt(evaluationTime: UtcInstant): GeospatialActivityStoreSnapshot;
  snapshot(): GeospatialActivityStoreSnapshot;
};

export function createGeospatialActivityStore(): GeospatialActivityStore {
  const assets = new Map<string, GeoAsset>();
  const observations: GeoObservation[] = [];
  const estimates = new Map<string, PhysicalActivityEstimate>();

  return Object.freeze({
    upsertAsset(asset: GeoAsset) {
      assets.set(asset.geoAssetId, asset);
    },
    appendObservation(observation: GeoObservation) {
      observations.push(observation);
    },
    setEstimate(estimate: PhysicalActivityEstimate) {
      estimates.set(estimate.geoAssetId, estimate);
    },
    snapshotKnowableAt(evaluationTime: UtcInstant) {
      return Object.freeze({
        assets: Object.freeze([...assets.values()]),
        observations: filterKnowableGeoObservations(evaluationTime, observations),
        estimates: Object.freeze(
          [...estimates.values()].filter((row) => row.evaluationTime <= evaluationTime),
        ),
      });
    },
    snapshot() {
      return Object.freeze({
        assets: Object.freeze([...assets.values()]),
        observations: Object.freeze([...observations]),
        estimates: Object.freeze([...estimates.values()]),
      });
    },
  });
}
