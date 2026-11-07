/**
 * Multi-hop supplier disruption propagation with attenuation, uncertainty, and explainable paths.
 */

import { createHash } from 'node:crypto';

import type { UtcInstant } from '@solstice/domain';
import { combinePathConfidenceMilli } from './confidence.ts';
import {
  computeBetweennessScoresMilli,
  isUpstreamRiskEdge,
  weightedPathPropagationScoreMilli,
} from './baselines.ts';
import { DEFAULT_RISK_HOP_ATTENUATION_MILLI } from './taxonomy.ts';
import type {
  RiskPropagationPath,
  RiskPropagationPathStep,
  SupplyChainEdge,
  SupplyChainNode,
} from './types.ts';

export type PropagateSupplyChainRiskInput = {
  readonly originNodeId: string;
  readonly focalNodeId: string;
  readonly disruptionKind: string;
  readonly edges: readonly SupplyChainEdge[];
  readonly nodes: readonly SupplyChainNode[];
  readonly asOf: UtcInstant;
  readonly knowableCutoff: UtcInstant;
  readonly maxHops?: number;
  readonly hopAttenuationMilli?: number;
};

function nodeById(nodes: readonly SupplyChainNode[], nodeId: string): SupplyChainNode | undefined {
  return nodes.find((n) => n.nodeId === nodeId);
}

function narrativeForStep(input: {
  readonly node: SupplyChainNode;
  readonly edge: SupplyChainEdge | null;
  readonly disruptionKind: string;
  readonly stepIndex: number;
}): string {
  if (input.stepIndex === 0) {
    return `${input.node.displayName} — ${input.disruptionKind}`;
  }
  if (input.edge?.edgeType === 'SUPPLIES') {
    return `${input.node.displayName} supplies downstream (confidence ${input.edge.confidenceScoreMilli} milli)`;
  }
  if (input.edge?.edgeType === 'SHIPS_THROUGH') {
    return `Flow through ${input.node.displayName}`;
  }
  if (input.edge?.edgeType === 'DEPENDS_ON') {
    return `${input.node.displayName} dependency link`;
  }
  return `${input.node.displayName} linked via ${input.edge?.edgeType ?? 'path'}`;
}

function buildSteps(
  nodeIds: readonly string[],
  edgesAlongPath: readonly SupplyChainEdge[],
  nodes: readonly SupplyChainNode[],
  disruptionKind: string,
  hopAttenuationMilli: number,
): readonly RiskPropagationPathStep[] {
  const steps: RiskPropagationPathStep[] = [];
  let cumulativeConfidence = 1000;
  for (let i = 0; i < nodeIds.length; i += 1) {
    const nodeId = nodeIds[i]!;
    const node = nodeById(nodes, nodeId);
    if (!node) {
      continue;
    }
    const edge = i > 0 ? edgesAlongPath[i - 1] ?? null : null;
    if (edge) {
      cumulativeConfidence = combinePathConfidenceMilli([
        cumulativeConfidence,
        edge.confidenceScoreMilli,
      ]);
    }
    const hopAttenuation = i === 0 ? 1000 : hopAttenuationMilli;
    steps.push(
      Object.freeze({
        stepIndex: i,
        nodeId: node.nodeId,
        nodeKind: node.kind,
        displayName: node.displayName,
        edgeType: edge?.edgeType ?? null,
        narrative: narrativeForStep({ node, edge, disruptionKind, stepIndex: i }),
        hopAttenuationMilli: hopAttenuation,
        cumulativeConfidenceMilli: cumulativeConfidence,
      }),
    );
  }
  return Object.freeze(steps);
}

/**
 * Forward-traverse risk-bearing edges from disruption origin toward the focal company.
 */
export function findRiskPropagationPaths(input: PropagateSupplyChainRiskInput): readonly RiskPropagationPath[] {
  const maxHops = input.maxHops ?? 8;
  const hopAttenuationMilli = input.hopAttenuationMilli ?? DEFAULT_RISK_HOP_ATTENUATION_MILLI;
  const activeEdges = input.edges.filter(
    (e) => e.knowableAt <= input.knowableCutoff && isUpstreamRiskEdge(e),
  );

  type PathState = {
    readonly currentNodeId: string;
    readonly nodeIds: readonly string[];
    readonly edges: readonly SupplyChainEdge[];
  };

  const queue: PathState[] = [
    { currentNodeId: input.originNodeId, nodeIds: [input.originNodeId], edges: [] },
  ];
  const completed: PathState[] = [];

  while (queue.length > 0) {
    const state = queue.shift()!;
    if (state.currentNodeId === input.focalNodeId) {
      completed.push(state);
      continue;
    }
    if (state.nodeIds.length >= maxHops) {
      continue;
    }
    const outboundToFocal = activeEdges.filter((e) => e.fromNodeId === state.currentNodeId);
    for (const edge of outboundToFocal) {
      if (state.nodeIds.includes(edge.toNodeId)) {
        continue;
      }
      queue.push({
        currentNodeId: edge.toNodeId,
        nodeIds: Object.freeze([...state.nodeIds, edge.toNodeId]),
        edges: Object.freeze([...state.edges, edge]),
      });
    }
  }

  const betweenness = computeBetweennessScoresMilli({ nodes: input.nodes, edges: activeEdges });

  const paths: RiskPropagationPath[] = [];
  for (const state of completed) {
    const weights = state.edges.map((e) => e.edgeWeightMilli);
    const propagationScoreMilli = weightedPathPropagationScoreMilli({
      pathEdgeWeightsMilli: weights,
      hopAttenuationMilli,
    });
    const uncertaintyMilli = 1000 - combinePathConfidenceMilli(state.edges.map((e) => e.confidenceScoreMilli));
    const pathId = createHash('sha256')
      .update(`${state.nodeIds.join('>')}:${input.disruptionKind}`)
      .digest('hex')
      .slice(0, 24);

    const steps = buildSteps(state.nodeIds, state.edges, input.nodes, input.disruptionKind, hopAttenuationMilli);

    paths.push(
      Object.freeze({
        pathId,
        originNodeId: input.originNodeId,
        focalNodeId: input.focalNodeId,
        asOf: input.asOf,
        disruptionKind: input.disruptionKind,
        propagationScoreMilli,
        uncertaintyMilli,
        steps,
        baselineMethod: 'WEIGHTED_PATH_PROPAGATION',
        researchModel: null,
        grantsExecutionAuthority: false,
      }),
    );
  }

  return Object.freeze(
    paths.sort((a, b) => {
      if (b.propagationScoreMilli !== a.propagationScoreMilli) {
        return b.propagationScoreMilli - a.propagationScoreMilli;
      }
      const aBottle = betweenness[a.steps[0]?.nodeId ?? ''] ?? 0;
      const bBottle = betweenness[b.steps[0]?.nodeId ?? ''] ?? 0;
      return bBottle - aBottle;
    }),
  );
}

export function formatExplainablePathSummary(path: RiskPropagationPath): string {
  return path.steps.map((s) => s.narrative).join(' → ');
}
