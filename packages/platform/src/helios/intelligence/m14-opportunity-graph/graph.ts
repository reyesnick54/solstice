/**
 * HELIOS Multi-Asset M14 — cross-asset opportunity graph.
 *
 * Non-authoritative intelligence layer for correlation and exposure warnings.
 */

import type {
  CorrelationWarning,
  CrossAssetOpportunityGraph,
  GraphBuildInput,
  OpportunityGraphEdge,
  OpportunityGraphNode,
} from './types.ts';
import { HELIOS_M14_OPPORTUNITY_GRAPH_VERSION } from './types.ts';

function nodeIdFor(kind: string, key: string): string {
  return `ogn_${kind}_${key}`;
}

function edgeId(source: string, target: string, kind: string): string {
  return `oge_${kind}_${source}_${target}`;
}

export function buildCrossAssetOpportunityGraph(input: GraphBuildInput): CrossAssetOpportunityGraph {
  const nodes: OpportunityGraphNode[] = [];
  const edges: OpportunityGraphEdge[] = [];
  const seenNodes = new Set<string>();

  function addNode(node: OpportunityGraphNode): void {
    if (seenNodes.has(node.nodeId)) return;
    seenNodes.add(node.nodeId);
    nodes.push(node);
  }

  for (const candidate of input.candidates) {
    addNode(
      Object.freeze({
        nodeId: nodeIdFor('candidate', candidate.candidateId),
        kind: 'CANDIDATE',
        instrumentId: candidate.instrumentId,
        strategyFamily: candidate.strategyFamily,
        candidateId: candidate.candidateId,
        assetClass: candidate.assetClass,
        sector: candidate.sector,
      }),
    );
    addNode(
      Object.freeze({
        nodeId: nodeIdFor('instrument', candidate.instrumentId),
        kind: 'INSTRUMENT',
        instrumentId: candidate.instrumentId,
        strategyFamily: null,
        candidateId: null,
        assetClass: candidate.assetClass,
        sector: candidate.sector,
      }),
    );
    edges.push(
      Object.freeze({
        edgeId: edgeId(nodeIdFor('candidate', candidate.candidateId), nodeIdFor('instrument', candidate.instrumentId), 'holds'),
        kind: 'SAME_ASSET_CLASS',
        sourceNodeId: nodeIdFor('candidate', candidate.candidateId),
        targetNodeId: nodeIdFor('instrument', candidate.instrumentId),
        weightBps: 10_000,
        evidenceRef: null,
      }),
    );
  }

  const instrumentIds = [...new Set(input.candidates.map((c) => c.instrumentId))];
  for (let i = 0; i < instrumentIds.length; i += 1) {
    for (let j = i + 1; j < instrumentIds.length; j += 1) {
      const left = instrumentIds[i]!;
      const right = instrumentIds[j]!;
      const correlationBps = input.correlationMatrix[left]?.[right] ?? 0;
      if (Math.abs(correlationBps) >= 5000) {
        edges.push(
          Object.freeze({
            edgeId: edgeId(nodeIdFor('instrument', left), nodeIdFor('instrument', right), 'corr'),
            kind: 'CORRELATION',
            sourceNodeId: nodeIdFor('instrument', left),
            targetNodeId: nodeIdFor('instrument', right),
            weightBps: Math.abs(correlationBps),
            evidenceRef: `corr:${left}:${right}`,
          }),
        );
      }
    }
  }

  for (const candidate of input.candidates) {
    for (const held of input.portfolioInstrumentIds) {
      const correlationBps = input.correlationMatrix[candidate.instrumentId]?.[held] ?? 0;
      if (Math.abs(correlationBps) >= 7000) {
        edges.push(
          Object.freeze({
            edgeId: edgeId(nodeIdFor('candidate', candidate.candidateId), nodeIdFor('instrument', held), 'port'),
            kind: 'CORRELATION',
            sourceNodeId: nodeIdFor('candidate', candidate.candidateId),
            targetNodeId: nodeIdFor('instrument', held),
            weightBps: Math.abs(correlationBps),
            evidenceRef: `portfolio_corr:${candidate.instrumentId}:${held}`,
          }),
        );
      }
    }
  }

  nodes.sort((a, b) => a.nodeId.localeCompare(b.nodeId));
  edges.sort((a, b) => a.edgeId.localeCompare(b.edgeId));

  return Object.freeze({
    graphId: input.graphId,
    version: HELIOS_M14_OPPORTUNITY_GRAPH_VERSION,
    nodes: Object.freeze(nodes),
    edges: Object.freeze(edges),
    builtAt: input.now,
  });
}

export function deriveCorrelationWarnings(
  graph: CrossAssetOpportunityGraph,
  candidateId: string,
  thresholdBps = 7000,
): readonly CorrelationWarning[] {
  const candidateNodeId = nodeIdFor('candidate', candidateId);
  const correlatedWith: string[] = [];
  let maxCorrelationBps = 0;
  for (const edge of graph.edges) {
    if (edge.kind !== 'CORRELATION') continue;
    if (edge.sourceNodeId !== candidateNodeId && edge.targetNodeId !== candidateNodeId) continue;
    if (edge.weightBps < thresholdBps) continue;
    const otherNodeId = edge.sourceNodeId === candidateNodeId ? edge.targetNodeId : edge.sourceNodeId;
    const other = graph.nodes.find((n) => n.nodeId === otherNodeId);
    if (other?.instrumentId) {
      correlatedWith.push(other.instrumentId);
      maxCorrelationBps = Math.max(maxCorrelationBps, edge.weightBps);
    }
  }
  if (correlatedWith.length === 0) return Object.freeze([]);
  correlatedWith.sort();
  return Object.freeze([
    Object.freeze({
      candidateId,
      correlatedWith: Object.freeze(correlatedWith),
      maxCorrelationBps,
      reason: `correlation exceeds ${thresholdBps} bps with existing exposure`,
    }),
  ]);
}
