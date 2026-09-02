/**
 * Wave 6 — Human Economic Contribution Graph specialization.
 *
 * Projects human ontology into the Wave 4 Economic Knowledge Graph.
 */

import type { UtcInstant } from '../../../../domain/src/time.ts';
import type { KnowledgeEdge, KnowledgeNode } from '../../../../economic-asset-registry/src/knowledge-graph/types.ts';
import type { KnowledgeRelationKind } from '../../../../economic-asset-registry/src/knowledge-graph/ontology.ts';
import { knowledgeEdgeIdFor, knowledgeNodeIdFor } from '../../../../economic-asset-registry/src/knowledge-graph/ids.ts';
import type { HumanContributionEventMaterial } from './types.ts';
import { eventTypeDefinition } from './events.ts';

export const HUMAN_EVENT_RELATIONS: Readonly<Record<string, KnowledgeRelationKind>> = Object.freeze({
  WorkPerformed: 'PERFORMED',
  SkillDemonstrated: 'DEMONSTRATED',
  CredentialEarned: 'EARNED',
  ResearchPublished: 'CONTRIBUTED_TO',
  ResearchContributionVerified: 'CONTRIBUTED_TO',
  AuthorizedDatasetContribution: 'AUTHORIZED',
  ComputationContributionCompleted: 'PARTICIPATED_IN',
  EducationalMilestoneCompleted: 'EARNED',
  CreativeWorkContributed: 'CONTRIBUTED_TO',
  CommunityServiceCompleted: 'PERFORMED',
  EntrepreneurialMilestoneReached: 'PERFORMED',
  CareServiceDelivered: 'PERFORMED',
});

export type HumanGraphProjection = {
  readonly actorNode: KnowledgeNode;
  readonly contributionNode: KnowledgeNode;
  readonly actorToContributionEdge: KnowledgeEdge;
  readonly evidenceEdges: readonly KnowledgeEdge[];
  readonly attestationEdges: readonly KnowledgeEdge[];
  readonly methodologyEdge: KnowledgeEdge | null;
  readonly consentEdges: readonly KnowledgeEdge[];
  readonly purposeEdges: readonly KnowledgeEdge[];
  readonly claimEdge: KnowledgeEdge | null;
};

function buildActorNode(pseudonymousId: string, createdAt: UtcInstant): KnowledgeNode {
  const material = `human-actor:${pseudonymousId}`;
  return Object.freeze({
    nodeId: knowledgeNodeIdFor(material),
    nodeClass: 'PSEUDONYMOUS_PERSON',
    domain: 'HUMAN_ECONOMY',
    canonicalEntityId: null,
    label: pseudonymousId,
    externalRef: pseudonymousId,
    payload: Object.freeze({ role: 'contributor' }),
    createdAt,
    authoritative: false,
    mutatesFinancialState: false,
  });
}

function buildContributionNode(event: HumanContributionEventMaterial, createdAt: UtcInstant): KnowledgeNode {
  const material = `human-contribution:${event.eventRef}`;
  return Object.freeze({
    nodeId: knowledgeNodeIdFor(material),
    nodeClass: 'ECONOMIC_EVENT',
    domain: 'HUMAN_ECONOMY',
    canonicalEntityId: null,
    label: event.eventType,
    externalRef: event.eventRef,
    payload: Object.freeze({
      governanceCategory: event.governanceCategory,
      contributionClass: event.contributionClass,
      eventKind: event.eventKind,
    }),
    createdAt,
    authoritative: false,
    mutatesFinancialState: false,
  });
}

function buildRefNode(
  nodeClass: KnowledgeNode['nodeClass'],
  ref: string,
  prefix: string,
  createdAt: UtcInstant,
): KnowledgeNode {
  const material = `${prefix}:${ref}`;
  return Object.freeze({
    nodeId: knowledgeNodeIdFor(material),
    nodeClass,
    domain: 'HUMAN_ECONOMY',
    canonicalEntityId: null,
    label: ref,
    externalRef: ref,
    payload: Object.freeze({}),
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
    domain: 'HUMAN_ECONOMY',
    authorized: true,
    createdAt,
    provenanceRef,
  });
}

export function projectHumanContributionToGraph(input: {
  readonly event: HumanContributionEventMaterial;
  readonly claimId?: string;
  readonly createdAt: UtcInstant;
  readonly provenanceRef?: string;
}): HumanGraphProjection {
  const provenanceRef = input.provenanceRef ?? 'wave6-human-graph';
  const eventDef = eventTypeDefinition(input.event.eventType);
  const relation = HUMAN_EVENT_RELATIONS[input.event.eventType] ?? 'CONTRIBUTED';
  const actorNode = buildActorNode(input.event.pseudonymousId, input.createdAt);
  const contributionNode = buildContributionNode(input.event, input.createdAt);
  const actorToContributionEdge = edge(relation, actorNode.nodeId, contributionNode.nodeId, provenanceRef, input.createdAt);

  const evidenceEdges: KnowledgeEdge[] = [];
  for (const evidenceRef of input.event.evidenceRefs) {
    const evidenceNode = buildRefNode('EVIDENCE', evidenceRef, 'evidence', input.createdAt);
    evidenceEdges.push(edge('SUPPORTED_BY', contributionNode.nodeId, evidenceNode.nodeId, provenanceRef, input.createdAt));
  }

  const attestationEdges: KnowledgeEdge[] = [];
  for (const attestationRef of input.event.attestationRefs) {
    const attestationNode = buildRefNode('VERIFIED_FACT', attestationRef, 'attestation', input.createdAt);
    attestationEdges.push(edge('ATTESTED_BY', contributionNode.nodeId, attestationNode.nodeId, provenanceRef, input.createdAt));
  }

  let methodologyEdge: KnowledgeEdge | null = null;
  if (eventDef) {
    const methodologyNode = buildRefNode('METHODOLOGY', input.event.methodologyId, 'methodology', input.createdAt);
    methodologyEdge = edge('USES_METHODOLOGY', contributionNode.nodeId, methodologyNode.nodeId, provenanceRef, input.createdAt);
  }

  const consentEdges: KnowledgeEdge[] = [];
  for (const consentRef of input.event.consentRefs) {
    const consentNode = buildRefNode('RIGHTS_GRANT', consentRef, 'consent', input.createdAt);
    consentEdges.push(edge('GRANTED', actorNode.nodeId, consentNode.nodeId, provenanceRef, input.createdAt));
    for (const purposeRef of input.event.purposeRefs) {
      const purposeNode = buildRefNode('RIGHTS_GRANT', purposeRef, 'purpose', input.createdAt);
      consentEdges.push(edge('FOR_PURPOSE', consentNode.nodeId, purposeNode.nodeId, provenanceRef, input.createdAt));
    }
  }

  const purposeEdges: KnowledgeEdge[] = [];
  for (const purposeRef of input.event.purposeRefs) {
    const purposeNode = buildRefNode('RIGHTS_GRANT', purposeRef, 'purpose-direct', input.createdAt);
    purposeEdges.push(edge('FOR_PURPOSE', contributionNode.nodeId, purposeNode.nodeId, provenanceRef, input.createdAt));
  }

  let claimEdge: KnowledgeEdge | null = null;
  if (input.claimId) {
    const claimNode = buildRefNode('ECONOMIC_CLAIM', input.claimId, 'claim', input.createdAt);
    claimEdge = edge('RESOLVES_TO', contributionNode.nodeId, claimNode.nodeId, provenanceRef, input.createdAt);
  }

  return Object.freeze({
    actorNode,
    contributionNode,
    actorToContributionEdge,
    evidenceEdges: Object.freeze(evidenceEdges),
    attestationEdges: Object.freeze(attestationEdges),
    methodologyEdge,
    consentEdges: Object.freeze(consentEdges),
    purposeEdges: Object.freeze(purposeEdges),
    claimEdge,
  });
}
