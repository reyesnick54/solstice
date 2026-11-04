/**
 * In-memory earnings event graph store — append-only observations and projected graph.
 */

import type { UtcInstant } from '../../../../../domain/src/time.ts';
import type { EarningsExternalObservation } from '../../../../../external-data/src/earnings/types.ts';
import { ingestEarningsObservation, createEarningsObservationStore, type EarningsObservationStore } from '../../../../../external-data/src/earnings/ingest.ts';
import { projectObservationToGraph } from './graph-builder.ts';
import type { EarningsEventGraphSnapshot, EarningsGraphEdge, EarningsGraphNode, SealedEarningsGraphObservation } from './types.ts';
import { HELIOS_EARNINGS_EVENT_GRAPH_SCHEMA } from './taxonomy.ts';

export type EarningsEventGraphStore = {
  readonly ingest: (
    observation: EarningsExternalObservation,
    sealedAt: UtcInstant,
  ) => { readonly deduplicated: boolean };
  readonly listObservations: () => readonly SealedEarningsGraphObservation[];
  readonly listNodes: () => readonly EarningsGraphNode[];
  readonly listEdges: () => readonly EarningsGraphEdge[];
  readonly snapshot: () => EarningsEventGraphSnapshot;
  readonly restore: (snapshot: EarningsEventGraphSnapshot) => void;
};

export function createEarningsEventGraphStore(
  externalStore: EarningsObservationStore = createEarningsObservationStore(),
): EarningsEventGraphStore {
  const sealed: SealedEarningsGraphObservation[] = [];
  const nodes = new Map<string, EarningsGraphNode>();
  const edges = new Map<string, EarningsGraphEdge>();
  let graphVersion = 0;

  function project(observation: EarningsExternalObservation): void {
    const projected = projectObservationToGraph(observation);
    for (const node of projected.nodes) {
      nodes.set(node.nodeId, node);
    }
    for (const edge of projected.edges) {
      edges.set(edge.edgeId, edge);
    }
  }

  return Object.freeze({
    ingest(observation, sealedAt) {
      const result = ingestEarningsObservation(externalStore, observation);
      if (!result.ok) {
        throw new Error(result.reason);
      }
      const dedupeKey = result.observation.provenance.dedupeKey;
      const alreadySealed = sealed.some((row) => row.observation.provenance.dedupeKey === dedupeKey);
      if (!alreadySealed) {
        sealed.push(Object.freeze({ observation: result.observation, sealedAt }));
        graphVersion += 1;
        project(result.observation);
      }
      return Object.freeze({ deduplicated: result.deduplicated || alreadySealed });
    },
    listObservations() {
      return Object.freeze([...sealed]);
    },
    listNodes() {
      return Object.freeze([...nodes.values()]);
    },
    listEdges() {
      return Object.freeze([...edges.values()]);
    },
    snapshot() {
      return Object.freeze({
        schema: HELIOS_EARNINGS_EVENT_GRAPH_SCHEMA,
        graphVersion,
        nodes: Object.freeze([...nodes.values()]),
        edges: Object.freeze([...edges.values()]),
        observations: Object.freeze([...sealed]),
      });
    },
    restore(snapshot) {
      sealed.length = 0;
      nodes.clear();
      edges.clear();
      graphVersion = snapshot.graphVersion;
      for (const row of snapshot.observations) {
        sealed.push(row);
        project(row.observation);
      }
    },
  });
}
