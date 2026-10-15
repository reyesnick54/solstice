/**
 * In-memory feature fabric store with restart snapshot support.
 */

import type { UtcInstant } from '../../../../domain/src/time.ts';
import { isFeatureVisibleAt } from './knowable-at.ts';
import type { FeatureDefinition, FeatureManifest, FeatureObservation } from './types.ts';

export type HeliosFeatureFabricStoreSnapshot = {
  readonly definitions: readonly FeatureDefinition[];
  readonly observations: readonly FeatureObservation[];
  readonly manifests: readonly FeatureManifest[];
};

export type HeliosFeatureFabricStore = {
  readonly registerDefinition: (definition: FeatureDefinition) => void;
  readonly getDefinition: (featureId: string, featureVersion: string) => FeatureDefinition | undefined;
  readonly putObservation: (observation: FeatureObservation) => void;
  readonly getObservation: (featureObservationId: string) => FeatureObservation | undefined;
  readonly listObservations: () => readonly FeatureObservation[];
  readonly listObservationsForFeature: (featureId: string) => readonly FeatureObservation[];
  readonly queryVisibleAt: (evaluationTime: UtcInstant) => readonly FeatureObservation[];
  readonly putManifest: (manifest: FeatureManifest) => void;
  readonly getManifest: (manifestId: string) => FeatureManifest | undefined;
  readonly snapshot: () => HeliosFeatureFabricStoreSnapshot;
  readonly restore: (snapshot: HeliosFeatureFabricStoreSnapshot) => void;
};

export function createHeliosFeatureFabricStore(): HeliosFeatureFabricStore {
  const definitions = new Map<string, FeatureDefinition>();
  const observations = new Map<string, FeatureObservation>();
  const byFeature = new Map<string, FeatureObservation[]>();
  const manifests = new Map<string, FeatureManifest>();

  function definitionKey(featureId: string, featureVersion: string): string {
    return `${featureId}@${featureVersion}`;
  }

  return Object.freeze({
    registerDefinition(definition: FeatureDefinition) {
      definitions.set(definitionKey(definition.featureId, definition.featureVersion), definition);
    },
    getDefinition(featureId: string, featureVersion: string) {
      return definitions.get(definitionKey(featureId, featureVersion));
    },
    putObservation(observation: FeatureObservation) {
      observations.set(observation.featureObservationId, observation);
      const list = byFeature.get(observation.featureId) ?? [];
      list.push(observation);
      byFeature.set(observation.featureId, list);
    },
    getObservation(featureObservationId: string) {
      return observations.get(featureObservationId);
    },
    listObservations() {
      return Object.freeze([...observations.values()]);
    },
    listObservationsForFeature(featureId: string) {
      return Object.freeze([...(byFeature.get(featureId) ?? [])]);
    },
    queryVisibleAt(evaluationTime: UtcInstant) {
      return Object.freeze(
        [...observations.values()].filter((row) => isFeatureVisibleAt(evaluationTime, row.knowableAt)),
      );
    },
    putManifest(manifest: FeatureManifest) {
      manifests.set(manifest.manifestId, manifest);
    },
    getManifest(manifestId: string) {
      return manifests.get(manifestId);
    },
    snapshot() {
      return Object.freeze({
        definitions: Object.freeze([...definitions.values()]),
        observations: Object.freeze([...observations.values()]),
        manifests: Object.freeze([...manifests.values()]),
      });
    },
    restore(snapshot: HeliosFeatureFabricStoreSnapshot) {
      definitions.clear();
      observations.clear();
      byFeature.clear();
      manifests.clear();
      for (const definition of snapshot.definitions) {
        definitions.set(definitionKey(definition.featureId, definition.featureVersion), definition);
      }
      for (const observation of snapshot.observations) {
        observations.set(observation.featureObservationId, observation);
        const list = byFeature.get(observation.featureId) ?? [];
        list.push(observation);
        byFeature.set(observation.featureId, list);
      }
      for (const manifest of snapshot.manifests) {
        manifests.set(manifest.manifestId, manifest);
      }
    },
  });
}
