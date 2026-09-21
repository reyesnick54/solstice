/**
 * HELIOS Multi-Asset M15 — in-memory Cross-Asset Opportunity Graph store.
 */

import type { UtcInstant } from '@solstice/domain';
import type {
  CrossAssetOpportunityEdge,
  CrossAssetOpportunityEdgeEvidence,
  CrossAssetOpportunityGraphSnapshot,
  CrossAssetOpportunityNode,
} from './types.ts';

function edgeIdFor(instrumentA: string, instrumentB: string, kind: CrossAssetOpportunityEdge['kind']): string {
  const sorted = [instrumentA, instrumentB].sort();
  return `edge_${kind}_${sorted[0]}_${sorted[1]}`;
}

export type CrossAssetOpportunityGraphStorePort = {
  upsertNode(node: CrossAssetOpportunityNode): void;
  upsertEdgeEvidence(input: {
    readonly kind: CrossAssetOpportunityEdge['kind'];
    readonly instrumentA: string;
    readonly instrumentB: string;
    readonly evidence: CrossAssetOpportunityEdgeEvidence;
    readonly updatedAt: UtcInstant;
  }): CrossAssetOpportunityEdge;
  edgeFor(instrumentA: string, instrumentB: string, kind: CrossAssetOpportunityEdge['kind']): CrossAssetOpportunityEdge | null;
  snapshot(asOf: UtcInstant): CrossAssetOpportunityGraphSnapshot;
  restore(snapshot: CrossAssetOpportunityGraphSnapshot): void;
};

export class InMemoryCrossAssetOpportunityGraphStore implements CrossAssetOpportunityGraphStorePort {
  readonly #nodes = new Map<string, CrossAssetOpportunityNode>();
  readonly #edges = new Map<string, CrossAssetOpportunityEdge>();

  upsertNode(node: CrossAssetOpportunityNode): void {
    this.#nodes.set(node.nodeId, node);
  }

  upsertEdgeEvidence(input: {
    readonly kind: CrossAssetOpportunityEdge['kind'];
    readonly instrumentA: string;
    readonly instrumentB: string;
    readonly evidence: CrossAssetOpportunityEdgeEvidence;
    readonly updatedAt: UtcInstant;
  }): CrossAssetOpportunityEdge {
    const edgeId = edgeIdFor(input.instrumentA, input.instrumentB, input.kind);
    const existing = this.#edges.get(edgeId);
    const evidence = existing
      ? Object.freeze([...existing.evidence, input.evidence])
      : Object.freeze([input.evidence]);
    const edge = Object.freeze({
      edgeId,
      kind: input.kind,
      instrumentA: input.instrumentA,
      instrumentB: input.instrumentB,
      evidence,
      updatedAt: input.updatedAt,
    });
    this.#edges.set(edgeId, edge);
    return edge;
  }

  edgeFor(
    instrumentA: string,
    instrumentB: string,
    kind: CrossAssetOpportunityEdge['kind'],
  ): CrossAssetOpportunityEdge | null {
    return this.#edges.get(edgeIdFor(instrumentA, instrumentB, kind)) ?? null;
  }

  snapshot(asOf: UtcInstant): CrossAssetOpportunityGraphSnapshot {
    const asOfMs = Date.parse(asOf);
    const edges = [...this.#edges.values()].filter((edge) => Date.parse(edge.updatedAt) <= asOfMs);
    const nodes = [...this.#nodes.values()].filter((node) => Date.parse(node.updatedAt) <= asOfMs);
    return Object.freeze({
      nodes: Object.freeze([...nodes]),
      edges: Object.freeze([...edges]),
      capturedAt: asOf,
    });
  }

  restore(snapshot: CrossAssetOpportunityGraphSnapshot): void {
    this.#nodes.clear();
    this.#edges.clear();
    for (const node of snapshot.nodes) {
      this.#nodes.set(node.nodeId, node);
    }
    for (const edge of snapshot.edges) {
      this.#edges.set(edge.edgeId, edge);
    }
  }
}
