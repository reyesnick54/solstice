/**
 * HELIOS M15 opportunity research graph queries.
 *
 * Read-only research traversal. No execution authority.
 */

import type { CrossAssetGraphNodeClass } from './taxonomy.ts';
import { nodeIdForInstrument, nodeIdForStrategyCandidate } from './ids.ts';
import type { InMemoryCrossAssetGraphStore } from './store.ts';
import type {
  CrossAssetGraphNode,
  CrossAssetRelationshipEdge,
  OpportunityGraphQueryHit,
  OpportunityGraphQueryInput,
  OpportunityGraphQueryResult,
} from './types.ts';

const CORRELATED_TYPES = new Set(['correlated_with', 'inversely_correlated_with', 'exposed_to']);
const HEDGE_TYPES = new Set(['hedge_candidate_for', 'inversely_correlated_with']);
const MACRO_NODE_CLASSES = new Set<CrossAssetGraphNodeClass>(['macro_variable', 'event', 'market_regime']);

function instrumentIdFromNode(node: CrossAssetGraphNode): string | null {
  if (node.nodeClass !== 'instrument') {
    return null;
  }
  return node.externalRef;
}

function scoreEdge(edge: CrossAssetRelationshipEdge): number {
  const confidenceWeight =
    edge.confidence === 'HIGH' ? 1 : edge.confidence === 'MEDIUM' ? 0.7 : edge.confidence === 'LOW' ? 0.4 : 0.1;
  const strengthWeight = edge.strength === null ? 0.5 : Math.min(1, Math.abs(edge.strength));
  const classWeight = edge.relationshipClass === 'MEASURED' ? 1 : edge.relationshipClass === 'STRUCTURAL' ? 0.8 : 0.3;
  const validityWeight =
    edge.validityState === 'ACTIVE'
      ? 1
      : edge.validityState === 'DEGRADED'
        ? 0.5
        : edge.validityState === 'HYPOTHESIS_ONLY'
          ? 0.35
          : 0;
  return confidenceWeight * strengthWeight * classWeight * validityWeight;
}

function relatedNodeForEdge(
  store: InMemoryCrossAssetGraphStore,
  anchorNodeId: string,
  edge: CrossAssetRelationshipEdge,
): CrossAssetGraphNode | null {
  const otherNodeId = edge.fromNodeId === anchorNodeId ? edge.toNodeId : edge.fromNodeId;
  return store.getNode(otherNodeId);
}

function edgesTouching(store: InMemoryCrossAssetGraphStore, anchorNodeId: string, input: OpportunityGraphQueryInput): CrossAssetRelationshipEdge[] {
  return [...store.edges({ customerId: input.customerId, asOf: input.asOf })].filter((edge) => {
    if (edge.fromNodeId !== anchorNodeId && edge.toNodeId !== anchorNodeId) {
      return false;
    }
    if (!input.includeHypotheses && edge.relationshipClass === 'HYPOTHESIS') {
      return false;
    }
    if (!input.includeDegraded && edge.validityState === 'DEGRADED') {
      return false;
    }
    if (edge.validityState === 'EXPIRED' || edge.validityState === 'SUPERSEDED') {
      return false;
    }
    return true;
  });
}

function findContradictions(edges: readonly CrossAssetRelationshipEdge[]): OpportunityGraphQueryResult['contradictoryPairs'] {
  const pairs: OpportunityGraphQueryResult['contradictoryPairs'][number][] = [];
  for (let i = 0; i < edges.length; i += 1) {
    for (let j = i + 1; j < edges.length; j += 1) {
      const left = edges[i];
      const right = edges[j];
      if (!left || !right) {
        continue;
      }
      const sameEndpoints =
        (left.fromNodeId === right.fromNodeId && left.toNodeId === right.toNodeId) ||
        (left.fromNodeId === right.toNodeId && left.toNodeId === right.fromNodeId);
      if (!sameEndpoints) {
        continue;
      }
      const inversePair =
        (left.relationshipType === 'correlated_with' && right.relationshipType === 'inversely_correlated_with') ||
        (left.relationshipType === 'inversely_correlated_with' && right.relationshipType === 'correlated_with');
      if (!inversePair) {
        continue;
      }
      const hypothesisMeasured =
        (left.relationshipClass === 'HYPOTHESIS' && right.relationshipClass === 'MEASURED') ||
        (left.relationshipClass === 'MEASURED' && right.relationshipClass === 'HYPOTHESIS');
      pairs.push(
        Object.freeze({
          left,
          right,
          reason: hypothesisMeasured
            ? 'Hypothesis contradicts measured relationship'
            : 'Measured correlation sign contradiction',
        }),
      );
    }
  }
  return Object.freeze(pairs);
}

export function queryCrossAssetOpportunityGraph(
  store: InMemoryCrossAssetGraphStore,
  input: OpportunityGraphQueryInput,
): OpportunityGraphQueryResult {
  const anchorNode = store.getNode(input.anchorNodeId);
  const dataQualityNotes: string[] = [];
  if (!anchorNode) {
    return Object.freeze({
      queryKind: input.queryKind,
      anchorNodeId: input.anchorNodeId,
      hits: Object.freeze([]),
      contradictoryPairs: Object.freeze([]),
      dataQualityNotes: Object.freeze(['anchor node not found']),
    });
  }

  const touching = edgesTouching(store, input.anchorNodeId, input);
  const contradictoryPairs = findContradictions(touching);

  let filtered = touching;
  switch (input.queryKind) {
    case 'related_instruments':
      filtered = touching.filter((edge) => CORRELATED_TYPES.has(edge.relationshipType) || edge.relationshipClass === 'STRUCTURAL');
      break;
    case 'possible_hedges':
      filtered = touching.filter((edge) => HEDGE_TYPES.has(edge.relationshipType));
      break;
    case 'correlated_risks':
      filtered = touching.filter(
        (edge) =>
          edge.relationshipType === 'correlated_with' ||
          edge.relationshipType === 'exposed_to' ||
          edge.relationshipType === 'regime_linked_to',
      );
      break;
    case 'macro_context':
      filtered = touching.filter((edge) => {
        const related = relatedNodeForEdge(store, input.anchorNodeId, edge);
        return related !== null && MACRO_NODE_CLASSES.has(related.nodeClass);
      });
      break;
    case 'competing_opportunities':
      filtered = touching.filter((edge) => {
        const related = relatedNodeForEdge(store, input.anchorNodeId, edge);
        return related?.nodeClass === 'strategy_candidate';
      });
      break;
    case 'contradictory_signals':
      filtered = touching.filter((edge) => contradictoryPairs.some((pair) => pair.left.edgeId === edge.edgeId || pair.right.edgeId === edge.edgeId));
      break;
    default:
      break;
  }

  for (const edge of filtered) {
    if (edge.validityState === 'DEGRADED') {
      dataQualityNotes.push(`edge ${edge.edgeId} degraded due to upstream data quality`);
    }
  }

  const hits: OpportunityGraphQueryHit[] = filtered
    .map((edge) => {
      const relatedNode = relatedNodeForEdge(store, input.anchorNodeId, edge);
      if (!relatedNode) {
        return null;
      }
      return Object.freeze({
        edge,
        relatedNode,
        relevanceScore: scoreEdge(edge),
        lineage: Object.freeze([...edge.evidence]),
      });
    })
    .filter((row): row is OpportunityGraphQueryHit => row !== null)
    .sort((a, b) => b.relevanceScore - a.relevanceScore);

  return Object.freeze({
    queryKind: input.queryKind,
    anchorNodeId: input.anchorNodeId,
    hits: Object.freeze(hits),
    contradictoryPairs,
    dataQualityNotes: Object.freeze(dataQualityNotes),
  });
}

export function anchorNodeIdForInstrument(instrumentId: string): string {
  return nodeIdForInstrument(instrumentId);
}

export function anchorNodeIdForStrategyCandidate(candidateId: string): string {
  return nodeIdForStrategyCandidate(candidateId);
}

export function relatedInstrumentIdsFromHits(hits: readonly OpportunityGraphQueryHit[]): readonly string[] {
  const ids = hits
    .map((hit) => instrumentIdFromNode(hit.relatedNode))
    .filter((row): row is string => row !== null);
  return Object.freeze([...new Set(ids)]);
}
