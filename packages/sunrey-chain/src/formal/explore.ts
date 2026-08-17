/**
 * Explicit-state exploration of a finite TLA+ transition system.
 *
 * This is the standard TLC algorithm (BFS over Init / Next / Inv) applied
 * only to the checked-in bounded models. It is not a general-purpose
 * model-checking product.
 */

import type {
  FormalModelBounds,
  FormalModelId,
  FormalProfileName,
  FormalResultClassification,
  ModelCheckResult,
  PropertyCheck,
} from './types.ts';

export type Transition<S> = {
  readonly name: string;
  readonly next: S | null;
};

export type FormalModel<S> = {
  readonly modelId: FormalModelId;
  readonly modelVersion: string;
  readonly bounds: FormalModelBounds;
  readonly init: () => S;
  readonly next: (state: S) => readonly Transition<S>[];
  readonly key: (state: S) => string;
  readonly invariants: Readonly<Record<string, (state: S) => boolean>>;
  readonly actionProperties?: Readonly<Record<string, (before: S, action: string, after: S) => boolean>>;
};

export function exploreModel<S>(
  model: FormalModel<S>,
  profile: FormalProfileName,
  toolVersion: string,
): ModelCheckResult {
  const propertyNames = [
    ...Object.keys(model.invariants),
    ...Object.keys(model.actionProperties ?? {}),
  ];
  const propertyFails = new Map<string, string[]>();
  const visited = new Set<string>();
  const queue: S[] = [model.init()];
  visited.add(model.key(queue[0]!));
  let statesExplored = 0;

  while (queue.length > 0) {
    const state = queue.shift()!;
    statesExplored += 1;
    for (const [property, check] of Object.entries(model.invariants)) {
      if (!check(state)) {
        const trace = propertyFails.get(property) ?? [];
        if (trace.length === 0) {
          propertyFails.set(property, [model.key(state)]);
        }
      }
    }
    for (const step of model.next(state)) {
      if (step.next === null) {
        continue;
      }
      for (const [property, check] of Object.entries(model.actionProperties ?? {})) {
        if (!check(state, step.name, step.next)) {
          const trace = propertyFails.get(property) ?? [];
          if (trace.length === 0) {
            propertyFails.set(property, [model.key(state), step.name, model.key(step.next)]);
          }
        }
      }
      const key = model.key(step.next);
      if (!visited.has(key)) {
        visited.add(key);
        queue.push(step.next);
      }
    }
  }

  const properties: PropertyCheck[] = propertyNames.map((property) => {
    const cex = propertyFails.get(property);
    return {
      property,
      result: cex ? 'COUNTEREXAMPLE_FOUND' : 'VERIFIED_WITHIN_MODEL_BOUNDS',
      statesExplored,
      counterexampleRef: cex ? `${model.modelId}:${property}` : null,
    };
  });
  const failed = properties.find((row) => row.result === 'COUNTEREXAMPLE_FOUND');
  const result: FormalResultClassification = failed
    ? 'COUNTEREXAMPLE_FOUND'
    : 'VERIFIED_WITHIN_MODEL_BOUNDS';
  return {
    modelId: model.modelId,
    modelVersion: model.modelVersion,
    tool: 'TLA+/TLC executable twin',
    toolVersion,
    profile,
    bounds: model.bounds,
    properties,
    statesExplored,
    result,
    counterexampleRef: failed?.counterexampleRef ?? null,
  };
}

export function requireVerified(result: ModelCheckResult): void {
  if (result.result !== 'VERIFIED_WITHIN_MODEL_BOUNDS') {
    const failed = result.properties.filter((row) => row.result !== 'VERIFIED_WITHIN_MODEL_BOUNDS');
    throw new Error(
      `${result.modelId} was not model-checked within bounds: ${failed.map((row) => row.property).join(', ')}`,
    );
  }
}
