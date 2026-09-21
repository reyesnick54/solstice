/**
 * HELIOS M15 in-memory cross-asset graph store with versioning and tenant isolation.
 */

import type { UtcInstant } from '@solstice/domain';
import { snapshotHash } from './ids.ts';
import type {
  CrossAssetEdgeVersionRecord,
  CrossAssetGraphBuildResult,
  CrossAssetGraphNode,
  CrossAssetGraphSnapshot,
  CrossAssetGraphStoreSnapshot,
  CrossAssetRelationshipEdge,
} from './types.ts';
import type { EdgeValidityState } from './taxonomy.ts';

function edgeVisibleToCustomer(edge: CrossAssetRelationshipEdge, customerId: string | null | undefined): boolean {
  if (edge.customerId === null) {
    return true;
  }
  return edge.customerId === (customerId ?? null);
}

function effectiveValidity(edge: CrossAssetRelationshipEdge, asOf: UtcInstant): EdgeValidityState {
  if (edge.expiration && Date.parse(asOf) > Date.parse(edge.expiration)) {
    return 'EXPIRED';
  }
  return edge.validityState;
}

export class InMemoryCrossAssetGraphStore {
  readonly #nodes = new Map<string, CrossAssetGraphNode>();
  readonly #edges = new Map<string, CrossAssetRelationshipEdge>();
  readonly #edgeVersions: CrossAssetEdgeVersionRecord[] = [];

  loadBuildResult(result: CrossAssetGraphBuildResult, loadedAt: UtcInstant): void {
    for (const node of result.nodes) {
      this.#nodes.set(node.nodeId, node);
    }
    for (const edge of result.edges) {
      this.upsertEdge(edge, loadedAt, 'initial_build');
    }
  }

  upsertEdge(edge: CrossAssetRelationshipEdge, changedAt: UtcInstant, changeReason: string): void {
    const existing = this.#edges.get(edge.edgeId);
    if (existing) {
      this.#edgeVersions.push(
        Object.freeze({
          edgeId: existing.edgeId,
          version: existing.version,
          edge: existing,
          supersededAt: changedAt,
          changeReason,
        }),
      );
      const next = Object.freeze({
        ...edge,
        version: existing.version + 1,
        evidence: Object.freeze(edge.evidence.map((row) => Object.freeze(row))),
        authoritative: false as const,
        mutatesFinancialState: false as const,
      });
      this.#edges.set(edge.edgeId, next);
      return;
    }
    this.#edges.set(edge.edgeId, edge);
    this.#edgeVersions.push(
      Object.freeze({
        edgeId: edge.edgeId,
        version: edge.version,
        edge,
        supersededAt: null,
        changeReason,
      }),
    );
  }

  getNode(nodeId: string): CrossAssetGraphNode | null {
    return this.#nodes.get(nodeId) ?? null;
  }

  getEdge(edgeId: string): CrossAssetRelationshipEdge | null {
    return this.#edges.get(edgeId) ?? null;
  }

  nodes(): readonly CrossAssetGraphNode[] {
    return Object.freeze([...this.#nodes.values()]);
  }

  allEdges(): readonly CrossAssetRelationshipEdge[] {
    return Object.freeze([...this.#edges.values()]);
  }

  edges(input?: { customerId?: string | null; asOf?: UtcInstant; includeExpired?: boolean }): readonly CrossAssetRelationshipEdge[] {
    const asOf = input?.asOf;
    return Object.freeze(
      [...this.#edges.values()].filter((edge) => {
        if (!edgeVisibleToCustomer(edge, input?.customerId)) {
          return false;
        }
        if (asOf && !input?.includeExpired && effectiveValidity(edge, asOf) === 'EXPIRED') {
          return false;
        }
        return true;
      }),
    );
  }

  edgeVersions(edgeId?: string): readonly CrossAssetEdgeVersionRecord[] {
    if (edgeId) {
      return Object.freeze(this.#edgeVersions.filter((row) => row.edgeId === edgeId));
    }
    return Object.freeze([...this.#edgeVersions]);
  }

  snapshot(snapshotAt: UtcInstant): CrossAssetGraphSnapshot {
    const nodes = this.nodes();
    const edges = this.edges();
    return Object.freeze({
      schema: 'sunrey.helios.multi-asset.cross-asset-graph.v1',
      nodes,
      edges,
      edgeVersions: this.edgeVersions(),
      snapshotAt,
      snapshotHash: snapshotHash(nodes, edges),
    });
  }

  restore(snapshot: CrossAssetGraphStoreSnapshot): void {
    this.#nodes.clear();
    this.#edges.clear();
    this.#edgeVersions.length = 0;
    for (const node of snapshot.nodes) {
      this.#nodes.set(node.nodeId, node);
    }
    for (const edge of snapshot.edges) {
      this.#edges.set(edge.edgeId, edge);
    }
    for (const version of snapshot.edgeVersions) {
      this.#edgeVersions.push(version);
    }
  }
}
