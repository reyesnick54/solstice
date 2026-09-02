import type { GraphRepositoryPort } from './repository/adjacency.ts';
import type { KnowledgeNodeId } from './ids.ts';
import type { KnowledgeNode, KnowledgeEdge } from './types.ts';

export type GraphQueryResult = {
  readonly nodes: readonly KnowledgeNode[];
  readonly edges: readonly KnowledgeEdge[];
};

function collectResult(repo: GraphRepositoryPort, nodeIds: readonly KnowledgeNodeId[]): GraphQueryResult {
  const nodes = nodeIds
    .map((id) => repo.getNode(id))
    .filter((node): node is KnowledgeNode => node !== null)
    .sort((a, b) => a.nodeId.localeCompare(b.nodeId));
  const nodeSet = new Set(nodes.map((n) => n.nodeId));
  const edges = repo
    .edges()
    .filter((edge) => nodeSet.has(edge.fromNodeId) || nodeSet.has(edge.toNodeId))
    .sort((a, b) => a.edgeId.localeCompare(b.edgeId));
  return Object.freeze({ nodes: Object.freeze(nodes), edges: Object.freeze(edges) });
}

/** All observations linked to canonical economic event X. */
export function observationsOfEvent(repo: GraphRepositoryPort, eventNodeId: KnowledgeNodeId): GraphQueryResult {
  const observations = repo.reverseNeighbors(eventNodeId, 'OBSERVED_BY');
  return collectResult(repo, observations.map((n) => n.nodeId));
}

/** All providers supporting claim Y (via observations and attestations). */
export function providersSupportingClaim(repo: GraphRepositoryPort, claimNodeId: KnowledgeNodeId): GraphQueryResult {
  const evidence = repo.neighbors(claimNodeId, 'SUPPORTED_BY');
  const claimEdges = repo.edgesFrom(claimNodeId, 'LINKS_CLAIM');
  const eventIds = claimEdges.map((e) => e.toNodeId);
  const observationIds = eventIds.flatMap((eventId) =>
    repo.reverseNeighbors(eventId, 'OBSERVED_BY').map((n) => n.nodeId),
  );
  const providerIds = observationIds.flatMap((obsId) => repo.neighbors(obsId, 'ATTESTED_BY').map((n) => n.nodeId));
  const allIds = [...evidence.map((n) => n.nodeId), ...providerIds];
  return collectResult(repo, allIds);
}

/** All economic events associated with productive asset Z. */
export function eventsForProductiveAsset(repo: GraphRepositoryPort, assetNodeId: KnowledgeNodeId): GraphQueryResult {
  const relations = ['GENERATES', 'PRODUCED', 'EXECUTES', 'HANDLES', 'PRODUCES', 'CONSUMES'] as const;
  const eventIds = relations.flatMap((kind) => repo.neighbors(assetNodeId, kind).map((n) => n.nodeId));
  return collectResult(repo, eventIds);
}

/** Evidence supporting pseudonymous contribution Q. */
export function evidenceForPseudonymousContribution(
  repo: GraphRepositoryPort,
  contributionNodeId: KnowledgeNodeId,
): GraphQueryResult {
  const claimEdges = repo.reverseNeighbors(contributionNodeId, 'LINKS_CLAIM');
  const claimIds = claimEdges.map((n) => n.nodeId);
  const evidenceIds = claimIds.flatMap((claimId) => repo.reverseNeighbors(claimId, 'SUPPORTED_BY').map((n) => n.nodeId));
  return collectResult(repo, evidenceIds);
}

/** Derived sources behind provider dataset N (DERIVED_FROM traversal). */
export function derivedSourcesBehindDataset(repo: GraphRepositoryPort, datasetNodeId: KnowledgeNodeId): GraphQueryResult {
  const visited = new Set<KnowledgeNodeId>();
  const queue: KnowledgeNodeId[] = [datasetNodeId];
  while (queue.length > 0) {
    const current = queue.shift()!;
    if (visited.has(current)) {
      continue;
    }
    visited.add(current);
    const parents = repo.neighbors(current, 'DERIVED_FROM');
    for (const parent of parents) {
      queue.push(parent.nodeId);
    }
  }
  return collectResult(repo, [...visited]);
}
