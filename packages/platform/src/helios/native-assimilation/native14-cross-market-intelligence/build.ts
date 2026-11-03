import type { UtcInstant } from '@solstice/domain';
import {
  HELIOS_NATIVE14_CROSS_MARKET_INTELLIGENCE_AUTHORITY,
  HELIOS_NATIVE14_CROSS_MARKET_INTELLIGENCE_SCHEMA,
  type CrossMarketGraphEdgeKind,
  type CrossMarketGraphNodeKind,
  type CrossMarketSignalDomain,
} from './taxonomy.ts';
import type {
  CrossMarketEvidenceGraph,
  CrossMarketEvidenceGraphEdge,
  CrossMarketEvidenceGraphNode,
  CrossMarketSignalObservation,
} from './types.ts';

function nodeKindForDomain(domain: CrossMarketSignalDomain): CrossMarketGraphNodeKind {
  if (domain === 'PREDICTION_MARKET') return 'PREDICTION_OUTCOME';
  if (domain === 'MACRO' || domain === 'FUNDAMENTALS') return 'MACRO_METRIC';
  if (domain === 'SENTIMENT' || domain === 'NEWS') return 'SENTIMENT_INDEX';
  if (domain === 'AGENT_RESEARCH') return 'RESEARCH_ARTIFACT';
  return 'INSTRUMENT';
}

function nodeIdFor(obs: CrossMarketSignalObservation): string {
  return `cm_node_${obs.domain}_${obs.entityId}`.replace(/[^a-zA-Z0-9:_-]/g, '_');
}

function edgeKindFor(
  source: CrossMarketSignalObservation,
  target: CrossMarketSignalObservation,
): CrossMarketGraphEdgeKind {
  if (source.domain === 'PREDICTION_MARKET' || target.domain === 'PREDICTION_MARKET') {
    return 'IMPLIED_PROBABILITY_LINK';
  }
  if (source.domain === 'CRYPTO' && target.domain === 'CRYPTO') return 'VENUE_ARBITRAGE';
  if (source.domain === 'MACRO' || target.domain === 'MACRO') return 'MACRO_TRANSMISSION';
  if (source.domain === 'SENTIMENT' || target.domain === 'SENTIMENT') return 'SENTIMENT_ALIGNMENT';
  if (source.domain === 'AGENT_RESEARCH' || target.domain === 'AGENT_RESEARCH') {
    return 'AGENT_CORROBORATION';
  }
  if (source.metricId.includes('funding') || target.metricId.includes('funding')) {
    return 'FUNDING_LINK';
  }
  return 'CO_MOVEMENT';
}

function signAligned(a: number, b: number): boolean {
  if (a === 0 || b === 0) return false;
  return Math.sign(a) === Math.sign(b);
}

export function buildCrossMarketEvidenceGraph(input: {
  readonly graphId: string;
  readonly observations: readonly CrossMarketSignalObservation[];
  readonly now: UtcInstant;
}): CrossMarketEvidenceGraph {
  const nodeById = new Map<string, CrossMarketEvidenceGraphNode>();
  for (const obs of input.observations) {
    const nodeId = nodeIdFor(obs);
    const existing = nodeById.get(nodeId);
    const evidenceRefs = existing
      ? Object.freeze([...existing.evidenceRefs, obs.evidenceRef])
      : Object.freeze([obs.evidenceRef]);
    nodeById.set(
      nodeId,
      Object.freeze({
        nodeId,
        kind: nodeKindForDomain(obs.domain),
        domain: obs.domain,
        entityId: obs.entityId,
        label: obs.entityLabel,
        evidenceRefs,
      }),
    );
  }

  const edges: CrossMarketEvidenceGraphEdge[] = [];
  const obsList = [...input.observations];
  for (let i = 0; i < obsList.length; i++) {
    for (let j = i + 1; j < obsList.length; j++) {
      const a = obsList[i]!;
      const b = obsList[j]!;
      if (a.domain === b.domain && a.entityId === b.entityId) continue;
      const aligned = signAligned(a.moveBps, b.moveBps);
      const weightBps = aligned
        ? Math.min(Math.abs(a.moveBps), Math.abs(b.moveBps))
        : -Math.min(Math.abs(a.moveBps), Math.abs(b.moveBps));
      if (weightBps === 0) continue;
      const sourceNodeId = nodeIdFor(a);
      const targetNodeId = nodeIdFor(b);
      const kind = edgeKindFor(a, b);
      edges.push(
        Object.freeze({
          edgeId: `cm_edge_${sourceNodeId}_${targetNodeId}_${kind}`,
          kind,
          sourceNodeId,
          targetNodeId,
          weightBps,
          evidenceRefs: Object.freeze([a.evidenceRef, b.evidenceRef]),
        }),
      );
    }
  }

  return Object.freeze({
    schema: HELIOS_NATIVE14_CROSS_MARKET_INTELLIGENCE_SCHEMA,
    authority: HELIOS_NATIVE14_CROSS_MARKET_INTELLIGENCE_AUTHORITY,
    graphId: input.graphId,
    nodes: Object.freeze([...nodeById.values()]),
    edges: Object.freeze(edges),
    builtAt: input.now,
  });
}
