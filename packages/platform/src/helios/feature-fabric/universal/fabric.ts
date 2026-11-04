/**
 * HELIOS universal evidence-time feature fabric service.
 */

import type { Clock } from '@solstice/config';
import type { UtcInstant } from '@solstice/domain';
import { computeFeatureObservation } from './compute.ts';
import { computeDerivedFeatureObservation } from './derived.ts';
import { buildFeatureManifest } from './manifest.ts';
import type { HeliosUniversalFeatureFabricStore } from './store.ts';
import type {
  ComputeDerivedFeatureInput,
  ComputeFeatureInput,
  ComputeFeatureResult,
  FeatureDefinition,
  FeatureManifest,
  FeatureContributionInput,
  FeatureObservation,
  MissingValuePolicy,
} from './types.ts';

export type HeliosUniversalFeatureFabricOptions = {
  readonly clock: Clock;
  readonly store: HeliosUniversalFeatureFabricStore;
};

export class HeliosUniversalFeatureFabric {
  readonly #clock: Clock;
  readonly #store: HeliosUniversalFeatureFabricStore;

  constructor(options: HeliosUniversalFeatureFabricOptions) {
    this.#clock = options.clock;
    this.#store = options.store;
  }

  store(): HeliosUniversalFeatureFabricStore {
    return this.#store;
  }

  registerDefinition(definition: FeatureDefinition): void {
    this.#store.registerDefinition(definition);
  }

  compute(input: ComputeFeatureInput): ComputeFeatureResult {
    const result = computeFeatureObservation({
      ...input,
      computedAt: input.computedAt ?? this.#clock.now(),
    });
    if (result.ok) {
      this.#store.putObservation(result.observation);
    }
    return result;
  }

  computeDerived(input: ComputeDerivedFeatureInput): ComputeFeatureResult {
    const result = computeDerivedFeatureObservation({
      ...input,
      computedAt: input.computedAt ?? this.#clock.now(),
    });
    if (result.ok) {
      this.#store.putObservation(result.observation);
    }
    return result;
  }

  sealManifest(input: {
    readonly definitions: readonly FeatureDefinition[];
    readonly observations: readonly FeatureObservation[];
    readonly contributions: readonly FeatureContributionInput[];
    readonly entityUniverse: readonly string[];
    readonly instrumentUniverse: readonly string[];
    readonly sourceDatasets: readonly string[];
    readonly missingDataPolicy: MissingValuePolicy;
    readonly compilerVersion: string;
    readonly decisionTime?: UtcInstant;
  }): FeatureManifest {
    const now = this.#clock.now();
    const manifest = buildFeatureManifest({
      createdAt: now,
      decisionTime: input.decisionTime ?? now,
      definitions: input.definitions,
      observations: input.observations,
      contributions: input.contributions,
      entityUniverse: input.entityUniverse,
      instrumentUniverse: input.instrumentUniverse,
      sourceDatasets: input.sourceDatasets,
      missingDataPolicy: input.missingDataPolicy,
      compilerVersion: input.compilerVersion,
    });
    this.#store.putManifest(manifest);
    return manifest;
  }
}
