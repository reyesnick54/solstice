/**
 * Project external earnings observations into AAF V2 temporal entity graph nodes/edges.
 */

import type { EarningsExternalObservation } from '@solstice/external-data';
import type { EarningsGraphEdge, EarningsGraphNode } from './types.ts';

function nodeIdFor(observation: EarningsExternalObservation): string {
  return `node:${observation.observationId}`;
}

function artifactToNodeKind(artifactKind: EarningsExternalObservation['artifactKind']): EarningsGraphNode['kind'] {
  switch (artifactKind) {
    case 'EXPECTED_EVENT':
      return 'EXPECTED_EARNINGS_EVENT';
    case 'CONFIRMED_ANNOUNCEMENT':
      return 'CONFIRMED_ANNOUNCEMENT';
    case 'EARNINGS_RELEASE':
      return 'EARNINGS_RELEASE';
    case 'SEC_8K_2_02':
    case 'SEC_8K_7_01':
    case 'SEC_EX99':
    case 'SEC_10Q':
    case 'SEC_10K':
    case 'SEC_6K':
      return 'SEC_FILING';
    case 'FINANCIAL_SUPPLEMENT':
      return 'FINANCIAL_SUPPLEMENT';
    case 'CONFERENCE_CALL':
      return 'CONFERENCE_CALL';
    case 'GUIDANCE':
      return 'GUIDANCE';
    case 'ANALYST_REVISION':
      return 'ANALYST_REVISION';
    case 'MARKET_REACTION':
      return 'MARKET_REACTION';
    default:
      return 'EARNINGS_RELEASE';
  }
}

export function projectObservationToGraph(
  observation: EarningsExternalObservation,
): { readonly nodes: readonly EarningsGraphNode[]; readonly edges: readonly EarningsGraphEdge[] } {
  const companyNodeId = `company:${observation.canonicalEntityId}`;
  const fiscalNodeId = `fiscal:${observation.earningsEventKey}`;
  const artifactNodeId = nodeIdFor(observation);

  const companyNode: EarningsGraphNode = Object.freeze({
    nodeId: companyNodeId,
    kind: 'COMPANY',
    earningsEventKey: observation.earningsEventKey,
    canonicalEntityId: observation.canonicalEntityId,
    fiscal: null,
    observationId: null,
    knowableAt: observation.times.knowableAt,
    payload: Object.freeze({}),
    grantsExecutionAuthority: false,
  });

  const fiscalNode: EarningsGraphNode = Object.freeze({
    nodeId: fiscalNodeId,
    kind: 'FISCAL_PERIOD',
    earningsEventKey: observation.earningsEventKey,
    canonicalEntityId: observation.canonicalEntityId,
    fiscal: observation.fiscal,
    observationId: null,
    knowableAt: observation.times.knowableAt,
    payload: Object.freeze({ fiscalPeriodLabel: observation.fiscal.fiscalPeriodLabel }),
    grantsExecutionAuthority: false,
  });

  const artifactNode: EarningsGraphNode = Object.freeze({
    nodeId: artifactNodeId,
    kind: artifactToNodeKind(observation.artifactKind),
    earningsEventKey: observation.earningsEventKey,
    canonicalEntityId: observation.canonicalEntityId,
    fiscal: observation.fiscal,
    observationId: observation.observationId,
    knowableAt: observation.times.knowableAt,
    payload: observation.payload,
    grantsExecutionAuthority: false,
  });

  const edges: EarningsGraphEdge[] = [
    Object.freeze({
      edgeId: `${artifactNodeId}:FOR_COMPANY`,
      kind: 'FOR_COMPANY',
      fromNodeId: artifactNodeId,
      toNodeId: companyNodeId,
      knowableAt: observation.times.knowableAt,
      lineageRootId: observation.lineageRootId,
    }),
    Object.freeze({
      edgeId: `${artifactNodeId}:FOR_FISCAL_PERIOD`,
      kind: 'FOR_FISCAL_PERIOD',
      fromNodeId: artifactNodeId,
      toNodeId: fiscalNodeId,
      knowableAt: observation.times.knowableAt,
      lineageRootId: observation.lineageRootId,
    }),
  ];

  if (observation.supersedesObservationId) {
    edges.push(
      Object.freeze({
        edgeId: `${artifactNodeId}:AMENDS`,
        kind: 'AMENDS',
        fromNodeId: artifactNodeId,
        toNodeId: `node:${observation.supersedesObservationId}`,
        knowableAt: observation.times.knowableAt,
        lineageRootId: observation.lineageRootId,
      }),
    );
  }

  if (observation.rescheduledFromEventKey) {
    edges.push(
      Object.freeze({
        edgeId: `${artifactNodeId}:RESCHEDULED_FROM`,
        kind: 'RESCHEDULED_FROM',
        fromNodeId: artifactNodeId,
        toNodeId: `fiscal:${observation.rescheduledFromEventKey}`,
        knowableAt: observation.times.knowableAt,
        lineageRootId: observation.lineageRootId,
      }),
    );
  }

  return Object.freeze({
    nodes: Object.freeze([companyNode, fiscalNode, artifactNode]),
    edges: Object.freeze(edges),
  });
}
