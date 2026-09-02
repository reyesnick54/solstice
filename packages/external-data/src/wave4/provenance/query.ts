/**
 * Read-only provenance trace query.
 * Traces EconomicClaim → VerifiedFacts → Evidence → Observations → Provider records.
 * Does not expose sensitive raw content.
 */

import type { ProvenanceGraphStore } from './graph.ts';
import type { ProvenanceNode, ProvenanceNodeId, ProvenanceNodeKind } from './types.ts';

export type ProvenanceTraceNode = {
  readonly nodeId: string;
  readonly kind: ProvenanceNodeKind;
  readonly contentCommitment: string | null;
  readonly rawPayloadHash: string | null;
  readonly providerId: string | null;
  readonly capability: string | null;
  readonly dataset: string | null;
  readonly createdAt: string;
  readonly edgeKinds: readonly string[];
};

export type ProvenanceTrace = {
  readonly rootNodeId: string;
  readonly rootKind: ProvenanceNodeKind;
  readonly nodes: readonly ProvenanceTraceNode[];
  readonly depth: number;
};

const UPSTREAM_KIND_ORDER: readonly ProvenanceNodeKind[] = [
  'economic_claim',
  'verified_fact',
  'evidence',
  'normalized_observation',
  'observation',
  'provider_record',
];

function sanitizeNode(node: ProvenanceNode, edgeKinds: readonly string[]): ProvenanceTraceNode {
  return Object.freeze({
    nodeId: node.nodeId,
    kind: node.kind,
    contentCommitment: node.contentCommitment,
    rawPayloadHash: node.rawPayloadHash,
    providerId: node.providerId,
    capability: node.capability,
    dataset: node.dataset,
    createdAt: node.createdAt,
    edgeKinds,
  });
}

export function traceProvenanceUpstream(
  graph: ProvenanceGraphStore,
  rootNodeId: ProvenanceNodeId,
  maxDepth = 32,
): ProvenanceTrace | null {
  const root = graph.getNode(rootNodeId);
  if (!root) {
    return null;
  }

  const visited = new Set<string>();
  const collected = new Map<string, { node: ProvenanceNode; edgeKinds: Set<string> }>();

  const walk = (nodeId: ProvenanceNodeId, depth: number): void => {
    if (depth > maxDepth || visited.has(nodeId)) {
      return;
    }
    visited.add(nodeId);
    const node = graph.getNode(nodeId);
    if (!node) {
      return;
    }
    const bucket = collected.get(nodeId) ?? { node, edgeKinds: new Set<string>() };
    collected.set(nodeId, bucket);

    for (const parentId of graph.parentsOf(nodeId)) {
      const edges = graph.listEdges().filter((edge) => edge.fromNodeId === nodeId && edge.toNodeId === parentId);
      for (const edge of edges) {
        bucket.edgeKinds.add(edge.kind);
      }
      walk(parentId, depth + 1);
    }
  };

  walk(rootNodeId, 0);

  const nodes = [...collected.values()]
    .map(({ node, edgeKinds }) => sanitizeNode(node, [...edgeKinds].sort()))
    .sort((left, right) => {
      const leftRank = UPSTREAM_KIND_ORDER.indexOf(left.kind);
      const rightRank = UPSTREAM_KIND_ORDER.indexOf(right.kind);
      if (leftRank !== rightRank) {
        return leftRank - rightRank;
      }
      return left.createdAt.localeCompare(right.createdAt);
    });

  return Object.freeze({
    rootNodeId,
    rootKind: root.kind,
    nodes,
    depth: nodes.length,
  });
}

export function traceClaimToProviderRecords(
  graph: ProvenanceGraphStore,
  claimNodeId: ProvenanceNodeId,
): ProvenanceTrace | null {
  return traceProvenanceUpstream(graph, claimNodeId);
}

export function findClaimsForProviderRecord(
  graph: ProvenanceGraphStore,
  providerRecordNodeId: ProvenanceNodeId,
): readonly ProvenanceNodeId[] {
  const claims = new Set<ProvenanceNodeId>();
  const visited = new Set<string>();

  const walkDown = (nodeId: ProvenanceNodeId): void => {
    if (visited.has(nodeId)) {
      return;
    }
    visited.add(nodeId);
    const node = graph.getNode(nodeId);
    if (node?.kind === 'economic_claim') {
      claims.add(nodeId);
    }
    for (const childId of graph.childrenOf(nodeId)) {
      walkDown(childId);
    }
  };

  walkDown(providerRecordNodeId);
  return Object.freeze([...claims].sort());
}
