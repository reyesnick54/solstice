import { createHash } from 'node:crypto';

import type { UtcInstant } from '../../../../../domain/src/time.ts';
import {
  providerMappingIdFor,
  temporalEntityEdgeIdFor,
  temporalEntityNodeIdFor,
} from './ids.ts';
import type {
  AppendTemporalEdgeInput,
  ProviderSymbolLookup,
  RegisterProviderMappingInput,
  TemporalEntityEdge,
  TemporalEntityGraphSnapshot,
  TemporalEntityNode,
} from './types.ts';
import { HELIOS_TEMPORAL_ENTITY_GRAPH_SCHEMA } from './types.ts';

export type TemporalEntityGraphStore = {
  readonly graphVersion: () => number;
  readonly upsertNode: (input: Omit<TemporalEntityNode, 'grantsExecutionAuthority'> & { readonly nodeId?: string }) => TemporalEntityNode;
  readonly getNode: (nodeId: string) => TemporalEntityNode | undefined;
  readonly listNodes: () => readonly TemporalEntityNode[];
  readonly appendEdge: (input: AppendTemporalEdgeInput) => TemporalEntityEdge;
  readonly listEdges: () => readonly TemporalEntityEdge[];
  readonly registerProviderMapping: (input: RegisterProviderMappingInput) => ProviderSymbolLookup;
  readonly listProviderMappings: () => readonly ProviderSymbolLookup[];
  readonly snapshot: (sealedAt: UtcInstant) => TemporalEntityGraphSnapshot;
  readonly restore: (snapshot: TemporalEntityGraphSnapshot) => void;
};

function digestSnapshot(input: {
  readonly graphVersion: number;
  readonly nodes: readonly TemporalEntityNode[];
  readonly edges: readonly TemporalEntityEdge[];
  readonly providerMappings: readonly ProviderSymbolLookup[];
}): string {
  const material = JSON.stringify({
    graphVersion: input.graphVersion,
    nodes: input.nodes.map((n) => n.nodeId).sort(),
    edges: input.edges.map((e) => e.edgeId).sort(),
    mappings: input.providerMappings.map((m) => m.mappingId).sort(),
  });
  return createHash('sha256').update(material).digest('hex');
}

export function createTemporalEntityGraphStore(): TemporalEntityGraphStore {
  let version = 0;
  const nodes = new Map<string, TemporalEntityNode>();
  const edges: TemporalEntityEdge[] = [];
  const providerMappings: ProviderSymbolLookup[] = [];

  const bump = (): void => {
    version += 1;
  };

  return Object.freeze({
    graphVersion: () => version,
    upsertNode(input) {
      const nodeId = input.nodeId ?? temporalEntityNodeIdFor(`${input.kind}:${input.displayName}`);
      const node: TemporalEntityNode = Object.freeze({
        nodeId,
        kind: input.kind,
        displayName: input.displayName,
        jurisdiction: input.jurisdiction,
        economicKnowledgeEntityId: input.economicKnowledgeEntityId,
        payload: Object.freeze({ ...input.payload }),
        grantsExecutionAuthority: false,
      });
      nodes.set(nodeId, node);
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
      const edgeId = temporalEntityEdgeIdFor(
        `${input.relationshipType}:${input.fromNodeId}:${input.toNodeId}:${input.effectiveFrom}:${input.knowableAt}`,
      );
      const edge: TemporalEntityEdge = Object.freeze({
        edgeId,
        relationshipType: input.relationshipType,
        fromNodeId: input.fromNodeId,
        toNodeId: input.toNodeId,
        evidenceRefs: Object.freeze([...input.evidenceRefs]),
        source: input.source,
        confidenceState: input.confidenceState,
        ambiguityState: input.ambiguityState,
        effectiveFrom: input.effectiveFrom,
        effectiveTo: input.effectiveTo,
        observedAt: input.observedAt,
        knowableAt: input.knowableAt,
        jurisdiction: input.jurisdiction,
        providerMapping: input.providerMapping ? Object.freeze({ ...input.providerMapping }) : null,
      });
      edges.push(edge);
      bump();
      return edge;
    },
    listEdges() {
      return Object.freeze([...edges]);
    },
    registerProviderMapping(input) {
      const mappingId = providerMappingIdFor(
        `${input.providerId}:${input.providerSymbol}:${input.targetNodeId}:${input.effectiveFrom}`,
      );
      const row: ProviderSymbolLookup = Object.freeze({
        mappingId,
        providerId: input.providerId,
        providerSymbol: input.providerSymbol,
        providerInstrumentId: input.providerInstrumentId,
        targetNodeId: input.targetNodeId,
        evidenceRefs: Object.freeze([...input.evidenceRefs]),
        source: input.source,
        confidenceState: input.confidenceState,
        ambiguityState: input.ambiguityState,
        effectiveFrom: input.effectiveFrom,
        effectiveTo: input.effectiveTo,
        observedAt: input.observedAt,
        knowableAt: input.knowableAt,
        jurisdiction: input.jurisdiction,
      });
      providerMappings.push(row);
      bump();
      return row;
    },
    listProviderMappings() {
      return Object.freeze([...providerMappings]);
    },
    snapshot(sealedAt) {
      const snap: TemporalEntityGraphSnapshot = Object.freeze({
        schemaVersion: HELIOS_TEMPORAL_ENTITY_GRAPH_SCHEMA,
        graphVersion: version,
        sealedAt,
        nodes: Object.freeze([...nodes.values()]),
        edges: Object.freeze([...edges]),
        providerMappings: Object.freeze([...providerMappings]),
        contentDigest: digestSnapshot({
          graphVersion: version,
          nodes: [...nodes.values()],
          edges,
          providerMappings,
        }),
      });
      return snap;
    },
    restore(snapshot) {
      if (snapshot.schemaVersion !== HELIOS_TEMPORAL_ENTITY_GRAPH_SCHEMA) {
        throw new Error(`unsupported graph schema ${snapshot.schemaVersion}`);
      }
      nodes.clear();
      edges.length = 0;
      providerMappings.length = 0;
      for (const node of snapshot.nodes) {
        nodes.set(node.nodeId, node);
      }
      edges.push(...snapshot.edges);
      providerMappings.push(...snapshot.providerMappings);
      version = snapshot.graphVersion;
    },
  });
}
