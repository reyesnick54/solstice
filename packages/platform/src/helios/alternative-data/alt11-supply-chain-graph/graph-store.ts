import { createHash } from 'node:crypto';

import type { UtcInstant } from '@solstice/domain';
import { confidenceScoreMilliFromState } from './confidence.ts';
import {
  EVIDENCE_REQUIRED_EDGE_TYPES,
  HELIOS_SUPPLY_CHAIN_GRAPH_SCHEMA,
  SUPPLY_CHAIN_EDGE_TYPES,
  SUPPLY_CHAIN_NODE_KINDS,
  type SupplyChainEdgeType,
  type SupplyChainNodeKind,
} from './taxonomy.ts';
import type { SupplyChainEdge, SupplyChainGraphSnapshot, SupplyChainMappingEvidence, SupplyChainNode } from './types.ts';

export type UpsertSupplyChainNodeInput = Omit<SupplyChainNode, 'grantsExecutionAuthority'>;

export type AppendSupplyChainEdgeInput = SupplyChainMappingEvidence & {
  readonly edgeType: SupplyChainEdgeType;
  readonly fromNodeId: string;
  readonly toNodeId: string;
  readonly edgeWeightMilli?: number;
};

export type SupplyChainGraphStore = {
  readonly graphVersion: () => number;
  readonly upsertNode: (node: UpsertSupplyChainNodeInput) => SupplyChainNode;
  readonly getNode: (nodeId: string) => SupplyChainNode | undefined;
  readonly listNodes: () => readonly SupplyChainNode[];
  readonly appendEdge: (
    input: AppendSupplyChainEdgeInput,
  ) => { readonly ok: true; readonly edge: SupplyChainEdge } | { readonly ok: false; readonly message: string };
  readonly listEdges: () => readonly SupplyChainEdge[];
  readonly activeEdges: (options: { readonly asOf: UtcInstant; readonly knowableCutoff: UtcInstant }) => readonly SupplyChainEdge[];
  readonly snapshot: (sealedAt: UtcInstant, temporalEntityGraphDigest: string | null) => SupplyChainGraphSnapshot;
};

function edgeIdFor(input: AppendSupplyChainEdgeInput): string {
  const material = `${input.edgeType}:${input.fromNodeId}:${input.toNodeId}:${input.effectiveFrom}:${input.knowableAt}`;
  return createHash('sha256').update(material).digest('hex').slice(0, 32);
}

function digestGraph(input: {
  readonly graphVersion: number;
  readonly nodes: readonly SupplyChainNode[];
  readonly edges: readonly SupplyChainEdge[];
}): string {
  const material = JSON.stringify({
    graphVersion: input.graphVersion,
    nodes: input.nodes.map((n) => n.nodeId).sort(),
    edges: input.edges.map((e) => e.edgeId).sort(),
  });
  return createHash('sha256').update(material).digest('hex');
}

export function assertSupplyChainEdgeEvidence(
  input: AppendSupplyChainEdgeInput,
): { readonly ok: true } | { readonly ok: false; readonly message: string } {
  if (!SUPPLY_CHAIN_NODE_KINDS.length) {
    return { ok: false, message: 'taxonomy not loaded' };
  }
  if (!SUPPLY_CHAIN_EDGE_TYPES.includes(input.edgeType)) {
    return { ok: false, message: `unknown edge type: ${input.edgeType}` };
  }
  if (
    (EVIDENCE_REQUIRED_EDGE_TYPES as readonly string[]).includes(input.edgeType) &&
    input.evidenceRefs.length === 0
  ) {
    return {
      ok: false,
      message: `${input.edgeType} requires evidenceRefs; opaque inference rejected`,
    };
  }
  if (input.fromNodeId === input.toNodeId) {
    return { ok: false, message: 'self-edge rejected' };
  }
  if (input.confidenceScoreMilli < 0 || input.confidenceScoreMilli > 1000) {
    return { ok: false, message: 'confidenceScoreMilli must be 0–1000' };
  }
  return { ok: true };
}

function normalizeConfidence(input: AppendSupplyChainEdgeInput): number {
  if (input.confidenceScoreMilli > 0) {
    return input.confidenceScoreMilli;
  }
  return confidenceScoreMilliFromState(input.confidenceState);
}

function isEdgeActive(edge: SupplyChainEdge, asOf: UtcInstant, knowableCutoff: UtcInstant): boolean {
  if (edge.effectiveFrom > asOf) {
    return false;
  }
  if (edge.effectiveTo !== null && edge.effectiveTo <= asOf) {
    return false;
  }
  return edge.knowableAt <= knowableCutoff;
}

export function createSupplyChainGraphStore(): SupplyChainGraphStore {
  let version = 0;
  const nodes = new Map<string, SupplyChainNode>();
  const edges: SupplyChainEdge[] = [];

  const bump = (): void => {
    version += 1;
  };

  return Object.freeze({
    graphVersion: () => version,
    upsertNode(nodeInput) {
      const node: SupplyChainNode = Object.freeze({
        ...nodeInput,
        grantsExecutionAuthority: false,
      });
      if (!SUPPLY_CHAIN_NODE_KINDS.includes(node.kind)) {
        throw new Error(`unknown supply chain node kind: ${node.kind}`);
      }
      nodes.set(node.nodeId, node);
      bump();
      return node;
    },
    getNode(nodeId) {
      return nodes.get(nodeId);
    },
    listNodes() {
      return Object.freeze([...nodes.values()]);
    },
    appendEdge(input) {
      const check = assertSupplyChainEdgeEvidence(input);
      if (!check.ok) {
        return { ok: false, message: check.message };
      }
      if (!nodes.has(input.fromNodeId) || !nodes.has(input.toNodeId)) {
        return { ok: false, message: 'both endpoint nodes must exist before edge append' };
      }
      const confidenceScoreMilli = normalizeConfidence(input);
      const edgeWeightMilli = input.edgeWeightMilli ?? confidenceScoreMilli;
      const edge: SupplyChainEdge = Object.freeze({
        edgeId: edgeIdFor(input),
        edgeType: input.edgeType,
        fromNodeId: input.fromNodeId,
        toNodeId: input.toNodeId,
        evidenceRefs: Object.freeze([...input.evidenceRefs]),
        source: input.source,
        confidenceState: input.confidenceState,
        ambiguityState: input.ambiguityState,
        confidenceScoreMilli,
        effectiveFrom: input.effectiveFrom,
        effectiveTo: input.effectiveTo,
        observedAt: input.observedAt,
        knowableAt: input.knowableAt,
        jurisdiction: input.jurisdiction,
        edgeWeightMilli,
        grantsExecutionAuthority: false,
      });
      edges.push(edge);
      bump();
      return { ok: true, edge };
    },
    listEdges() {
      return Object.freeze([...edges]);
    },
    activeEdges(options) {
      return Object.freeze(edges.filter((e) => isEdgeActive(e, options.asOf, options.knowableCutoff)));
    },
    snapshot(sealedAt, temporalEntityGraphDigest) {
      return Object.freeze({
        schemaVersion: HELIOS_SUPPLY_CHAIN_GRAPH_SCHEMA,
        graphVersion: version,
        sealedAt,
        nodes: Object.freeze([...nodes.values()]),
        edges: Object.freeze([...edges]),
        temporalEntityGraphDigest,
        contentDigest: digestGraph({ graphVersion: version, nodes: [...nodes.values()], edges }),
      });
    },
  });
}

export function supplyChainNodeKindGuard(kind: string): kind is SupplyChainNodeKind {
  return (SUPPLY_CHAIN_NODE_KINDS as readonly string[]).includes(kind);
}
