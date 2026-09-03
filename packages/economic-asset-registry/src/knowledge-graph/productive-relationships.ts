import type { UtcInstant } from '../../../domain/src/time.ts';
import { knowledgeEdgeIdFor, knowledgeNodeIdFor } from './ids.ts';
import type { KnowledgeNodeId } from '../ids.ts';
import type { KnowledgeEdge, KnowledgeNode } from '../types.ts';
import type { KnowledgeRelationKind } from './ontology.ts';

export type ProductiveRelationshipInput = {
  readonly assetNodeId: KnowledgeNodeId;
  readonly eventNodeId: KnowledgeNodeId;
  readonly relation: KnowledgeRelationKind;
  readonly provenanceRef: string;
  readonly createdAt: UtcInstant;
  readonly authorized?: boolean;
};

export function buildProductiveEventNode(input: {
  readonly eventLabel: string;
  readonly eventKind: string;
  readonly providerRef: string | null;
  readonly createdAt: UtcInstant;
}): KnowledgeNode {
  const material = `productive-event:${input.eventKind}:${input.eventLabel}:${input.providerRef ?? ''}`;
  return Object.freeze({
    nodeId: knowledgeNodeIdFor(material),
    nodeClass: 'ECONOMIC_EVENT',
    domain: 'PRODUCTIVE_ECONOMY',
    canonicalEntityId: null,
    label: input.eventLabel,
    externalRef: input.providerRef,
    payload: Object.freeze({
      eventKind: input.eventKind,
    }),
    createdAt: input.createdAt,
    authoritative: false,
    mutatesFinancialState: false,
  });
}

export function buildProductiveAssetNode(input: {
  readonly assetLabel: string;
  readonly assetClass: 'FACILITY' | 'PRODUCTIVE_ASSET';
  readonly externalRef: string;
  readonly createdAt: UtcInstant;
}): KnowledgeNode {
  const material = `productive-asset:${input.assetClass}:${input.externalRef}`;
  return Object.freeze({
    nodeId: knowledgeNodeIdFor(material),
    nodeClass: input.assetClass === 'FACILITY' ? 'FACILITY' : 'PRODUCTIVE_ASSET',
    domain: 'PRODUCTIVE_ECONOMY',
    canonicalEntityId: null,
    label: input.assetLabel,
    externalRef: input.externalRef,
    payload: Object.freeze({
      assetClass: input.assetClass,
    }),
    createdAt: input.createdAt,
    authoritative: false,
    mutatesFinancialState: false,
  });
}

export function buildProductiveRelationshipEdge(input: ProductiveRelationshipInput): KnowledgeEdge {
  return Object.freeze({
    edgeId: knowledgeEdgeIdFor(`${input.relation}:${input.assetNodeId}:${input.eventNodeId}`),
    kind: input.relation,
    fromNodeId: input.assetNodeId,
    toNodeId: input.eventNodeId,
    domain: 'PRODUCTIVE_ECONOMY',
    authorized: input.authorized ?? true,
    createdAt: input.createdAt,
    provenanceRef: input.provenanceRef,
  });
}

export const PRODUCTIVE_SCENARIO_FIXTURES = Object.freeze([
  Object.freeze({ assetLabel: 'North Ridge Power Plant', assetClass: 'FACILITY' as const, eventLabel: 'Energy Generation Event', eventKind: 'ENERGY', relation: 'GENERATES' as KnowledgeRelationKind }),
  Object.freeze({ assetLabel: 'River Valley Factory', assetClass: 'FACILITY' as const, eventLabel: 'Manufacturing Output Event', eventKind: 'MANUFACTURING', relation: 'PRODUCED' as KnowledgeRelationKind }),
  Object.freeze({ assetLabel: 'Orion Compute Cluster', assetClass: 'PRODUCTIVE_ASSET' as const, eventLabel: 'Compute Execution Event', eventKind: 'COMPUTE', relation: 'EXECUTES' as KnowledgeRelationKind }),
  Object.freeze({ assetLabel: 'Harbor Port Terminal', assetClass: 'FACILITY' as const, eventLabel: 'Logistics Handling Event', eventKind: 'LOGISTICS', relation: 'HANDLES' as KnowledgeRelationKind }),
]);
