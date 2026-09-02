/**
 * Wave 5 — Productive Economic Graph specialization.
 *
 * Projects productive ontology into the Wave 4 Economic Knowledge Graph.
 */

import type { UtcInstant } from '../../../../domain/src/time.ts';
import type { KnowledgeEdge, KnowledgeNode } from '../../../../economic-asset-registry/src/knowledge-graph/types.ts';
import type { KnowledgeRelationKind } from '../../../../economic-asset-registry/src/knowledge-graph/ontology.ts';
import {
  buildProductiveAssetNode,
  buildProductiveEventNode,
  buildProductiveRelationshipEdge,
} from '../../../../economic-asset-registry/src/knowledge-graph/productive-relationships.ts';
import { knowledgeEdgeIdFor, knowledgeNodeIdFor } from '../../../../economic-asset-registry/src/knowledge-graph/ids.ts';
import type { ProductiveEventMaterial } from './types.ts';
import { eventTypeDefinition } from './events.ts';

export const PRODUCTIVE_EVENT_RELATIONS: Readonly<Record<string, KnowledgeRelationKind>> = Object.freeze({
  EnergyGenerated: 'GENERATES',
  EnergyDelivered: 'DELIVERED',
  ComputeExecuted: 'EXECUTES',
  AIComputeExecuted: 'EXECUTES',
  GoodsManufactured: 'PRODUCED',
  ResourceExtracted: 'PRODUCED',
  ResourceProcessed: 'PRODUCED',
  AgriculturalOutputProduced: 'PRODUCED',
  LogisticsMovementCompleted: 'HANDLES',
  TransportServiceCompleted: 'HANDLES',
  BandwidthDelivered: 'DELIVERED',
  WaterProduced: 'GENERATES',
  WaterDelivered: 'DELIVERED',
  InfrastructureCapacityProvided: 'PRODUCED',
});

export type ProductiveGraphProjection = {
  readonly entityNode: KnowledgeNode;
  readonly eventNode: KnowledgeNode;
  readonly assetToEventEdge: KnowledgeEdge;
  readonly observationEdges: readonly KnowledgeEdge[];
  readonly evidenceEdges: readonly KnowledgeEdge[];
  readonly claimEdge: KnowledgeEdge | null;
};

function buildSourceNode(sourceRef: string, createdAt: UtcInstant): KnowledgeNode {
  const material = `provider:${sourceRef}`;
  return Object.freeze({
    nodeId: knowledgeNodeIdFor(material),
    nodeClass: 'PROVIDER',
    domain: 'PRODUCTIVE_ECONOMY',
    canonicalEntityId: null,
    label: sourceRef,
    externalRef: sourceRef,
    payload: Object.freeze({ role: 'source' }),
    createdAt,
    authoritative: false,
    mutatesFinancialState: false,
  });
}

function buildEvidenceNode(evidenceRef: string, createdAt: UtcInstant): KnowledgeNode {
  const material = `evidence:${evidenceRef}`;
  return Object.freeze({
    nodeId: knowledgeNodeIdFor(material),
    nodeClass: 'EVIDENCE',
    domain: 'PRODUCTIVE_ECONOMY',
    canonicalEntityId: null,
    label: evidenceRef,
    externalRef: evidenceRef,
    payload: Object.freeze({}),
    createdAt,
    authoritative: false,
    mutatesFinancialState: false,
  });
}

function buildClaimNode(claimId: string, createdAt: UtcInstant): KnowledgeNode {
  const material = `claim:${claimId}`;
  return Object.freeze({
    nodeId: knowledgeNodeIdFor(material),
    nodeClass: 'ECONOMIC_CLAIM',
    domain: 'PRODUCTIVE_ECONOMY',
    canonicalEntityId: null,
    label: claimId,
    externalRef: claimId,
    payload: Object.freeze({ domain: 'PRODUCTIVE_ECONOMIC' }),
    createdAt,
    authoritative: false,
    mutatesFinancialState: false,
  });
}

function edge(
  kind: KnowledgeRelationKind,
  fromNodeId: KnowledgeNode['nodeId'],
  toNodeId: KnowledgeNode['nodeId'],
  provenanceRef: string,
  createdAt: UtcInstant,
): KnowledgeEdge {
  return Object.freeze({
    edgeId: knowledgeEdgeIdFor(`${kind}:${fromNodeId}:${toNodeId}`),
    kind,
    fromNodeId,
    toNodeId,
    domain: 'PRODUCTIVE_ECONOMY',
    authorized: true,
    createdAt,
    provenanceRef,
  });
}

export function projectProductiveEventToGraph(input: {
  readonly event: ProductiveEventMaterial;
  readonly entityLabel: string;
  readonly eventLabel: string;
  readonly sourceRefs: readonly string[];
  readonly claimId?: string;
  readonly createdAt: UtcInstant;
  readonly provenanceRef?: string;
}): ProductiveGraphProjection {
  const provenanceRef = input.provenanceRef ?? 'wave5-productive-graph';
  const eventDef = eventTypeDefinition(input.event.eventType);
  const relation = PRODUCTIVE_EVENT_RELATIONS[input.event.eventType] ?? 'PRODUCED';
  const assetClass = eventDef?.entityClasses.includes('ComputeCluster') || eventDef?.entityClasses.includes('AIAcceleratorPool')
    ? 'PRODUCTIVE_ASSET' as const
    : 'FACILITY' as const;

  const entityNode = buildProductiveAssetNode({
    assetLabel: input.entityLabel,
    assetClass,
    externalRef: input.event.entityRef,
    createdAt: input.createdAt,
  });
  const eventNode = buildProductiveEventNode({
    eventLabel: input.eventLabel,
    eventKind: input.event.eventType,
    providerRef: input.sourceRefs[0] ?? null,
    createdAt: input.createdAt,
  });
  const assetToEventEdge = buildProductiveRelationshipEdge({
    assetNodeId: entityNode.nodeId,
    eventNodeId: eventNode.nodeId,
    relation,
    provenanceRef,
    createdAt: input.createdAt,
  });

  const observationEdges: KnowledgeEdge[] = [];
  const evidenceEdges: KnowledgeEdge[] = [];
  for (const sourceRef of input.sourceRefs) {
    const sourceNode = buildSourceNode(sourceRef, input.createdAt);
    observationEdges.push(edge('OBSERVED_BY', eventNode.nodeId, sourceNode.nodeId, provenanceRef, input.createdAt));
  }
  for (const evidenceRef of input.event.evidenceRefs) {
    const evidenceNode = buildEvidenceNode(evidenceRef, input.createdAt);
    evidenceEdges.push(edge('SUPPORTED_BY', eventNode.nodeId, evidenceNode.nodeId, provenanceRef, input.createdAt));
  }

  let claimEdge: KnowledgeEdge | null = null;
  if (input.claimId) {
    const claimNode = buildClaimNode(input.claimId, input.createdAt);
    claimEdge = edge('RESOLVES_TO', eventNode.nodeId, claimNode.nodeId, provenanceRef, input.createdAt);
  }

  return Object.freeze({
    entityNode,
    eventNode,
    assetToEventEdge,
    observationEdges: Object.freeze(observationEdges),
    evidenceEdges: Object.freeze(evidenceEdges),
    claimEdge,
  });
}
