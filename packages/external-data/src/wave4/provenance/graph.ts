/**
 * Provenance lineage graph with cycle prevention.
 * Supports many-to-one and one-to-many transformations.
 */

import { err, ok, type Result } from '../../../../domain/src/result.ts';
import type { ProvenanceEdge, ProvenanceEdgeKind, ProvenanceNode, ProvenanceNodeId } from './types.ts';

const ACYCLIC_EDGE_KINDS = new Set<ProvenanceEdgeKind>([
  'RECEIVED_AS',
  'NORMALIZED_TO',
  'REJECTED_FROM',
  'DEDUPLICATED_TO',
  'LINKED_TO',
  'RESOLVED_TO',
  'EVIDENCE_FROM',
  'VERIFIED_FROM',
  'CLAIM_FROM',
  'DEPENDED_ON',
  'MERGED_FROM',
]);

export type ProvenanceGraphFailure = {
  readonly code: 'LINEAGE_CYCLE' | 'SELF_REFERENCE' | 'DUPLICATE_EDGE';
  readonly message: string;
};

export function wouldCreateProvenanceCycle(
  existing: readonly ProvenanceEdge[],
  next: readonly ProvenanceEdge[],
): boolean {
  const adjacency = new Map<ProvenanceNodeId, ProvenanceNodeId[]>();
  for (const edge of [...existing, ...next]) {
    if (!ACYCLIC_EDGE_KINDS.has(edge.kind)) {
      continue;
    }
    const list = adjacency.get(edge.fromNodeId) ?? [];
    list.push(edge.toNodeId);
    adjacency.set(edge.fromNodeId, list);
  }
  const visiting = new Set<ProvenanceNodeId>();
  const visited = new Set<ProvenanceNodeId>();

  const walk = (node: ProvenanceNodeId): boolean => {
    if (visiting.has(node)) {
      return true;
    }
    if (visited.has(node)) {
      return false;
    }
    visiting.add(node);
    for (const child of adjacency.get(node) ?? []) {
      if (walk(child)) {
        return true;
      }
    }
    visiting.delete(node);
    visited.add(node);
    return false;
  };

  for (const node of adjacency.keys()) {
    if (walk(node)) {
      return true;
    }
  }
  return false;
}

export function assertAcyclicEdges(
  existing: readonly ProvenanceEdge[],
  next: readonly ProvenanceEdge[],
): Result<readonly ProvenanceEdge[], ProvenanceGraphFailure> {
  for (const edge of next) {
    if (edge.fromNodeId === edge.toNodeId && ACYCLIC_EDGE_KINDS.has(edge.kind)) {
      return err({ code: 'SELF_REFERENCE', message: `${edge.kind} cannot reference the same node` });
    }
  }
  if (wouldCreateProvenanceCycle(existing, next)) {
    return err({ code: 'LINEAGE_CYCLE', message: 'provenance edges must not form a cycle' });
  }
  const seen = new Set(existing.map((edge) => edge.edgeId));
  for (const edge of next) {
    if (seen.has(edge.edgeId)) {
      return err({ code: 'DUPLICATE_EDGE', message: `edge ${edge.edgeId} already exists` });
    }
  }
  return ok(next);
}

export type ProvenanceGraphStore = {
  addNode(node: ProvenanceNode): void;
  addEdges(edges: readonly ProvenanceEdge[]): Result<readonly ProvenanceEdge[], ProvenanceGraphFailure>;
  getNode(nodeId: ProvenanceNodeId): ProvenanceNode | undefined;
  listNodes(): readonly ProvenanceNode[];
  listEdges(): readonly ProvenanceEdge[];
  parentsOf(nodeId: ProvenanceNodeId): readonly ProvenanceNodeId[];
  childrenOf(nodeId: ProvenanceNodeId): readonly ProvenanceNodeId[];
};

export function createInMemoryProvenanceGraphStore(): ProvenanceGraphStore {
  const nodes = new Map<ProvenanceNodeId, ProvenanceNode>();
  const edges: ProvenanceEdge[] = [];

  return Object.freeze({
    addNode(node: ProvenanceNode): void {
      nodes.set(node.nodeId, Object.freeze({ ...node }));
    },

    addEdges(next: readonly ProvenanceEdge[]): Result<readonly ProvenanceEdge[], ProvenanceGraphFailure> {
      const result = assertAcyclicEdges(edges, next);
      if (!result.ok) {
        return result;
      }
      for (const edge of next) {
        edges.push(Object.freeze({ ...edge }));
      }
      return ok(next);
    },

    getNode(nodeId: ProvenanceNodeId): ProvenanceNode | undefined {
      return nodes.get(nodeId);
    },

    listNodes(): readonly ProvenanceNode[] {
      return Object.freeze([...nodes.values()]);
    },

    listEdges(): readonly ProvenanceEdge[] {
      return Object.freeze(edges.slice());
    },

    parentsOf(nodeId: ProvenanceNodeId): readonly ProvenanceNodeId[] {
      return Object.freeze(
        [...new Set(edges.filter((edge) => edge.fromNodeId === nodeId).map((edge) => edge.toNodeId))].sort(),
      );
    },

    childrenOf(nodeId: ProvenanceNodeId): readonly ProvenanceNodeId[] {
      return Object.freeze(
        [...new Set(edges.filter((edge) => edge.toNodeId === nodeId).map((edge) => edge.fromNodeId))].sort(),
      );
    },
  });
}
