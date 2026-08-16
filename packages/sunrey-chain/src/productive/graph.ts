import { sha256Hex } from '../../../security/src/hash.ts';
import type { ProductiveClaim } from './claims.ts';
import type { MoonReyIssuanceReceipt } from './issuance.ts';
import type { ProductiveEconomicObject } from './objects.ts';
import type { OracleFact } from './oracle.ts';
import {
  claimNodeKind,
  HASH_DOMAIN_PRODUCTIVE,
  type GraphEdgeKind,
  type GraphNodeKind,
} from './types.ts';
import type { VerifiedProductiveContribution } from './verification.ts';

export type GraphNode = {
  readonly id: string;
  readonly kind: GraphNodeKind;
  readonly label: string;
};

export type GraphEdge = {
  readonly from: string;
  readonly to: string;
  readonly kind: GraphEdgeKind;
};

export type ProductiveCapacityGraph = {
  readonly nodes: readonly GraphNode[];
  readonly edges: readonly GraphEdge[];
  readonly projectionHash: string;
};

export type GraphSources = {
  readonly objects: readonly ProductiveEconomicObject[];
  readonly claims: readonly ProductiveClaim[];
  readonly facts: readonly OracleFact[];
  readonly contributions: readonly VerifiedProductiveContribution[];
  readonly receipts: readonly MoonReyIssuanceReceipt[];
};

/**
 * Derived index. Rebuildable from finalized blockchain facts.
 * Deleting this projection does not change authoritative state.
 */
export function buildProductiveCapacityGraph(sources: GraphSources): ProductiveCapacityGraph {
  const nodes = new Map<string, GraphNode>();
  const edges: GraphEdge[] = [];

  const addNode = (id: string, kind: GraphNodeKind, label: string): void => {
    if (!nodes.has(id)) {
      nodes.set(id, Object.freeze({ id, kind, label }));
    }
  };
  const addEdge = (from: string, to: string, kind: GraphEdgeKind): void => {
    edges.push(Object.freeze({ from, to, kind }));
  };

  for (const object of sources.objects) {
    addNode(object.objectId, 'PRODUCTIVE_OBJECT', object.category);
    addNode(`owner:${object.owner}`, 'OWNER', object.owner);
    addNode(`controller:${object.controller}`, 'CONTROLLER', object.controller);
    addNode(`location:${object.geography.geographyId}`, 'LOCATION', object.geography.jurisdiction);
    addNode(`resource:${object.category}`, 'RESOURCE_CLASS', object.category);
    addEdge(`owner:${object.owner}`, object.objectId, 'OWNS');
    addEdge(`controller:${object.controller}`, object.objectId, 'CONTROLS');
    addEdge(`controller:${object.operator}`, object.objectId, 'OPERATES');
    addEdge(object.objectId, `location:${object.geography.geographyId}`, 'LOCATED_IN');
    addEdge(object.objectId, `resource:${object.category}`, 'USES_RESOURCE');
  }

  for (const claim of sources.claims) {
    const nodeId = `claim:${claim.claimId}`;
    addNode(nodeId, claimNodeKind(claim.claimType), claim.claimType);
    addEdge(claim.objectId, nodeId, claim.claimType === 'CAPACITY' ? 'HAS_CAPACITY' : 'PRODUCES');
    if (claim.claimType === 'DELIVERY') {
      addEdge(nodeId, claim.objectId, 'DELIVERS');
    }
  }

  for (const fact of sources.facts) {
    addNode(`fact:${fact.factId}`, 'ORACLE_FACT', fact.sourceId);
    addEdge(`claim-object:${fact.objectId}`, `fact:${fact.factId}`, 'VERIFIED_BY');
  }

  for (const contribution of sources.contributions) {
    addNode(contribution.contributionId, 'VERIFIED_CONTRIBUTION', contribution.claimType);
    addEdge(contribution.contributionId, contribution.objectId, 'DERIVED_FROM');
    for (const factId of contribution.oracleFactIds) {
      addEdge(contribution.contributionId, `fact:${factId}`, 'VERIFIED_BY');
    }
    for (const upstream of contribution.upstreamContributionIds) {
      addEdge(contribution.contributionId, upstream, 'DEPENDS_ON');
    }
    for (const downstream of contribution.downstreamContributionIds) {
      addEdge(contribution.contributionId, downstream, 'SUPPLIES');
    }
  }

  const sortedNodes = [...nodes.values()].sort((left, right) => left.id.localeCompare(right.id));
  const sortedEdges = [...edges].sort((left, right) =>
    `${left.kind}:${left.from}:${left.to}`.localeCompare(`${right.kind}:${right.from}:${right.to}`),
  );
  const projectionHash = sha256Hex(
    [
      HASH_DOMAIN_PRODUCTIVE,
      'graph',
      ...sortedNodes.map((node) => `${node.kind}:${node.id}:${node.label}`),
      ...sortedEdges.map((edge) => `${edge.kind}:${edge.from}:${edge.to}`),
      ...sources.receipts.map((receipt) => receipt.issuanceId).sort(),
    ].join('|'),
  );
  return Object.freeze({
    nodes: Object.freeze(sortedNodes),
    edges: Object.freeze(sortedEdges),
    projectionHash,
  });
}
