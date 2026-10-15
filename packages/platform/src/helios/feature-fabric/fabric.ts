/**
 * HELIOS feature fabric — compute and seal evidence-time features from observations.
 */

import type { Clock } from '../../../../config/src/clock.ts';
import { computeFeatureObservation } from './compute.ts';
import { buildFeatureManifest } from './manifest.ts';
import type { HeliosFeatureFabricStore } from './store.ts';
import type { UtcInstant } from '../../../../domain/src/time.ts';
import type {
  ComputeFeatureInput,
  ComputeFeatureResult,
  FeatureDefinition,
  FeatureManifest,
  FeatureObservation,
  MissingValuePolicy,
} from './types.ts';

export type HeliosFeatureFabricOptions = {
  readonly clock: Clock;
  readonly store: HeliosFeatureFabricStore;
};

export class HeliosFeatureFabric {
  readonly #clock: Clock;
  readonly #store: HeliosFeatureFabricStore;

  constructor(options: HeliosFeatureFabricOptions) {
    this.#clock = options.clock;
    this.#store = options.store;
  }

  store(): HeliosFeatureFabricStore {
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

  sealManifest(input: {
    readonly definitions: readonly FeatureDefinition[];
    readonly observations: readonly FeatureObservation[];
    readonly contributions: ComputeFeatureInput['contributions'];
    readonly sourceDatasets: readonly string[];
    readonly universeDefinition: string;
    readonly missingValuePolicy: MissingValuePolicy;
    readonly codeVersion: string;
    readonly modelVersion: string | null;
    readonly evaluationTimestamp?: UtcInstant;
  }): FeatureManifest {
    const manifest = buildFeatureManifest({
      evaluationTimestamp: input.evaluationTimestamp ?? this.#clock.now(),
      definitions: input.definitions,
      observations: input.observations,
      contributions: input.contributions,
      sourceDatasets: input.sourceDatasets,
      universeDefinition: input.universeDefinition,
      missingValuePolicy: input.missingValuePolicy,
      codeVersion: input.codeVersion,
      modelVersion: input.modelVersion,
    });
    this.#store.putManifest(manifest);
    return manifest;
  }
}
