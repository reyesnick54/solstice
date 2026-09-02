import { knowledgeEdgeIdFor, knowledgeNodeIdFor } from './ids.ts';
import type { KnowledgeNodeId } from './ids.ts';
import type { ClaimLinkage, EconomicClaimRef, KnowledgeEdge, KnowledgeNode } from './types.ts';
import type { UtcInstant } from '../../../domain/src/time.ts';

export type ClaimLinkageInput = {
  readonly claimRef: EconomicClaimRef;
  readonly canonicalEventKey: string;
  readonly observationRefs: readonly string[];
  readonly evidenceRefs: readonly string[];
  readonly providerRefs: readonly string[];
  readonly createdAt: UtcInstant;
  readonly provenanceRef: string;
};

export function buildClaimLinkageBundle(input: ClaimLinkageInput): {
  readonly claimNode: KnowledgeNode;
  readonly eventNode: KnowledgeNode;
  readonly observationNodes: readonly KnowledgeNode[];
  readonly evidenceNodes: readonly KnowledgeNode[];
  readonly providerNodes: readonly KnowledgeNode[];
  readonly edges: readonly KnowledgeEdge[];
  readonly linkage: ClaimLinkage;
} {
  const claimNode: KnowledgeNode = Object.freeze({
    nodeId: knowledgeNodeIdFor(`claim:${input.claimRef.claimClass}:${input.claimRef.claimId}`),
    nodeClass: 'ECONOMIC_CLAIM',
    domain: input.claimRef.claimClass === 'HUMAN_CONTRIBUTION' ? 'HUMAN_ECONOMY' : 'PRODUCTIVE_ECONOMY',
    canonicalEntityId: null,
    label: input.claimRef.claimId,
    externalRef: input.claimRef.claimId,
    payload: Object.freeze({
      claimClass: input.claimRef.claimClass,
      fingerprint: input.claimRef.fingerprint ?? '',
    }),
    createdAt: input.createdAt,
    authoritative: false,
    mutatesFinancialState: false,
  });

  const eventNode: KnowledgeNode = Object.freeze({
    nodeId: knowledgeNodeIdFor(`canonical-event:${input.canonicalEventKey}`),
    nodeClass: 'ECONOMIC_EVENT',
    domain: claimNode.domain,
    canonicalEntityId: null,
    label: input.canonicalEventKey,
    externalRef: input.canonicalEventKey,
    payload: Object.freeze({ canonical: 'true' }),
    createdAt: input.createdAt,
    authoritative: false,
    mutatesFinancialState: false,
  });

  const observationNodes = input.observationRefs.map((ref) =>
    Object.freeze({
      nodeId: knowledgeNodeIdFor(`observation:${ref}`),
      nodeClass: 'OBSERVATION' as const,
      domain: claimNode.domain,
      canonicalEntityId: null,
      label: ref,
      externalRef: ref,
      payload: Object.freeze({ observationRef: ref }),
      createdAt: input.createdAt,
      authoritative: false,
      mutatesFinancialState: false,
    }),
  );

  const evidenceNodes = input.evidenceRefs.map((ref) =>
    Object.freeze({
      nodeId: knowledgeNodeIdFor(`evidence:${ref}`),
      nodeClass: 'EVIDENCE' as const,
      domain: claimNode.domain,
      canonicalEntityId: null,
      label: ref,
      externalRef: ref,
      payload: Object.freeze({ evidenceRef: ref }),
      createdAt: input.createdAt,
      authoritative: false,
      mutatesFinancialState: false,
    }),
  );

  const providerNodes = input.providerRefs.map((ref) =>
    Object.freeze({
      nodeId: knowledgeNodeIdFor(`provider:${ref}`),
      nodeClass: 'PROVIDER' as const,
      domain: 'SHARED_REFERENCE' as const,
      canonicalEntityId: null,
      label: ref,
      externalRef: ref,
      payload: Object.freeze({ providerId: ref }),
      createdAt: input.createdAt,
      authoritative: false,
      mutatesFinancialState: false,
    }),
  );

  const edges: KnowledgeEdge[] = [];
  const linkEdge = (from: KnowledgeNodeId, to: KnowledgeNodeId, kind: KnowledgeEdge['kind']): void => {
    edges.push(
      Object.freeze({
        edgeId: knowledgeEdgeIdFor(`${kind}:${from}:${to}`),
        kind,
        fromNodeId: from,
        toNodeId: to,
        domain: claimNode.domain,
        authorized: true,
        createdAt: input.createdAt,
        provenanceRef: input.provenanceRef,
      }),
    );
  };

  linkEdge(claimNode.nodeId, eventNode.nodeId, 'LINKS_CLAIM');
  for (const observation of observationNodes) {
    linkEdge(observation.nodeId, eventNode.nodeId, 'OBSERVED_BY');
  }
  for (const evidence of evidenceNodes) {
    linkEdge(evidence.nodeId, claimNode.nodeId, 'SUPPORTED_BY');
  }
  for (const provider of providerNodes) {
    linkEdge(observationNodes[0]?.nodeId ?? eventNode.nodeId, provider.nodeId, 'ATTESTED_BY');
  }

  const linkage: ClaimLinkage = Object.freeze({
    claimRef: Object.freeze({ ...input.claimRef }),
    claimNodeId: claimNode.nodeId,
    canonicalEventNodeId: eventNode.nodeId,
    observationNodeIds: Object.freeze(observationNodes.map((n) => n.nodeId)),
    evidenceNodeIds: Object.freeze(evidenceNodes.map((n) => n.nodeId)),
    providerNodeIds: Object.freeze(providerNodes.map((n) => n.nodeId)),
  });

  return Object.freeze({
    claimNode,
    eventNode,
    observationNodes: Object.freeze(observationNodes),
    evidenceNodes: Object.freeze(evidenceNodes),
    providerNodes: Object.freeze(providerNodes),
    edges: Object.freeze(edges),
    linkage,
  });
}

export function linkDuplicateEvents(
  primaryEventNodeId: KnowledgeNodeId,
  duplicateEventNodeId: KnowledgeNodeId,
  createdAt: UtcInstant,
  provenanceRef: string,
): KnowledgeEdge {
  return Object.freeze({
    edgeId: knowledgeEdgeIdFor(`SAME_AS:${duplicateEventNodeId}:${primaryEventNodeId}`),
    kind: 'SAME_AS',
    fromNodeId: duplicateEventNodeId,
    toNodeId: primaryEventNodeId,
    domain: 'SHARED_REFERENCE',
    authorized: true,
    createdAt,
    provenanceRef,
  });
}
