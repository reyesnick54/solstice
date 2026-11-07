/**
 * Deterministic graph baselines for supply-chain risk (no ML promotion path).
 */

import type { UtcInstant } from '@solstice/domain';
import { DEFAULT_RISK_HOP_ATTENUATION_MILLI, RISK_UPSTREAM_EDGE_TYPES, type SupplyChainBaselineMethod } from './taxonomy.ts';
import type {
  BottleneckExposure,
  CriticalDependency,
  NetworkCentralityState,
  SupplyChainConcentration,
  SupplyChainEdge,
  SupplyChainNode,
} from './types.ts';

function milliHhi(sharesMilli: readonly number[]): number {
  return sharesMilli.reduce((acc, s) => acc + Math.floor((s * s) / 1000), 0);
}

export function computeSupplierConcentration(input: {
  readonly focalNodeId: string;
  readonly edges: readonly SupplyChainEdge[];
  readonly asOf: UtcInstant;
}): SupplyChainConcentration {
  const inbound = input.edges.filter(
    (e) => e.toNodeId === input.focalNodeId && (e.edgeType === 'SUPPLIES' || e.edgeType === 'DEPENDS_ON'),
  );
  const totalWeight = inbound.reduce((s, e) => s + e.edgeWeightMilli, 0) || 1;
  const shares = inbound.map((e) => Math.floor((e.edgeWeightMilli * 1000) / totalWeight));
  const sortedShares = [...shares].sort((a, b) => b - a);
  return Object.freeze({
    focalNodeId: input.focalNodeId,
    asOf: input.asOf,
    method: 'SUPPLIER_CONCENTRATION',
    hhiMilli: milliHhi(shares),
    topCounterpartyShareMilli: sortedShares[0] ?? 0,
    counterpartyCount: inbound.length,
    baselineMethod: 'SUPPLIER_CONCENTRATION',
    grantsExecutionAuthority: false,
  });
}

export function computeCustomerConcentration(input: {
  readonly focalNodeId: string;
  readonly edges: readonly SupplyChainEdge[];
  readonly asOf: UtcInstant;
}): SupplyChainConcentration {
  const outbound = input.edges.filter(
    (e) => e.fromNodeId === input.focalNodeId && (e.edgeType === 'CUSTOMER_OF' || e.edgeType === 'SUPPLIES'),
  );
  const totalWeight = outbound.reduce((s, e) => s + e.edgeWeightMilli, 0) || 1;
  const shares = outbound.map((e) => Math.floor((e.edgeWeightMilli * 1000) / totalWeight));
  const sortedShares = [...shares].sort((a, b) => b - a);
  return Object.freeze({
    focalNodeId: input.focalNodeId,
    asOf: input.asOf,
    method: 'CUSTOMER_CONCENTRATION',
    hhiMilli: milliHhi(shares),
    topCounterpartyShareMilli: sortedShares[0] ?? 0,
    counterpartyCount: outbound.length,
    baselineMethod: 'CUSTOMER_CONCENTRATION',
    grantsExecutionAuthority: false,
  });
}

export function computePagerankLikeScoresMilli(input: {
  readonly nodes: readonly SupplyChainNode[];
  readonly edges: readonly SupplyChainEdge[];
  readonly asOf: UtcInstant;
  readonly iterations?: number;
}): Readonly<Record<string, number>> {
  const iterations = input.iterations ?? 20;
  const ids = input.nodes.map((n) => n.nodeId);
  const outWeight = new Map<string, number>();
  const outEdges = new Map<string, { readonly to: string; readonly w: number }[]>();

  for (const id of ids) {
    outWeight.set(id, 0);
    outEdges.set(id, []);
  }
  for (const edge of input.edges) {
    const list = outEdges.get(edge.fromNodeId) ?? [];
    list.push({ to: edge.toNodeId, w: edge.edgeWeightMilli });
    outEdges.set(edge.fromNodeId, list);
    outWeight.set(edge.fromNodeId, (outWeight.get(edge.fromNodeId) ?? 0) + edge.edgeWeightMilli);
  }

  const scores = new Map<string, number>();
  const uniform = Math.floor(1000 / Math.max(1, ids.length));
  for (const id of ids) {
    scores.set(id, uniform);
  }

  for (let iter = 0; iter < iterations; iter += 1) {
    const next = new Map<string, number>();
    for (const id of ids) {
      next.set(id, Math.floor(100 / ids.length));
    }
    for (const edge of input.edges) {
      const sourceTotal = outWeight.get(edge.fromNodeId) ?? 1;
      const share = Math.floor(((scores.get(edge.fromNodeId) ?? 0) * edge.edgeWeightMilli) / sourceTotal);
      next.set(edge.toNodeId, (next.get(edge.toNodeId) ?? 0) + share);
    }
    for (const id of ids) {
      scores.set(id, next.get(id) ?? uniform);
    }
  }

  const result: Record<string, number> = {};
  for (const id of ids) {
    result[id] = scores.get(id) ?? 0;
  }
  return Object.freeze(result);
}

export function computeBetweennessScoresMilli(input: {
  readonly nodes: readonly SupplyChainNode[];
  readonly edges: readonly SupplyChainEdge[];
}): Readonly<Record<string, number>> {
  const ids = input.nodes.map((n) => n.nodeId);
  const adjacency = new Map<string, string[]>();
  for (const id of ids) {
    adjacency.set(id, []);
  }
  for (const edge of input.edges) {
    const list = adjacency.get(edge.fromNodeId) ?? [];
    list.push(edge.toNodeId);
    adjacency.set(edge.fromNodeId, list);
  }

  const betweenness = new Map<string, number>();
  for (const id of ids) {
    betweenness.set(id, 0);
  }

  for (const source of ids) {
    const stack: string[] = [];
    const pred = new Map<string, string[]>();
    const sigma = new Map<string, number>();
    const dist = new Map<string, number>();
    for (const id of ids) {
      pred.set(id, []);
      sigma.set(id, 0);
      dist.set(id, -1);
    }
    sigma.set(source, 1);
    dist.set(source, 0);
    const queue: string[] = [source];

    while (queue.length > 0) {
      const v = queue.shift()!;
      stack.push(v);
      for (const w of adjacency.get(v) ?? []) {
        if (dist.get(w) === -1) {
          dist.set(w, (dist.get(v) ?? 0) + 1);
          queue.push(w);
        }
        if (dist.get(w) === (dist.get(v) ?? 0) + 1) {
          sigma.set(w, (sigma.get(w) ?? 0) + (sigma.get(v) ?? 0));
          pred.get(w)!.push(v);
        }
      }
    }

    const delta = new Map<string, number>();
    for (const id of ids) {
      delta.set(id, 0);
    }
    while (stack.length > 0) {
      const w = stack.pop()!;
      for (const v of pred.get(w) ?? []) {
        const contribution = Math.floor(
          (((sigma.get(v) ?? 0) / Math.max(1, sigma.get(w) ?? 1)) * (1 + (delta.get(w) ?? 0)) * 1000) /
            Math.max(1, ids.length),
        );
        delta.set(v, (delta.get(v) ?? 0) + contribution);
      }
      if (w !== source) {
        betweenness.set(w, (betweenness.get(w) ?? 0) + (delta.get(w) ?? 0));
      }
    }
  }

  const result: Record<string, number> = {};
  for (const id of ids) {
    result[id] = betweenness.get(id) ?? 0;
  }
  return Object.freeze(result);
}

export function buildNetworkCentralityState(input: {
  readonly nodes: readonly SupplyChainNode[];
  readonly edges: readonly SupplyChainEdge[];
  readonly asOf: UtcInstant;
}): NetworkCentralityState {
  return Object.freeze({
    asOf: input.asOf,
    pagerankLikeScoresMilli: computePagerankLikeScoresMilli({
      nodes: input.nodes,
      edges: input.edges,
      asOf: input.asOf,
    }),
    betweennessScoresMilli: computeBetweennessScoresMilli({
      nodes: input.nodes,
      edges: input.edges,
    }),
    baselineMethod: 'PAGERANK_LIKE',
    grantsExecutionAuthority: false,
  });
}

export function weightedPathPropagationScoreMilli(input: {
  readonly pathEdgeWeightsMilli: readonly number[];
  readonly hopAttenuationMilli?: number;
}): number {
  const attenuation = input.hopAttenuationMilli ?? DEFAULT_RISK_HOP_ATTENUATION_MILLI;
  let score = 1000;
  for (const weight of input.pathEdgeWeightsMilli) {
    score = Math.floor((score * weight * attenuation) / (1000 * 1000));
  }
  return score;
}

export function listCriticalDependencies(input: {
  readonly focalNodeId: string;
  readonly edges: readonly SupplyChainEdge[];
  readonly asOf: UtcInstant;
}): readonly CriticalDependency[] {
  const inbound = input.edges.filter(
    (e) => e.toNodeId === input.focalNodeId && (e.edgeType === 'SUPPLIES' || e.edgeType === 'DEPENDS_ON'),
  );
  const total = inbound.reduce((s, e) => s + e.edgeWeightMilli, 0) || 1;
  const rows: CriticalDependency[] = inbound.map((edge) =>
    Object.freeze({
      focalNodeId: input.focalNodeId,
      supplierNodeId: edge.fromNodeId,
      dependencyWeightMilli: Math.floor((edge.edgeWeightMilli * 1000) / total),
      singleSource: inbound.length === 1,
      evidenceRefs: edge.evidenceRefs,
      asOf: input.asOf,
      grantsExecutionAuthority: false,
    }),
  );
  return Object.freeze(rows.sort((a, b) => b.dependencyWeightMilli - a.dependencyWeightMilli));
}

export function listBottleneckExposures(input: {
  readonly nodes: readonly SupplyChainNode[];
  readonly edges: readonly SupplyChainEdge[];
  readonly asOf: UtcInstant;
  readonly minBetweennessMilli?: number;
}): readonly BottleneckExposure[] {
  const betweenness = computeBetweennessScoresMilli({ nodes: input.nodes, edges: input.edges });
  const threshold = input.minBetweennessMilli ?? 50;
  const rows: BottleneckExposure[] = [];
  for (const node of input.nodes) {
    const score = betweenness[node.nodeId] ?? 0;
    if (score >= threshold) {
      rows.push(
        Object.freeze({
          nodeId: node.nodeId,
          displayName: node.displayName,
          betweennessMilli: score,
          affectedPathCount: input.edges.filter((e) => e.fromNodeId === node.nodeId || e.toNodeId === node.nodeId)
            .length,
          asOf: input.asOf,
          grantsExecutionAuthority: false,
        }),
      );
    }
  }
  return Object.freeze(rows);
}

export const SUPPLY_CHAIN_BASELINE_METHOD_LABELS: Readonly<Record<SupplyChainBaselineMethod, string>> = Object.freeze({
  WEIGHTED_PATH_PROPAGATION: 'weighted_path_propagation',
  PAGERANK_LIKE: 'pagerank_like',
  BETWEENNESS: 'betweenness',
  SUPPLIER_CONCENTRATION: 'supplier_concentration',
  CUSTOMER_CONCENTRATION: 'customer_concentration',
});

export function isUpstreamRiskEdge(edge: SupplyChainEdge): boolean {
  return (RISK_UPSTREAM_EDGE_TYPES as readonly string[]).includes(edge.edgeType);
}
