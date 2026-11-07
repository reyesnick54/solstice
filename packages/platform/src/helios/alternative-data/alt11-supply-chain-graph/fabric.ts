/**
 * ALT11 supply-chain graph fabric — temporal heterogeneous graph + deterministic risk baselines.
 */

import type { UtcInstant } from '@solstice/domain';
import type { TemporalEntityGraphStore } from '../../feature-fabric/entity-resolution/graph-store.ts';
import {
  buildNetworkCentralityState,
  computeSupplierConcentration,
  listBottleneckExposures,
  listCriticalDependencies,
} from './baselines.ts';
import { assertSupplyChainEdgeEvidence, createSupplyChainGraphStore, type AppendSupplyChainEdgeInput, type SupplyChainGraphStore } from './graph-store.ts';
import { evaluateResearchModelPromotion, type ResearchModelScoreInput } from './research-models.ts';
import { findRiskPropagationPaths, type PropagateSupplyChainRiskInput } from './risk-propagation.ts';
import { anchorSupplyChainNodeOnTemporalGraph, type AnchorSupplyChainNodeInput } from './temporal-bridge.ts';
import {
  HELIOS_SUPPLY_CHAIN_GRAPH_AUTHORITY,
  HELIOS_SUPPLY_CHAIN_GRAPH_SCHEMA,
  SUPPLY_CHAIN_BASELINE_METHODS,
} from './taxonomy.ts';
import type { SupplyChainExposure, SupplyChainGraphSnapshot } from './types.ts';

export type HeliosSupplyChainGraphFabricOptions = {
  readonly entityGraph: TemporalEntityGraphStore;
  readonly store?: SupplyChainGraphStore;
};

export type HeliosSupplyChainGraphFabric = {
  readonly entityGraph: TemporalEntityGraphStore;
  readonly store: SupplyChainGraphStore;
  readonly registerNode: (input: AnchorSupplyChainNodeInput) => ReturnType<SupplyChainGraphStore['upsertNode']>;
  readonly appendEdge: (input: AppendSupplyChainEdgeInput) => ReturnType<SupplyChainGraphStore['appendEdge']>;
  readonly assertEdgeEvidence: typeof assertSupplyChainEdgeEvidence;
  readonly propagateRisk: (
    input: Omit<PropagateSupplyChainRiskInput, 'edges' | 'nodes'>,
  ) => ReturnType<typeof findRiskPropagationPaths>;
  readonly exposure: (input: {
    readonly focalNodeId: string;
    readonly asOf: UtcInstant;
    readonly knowableCutoff: UtcInstant;
    readonly disruption?: { readonly originNodeId: string; readonly kind: string };
    readonly researchEvaluation?: ResearchModelScoreInput;
  }) => SupplyChainExposure | { readonly ok: false; readonly message: string };
  readonly snapshot: (sealedAt: UtcInstant) => SupplyChainGraphSnapshot;
};

export function createHeliosSupplyChainGraphFabric(
  options: HeliosSupplyChainGraphFabricOptions,
): HeliosSupplyChainGraphFabric {
  const entityGraph = options.entityGraph;
  const store = options.store ?? createSupplyChainGraphStore();

  return Object.freeze({
    entityGraph,
    store,
    registerNode(input) {
      const node = anchorSupplyChainNodeOnTemporalGraph(entityGraph, input);
      return store.upsertNode(node);
    },
    appendEdge(input) {
      return store.appendEdge(input);
    },
    assertEdgeEvidence: assertSupplyChainEdgeEvidence,
    propagateRisk(input) {
      const active = store.activeEdges({ asOf: input.asOf, knowableCutoff: input.knowableCutoff });
      return findRiskPropagationPaths({
        ...input,
        edges: active,
        nodes: store.listNodes(),
      });
    },
    exposure(input) {
      const focal = store.getNode(input.focalNodeId);
      if (!focal) {
        return { ok: false, message: 'focal node not found' };
      }
      const active = store.activeEdges({ asOf: input.asOf, knowableCutoff: input.knowableCutoff });
      const nodes = store.listNodes();
      const concentration = computeSupplierConcentration({
        focalNodeId: input.focalNodeId,
        edges: active,
        asOf: input.asOf,
      });
      const criticalDependencies = listCriticalDependencies({
        focalNodeId: input.focalNodeId,
        edges: active,
        asOf: input.asOf,
      });
      const bottleneckExposures = listBottleneckExposures({ nodes, edges: active, asOf: input.asOf });
      const centrality = buildNetworkCentralityState({ nodes, edges: active, asOf: input.asOf });

      let explainablePaths = Object.freeze([] as ReturnType<typeof findRiskPropagationPaths>);
      if (input.disruption) {
        explainablePaths = findRiskPropagationPaths({
          originNodeId: input.disruption.originNodeId,
          focalNodeId: input.focalNodeId,
          disruptionKind: input.disruption.kind,
          edges: active,
          nodes,
          asOf: input.asOf,
          knowableCutoff: input.knowableCutoff,
        });
      }

      const topPathScore = explainablePaths[0]?.propagationScoreMilli ?? 0;
      let promotedResearchModel = null;
      if (input.researchEvaluation) {
        const evaluation = evaluateResearchModelPromotion(input.researchEvaluation);
        if (evaluation.promoted) {
          promotedResearchModel = evaluation.modelKind;
        }
      }

      return Object.freeze({
        schema: HELIOS_SUPPLY_CHAIN_GRAPH_SCHEMA,
        authority: HELIOS_SUPPLY_CHAIN_GRAPH_AUTHORITY,
        focalNodeId: input.focalNodeId,
        asOf: input.asOf,
        knowableCutoff: input.knowableCutoff,
        propagationScoreMilli: topPathScore,
        concentration,
        criticalDependencies,
        bottleneckExposures,
        explainablePaths,
        centrality,
        baselineMethods: SUPPLY_CHAIN_BASELINE_METHODS,
        promotedResearchModel,
        grantsExecutionAuthority: false,
      });
    },
    snapshot(sealedAt) {
      const temporalSnap = entityGraph.snapshot(sealedAt);
      return store.snapshot(sealedAt, temporalSnap.contentDigest);
    },
  });
}
