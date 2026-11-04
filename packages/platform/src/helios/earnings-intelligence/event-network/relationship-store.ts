/**
 * Evidence-backed earnings peer relationships anchored on temporal entity graph security nodes.
 */

import { createHash } from 'node:crypto';

import type { UtcInstant } from '@solstice/domain';
import type { TemporalEntityGraphStore } from '../../feature-fabric/entity-resolution/graph-store.ts';
import {
  EARNINGS_PEER_RELATIONSHIP_TYPES,
  EVIDENCE_REQUIRED_PEER_RELATIONSHIPS,
  type EarningsPeerRelationshipType,
} from './taxonomy.ts';
import type { EarningsPeerRelationshipEdge, EarningsRelationshipEvidence } from './types.ts';

export type RegisterEarningsPeerRelationshipInput = EarningsRelationshipEvidence & {
  readonly relationshipType: EarningsPeerRelationshipType;
  readonly fromSecurityNodeId: string;
  readonly toSecurityNodeId: string;
};

export type EarningsEventNetworkStore = {
  readonly registerRelationship: (
    graph: TemporalEntityGraphStore,
    input: RegisterEarningsPeerRelationshipInput,
  ) => { readonly ok: true; readonly edge: EarningsPeerRelationshipEdge } | { readonly ok: false; readonly message: string };
  readonly listRelationships: () => readonly EarningsPeerRelationshipEdge[];
  readonly peersLinkedTo: (
    securityNodeId: string,
    options: { readonly asOf: UtcInstant; readonly knowableCutoff: UtcInstant },
  ) => readonly EarningsPeerRelationshipEdge[];
  readonly snapshotRelationships: () => readonly EarningsPeerRelationshipEdge[];
};

function edgeIdFor(input: RegisterEarningsPeerRelationshipInput): string {
  const material = `${input.relationshipType}:${input.fromSecurityNodeId}:${input.toSecurityNodeId}:${input.effectiveFrom}:${input.knowableAt}`;
  return createHash('sha256').update(material).digest('hex').slice(0, 32);
}

function isRelationshipActive(edge: EarningsPeerRelationshipEdge, asOf: UtcInstant): boolean {
  if (edge.effectiveFrom > asOf) return false;
  if (edge.effectiveTo !== null && edge.effectiveTo <= asOf) return false;
  return true;
}

function isKnowable(edge: EarningsPeerRelationshipEdge, knowableCutoff: UtcInstant): boolean {
  return edge.knowableAt <= knowableCutoff;
}

export function assertEarningsRelationshipEvidence(
  input: RegisterEarningsPeerRelationshipInput,
): { readonly ok: true } | { readonly ok: false; readonly message: string } {
  if (!EARNINGS_PEER_RELATIONSHIP_TYPES.includes(input.relationshipType)) {
    return { ok: false, message: `unknown relationship type: ${input.relationshipType}` };
  }
  if (
    (EVIDENCE_REQUIRED_PEER_RELATIONSHIPS as readonly string[]).includes(input.relationshipType) &&
    input.evidenceRefs.length === 0
  ) {
    return {
      ok: false,
      message: `${input.relationshipType} requires explicit evidenceRefs; inference without evidence is rejected`,
    };
  }
  if (input.fromSecurityNodeId === input.toSecurityNodeId) {
    return { ok: false, message: 'self-relationship rejected' };
  }
  return { ok: true };
}

export function createEarningsEventNetworkStore(): EarningsEventNetworkStore {
  const edges: EarningsPeerRelationshipEdge[] = [];

  return Object.freeze({
    registerRelationship(graph, input) {
      const evidenceCheck = assertEarningsRelationshipEvidence(input);
      if (!evidenceCheck.ok) {
        return { ok: false, message: evidenceCheck.message };
      }
      const fromNode = graph.getNode(input.fromSecurityNodeId);
      const toNode = graph.getNode(input.toSecurityNodeId);
      if (!fromNode || fromNode.kind !== 'SECURITY') {
        return { ok: false, message: 'fromSecurityNodeId must reference an existing SECURITY node' };
      }
      if (!toNode || toNode.kind !== 'SECURITY') {
        return { ok: false, message: 'toSecurityNodeId must reference an existing SECURITY node' };
      }

      const edge: EarningsPeerRelationshipEdge = Object.freeze({
        edgeId: edgeIdFor(input),
        relationshipType: input.relationshipType,
        fromSecurityNodeId: input.fromSecurityNodeId,
        toSecurityNodeId: input.toSecurityNodeId,
        evidenceRefs: Object.freeze([...input.evidenceRefs]),
        source: input.source,
        effectiveFrom: input.effectiveFrom,
        effectiveTo: input.effectiveTo,
        observedAt: input.observedAt,
        knowableAt: input.knowableAt,
        jurisdiction: input.jurisdiction,
        grantsExecutionAuthority: false,
      });
      edges.push(edge);
      return { ok: true, edge };
    },
    listRelationships() {
      return Object.freeze([...edges]);
    },
    peersLinkedTo(securityNodeId, options) {
      return Object.freeze(
        edges.filter(
          (edge) =>
            (edge.fromSecurityNodeId === securityNodeId || edge.toSecurityNodeId === securityNodeId) &&
            isRelationshipActive(edge, options.asOf) &&
            isKnowable(edge, options.knowableCutoff),
        ),
      );
    },
    snapshotRelationships() {
      return Object.freeze([...edges]);
    },
  });
}
