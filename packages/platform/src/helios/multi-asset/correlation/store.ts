/**
 * HELIOS Multi-Asset M17 — correlation artifact store with restart support.
 */

import type { UtcInstant } from '@solstice/domain';
import type {
  CorrelationArtifact,
  CorrelationChangeEvent,
  CorrelationCluster,
  CorrelationEngineSnapshot,
} from './types.ts';

export type CorrelationEngineStorePort = {
  putArtifact(artifact: CorrelationArtifact): void;
  artifactFor(id: string): CorrelationArtifact | null;
  latestPairArtifact(input: {
    readonly instrumentA: string;
    readonly instrumentB: string;
    readonly horizon: CorrelationArtifact['windowHorizon'];
    readonly asOf: UtcInstant;
  }): CorrelationArtifact | null;
  putCluster(cluster: CorrelationCluster): void;
  clusters(asOf: UtcInstant): readonly CorrelationCluster[];
  putChange(change: CorrelationChangeEvent): void;
  changes(asOf: UtcInstant): readonly CorrelationChangeEvent[];
  snapshot(asOf: UtcInstant): CorrelationEngineSnapshot;
  restore(snapshot: CorrelationEngineSnapshot): void;
};

function pairKey(a: string, b: string, horizon: string): string {
  const sorted = [a, b].sort();
  return `${sorted[0]}::${sorted[1]}::${horizon}`;
}

export class InMemoryCorrelationEngineStore implements CorrelationEngineStorePort {
  readonly #artifacts = new Map<string, CorrelationArtifact>();
  readonly #pairLatest = new Map<string, string>();
  readonly #clusters: CorrelationCluster[] = [];
  readonly #changes: CorrelationChangeEvent[] = [];

  putArtifact(artifact: CorrelationArtifact): void {
    this.#artifacts.set(artifact.artifactId, artifact);
    this.#pairLatest.set(
      pairKey(artifact.instrumentA, artifact.instrumentB, artifact.windowHorizon),
      artifact.artifactId,
    );
  }

  artifactFor(id: string): CorrelationArtifact | null {
    return this.#artifacts.get(id) ?? null;
  }

  latestPairArtifact(input: {
    readonly instrumentA: string;
    readonly instrumentB: string;
    readonly horizon: CorrelationArtifact['windowHorizon'];
    readonly asOf: UtcInstant;
  }): CorrelationArtifact | null {
    const id = this.#pairLatest.get(pairKey(input.instrumentA, input.instrumentB, input.horizon));
    if (!id) {
      return null;
    }
    const artifact = this.#artifacts.get(id);
    if (!artifact) {
      return null;
    }
    if (Date.parse(artifact.calculationTimestamp) > Date.parse(input.asOf)) {
      return null;
    }
    return artifact;
  }

  putCluster(cluster: CorrelationCluster): void {
    this.#clusters.push(cluster);
  }

  clusters(asOf: UtcInstant): readonly CorrelationCluster[] {
    const asOfMs = Date.parse(asOf);
    return Object.freeze(this.#clusters.filter((row) => Date.parse(row.capturedAt) <= asOfMs));
  }

  putChange(change: CorrelationChangeEvent): void {
    this.#changes.push(change);
  }

  changes(asOf: UtcInstant): readonly CorrelationChangeEvent[] {
    const asOfMs = Date.parse(asOf);
    return Object.freeze(this.#changes.filter((row) => Date.parse(row.detectedAt) <= asOfMs));
  }

  snapshot(asOf: UtcInstant): CorrelationEngineSnapshot {
    const asOfMs = Date.parse(asOf);
    const artifacts = [...this.#artifacts.values()].filter(
      (row) => Date.parse(row.calculationTimestamp) <= asOfMs,
    );
    return Object.freeze({
      artifacts: Object.freeze([...artifacts]),
      clusters: this.clusters(asOf),
      changes: this.changes(asOf),
      capturedAt: asOf,
    });
  }

  restore(snapshot: CorrelationEngineSnapshot): void {
    this.#artifacts.clear();
    this.#pairLatest.clear();
    this.#clusters.length = 0;
    this.#changes.length = 0;
    for (const artifact of snapshot.artifacts) {
      this.putArtifact(artifact);
    }
    for (const cluster of snapshot.clusters) {
      this.#clusters.push(cluster);
    }
    for (const change of snapshot.changes) {
      this.#changes.push(change);
    }
  }
}
