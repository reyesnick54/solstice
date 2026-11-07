/**
 * ALT11 qualification gate — HELIOS_ALT11_SUPPLY_CHAIN_GRAPH_QUALIFIED
 */

import { evaluateResearchModelPromotion } from './research-models.ts';
import { formatExplainablePathSummary } from './risk-propagation.ts';
import { seedAlt11ReferenceSupplyChainGraph } from './fixtures.ts';
import {
  HELIOS_ALT11_SUPPLY_CHAIN_GRAPH_BLOCKED,
  HELIOS_ALT11_SUPPLY_CHAIN_GRAPH_QUALIFIED,
  SUPPLY_CHAIN_BASELINE_METHODS,
  SUPPLY_CHAIN_EDGE_TYPES,
  SUPPLY_CHAIN_NODE_KINDS,
} from './taxonomy.ts';

export type Alt11QualificationChecks = {
  readonly nodeTaxonomyComplete: boolean;
  readonly edgeTaxonomyComplete: boolean;
  readonly evidenceRequiredOnEdges: boolean;
  readonly temporalGraphAnchored: boolean;
  readonly baselineMethodsPresent: boolean;
  readonly explainableMultiHopPath: boolean;
  readonly attenuationAndUncertaintyOnPath: boolean;
  readonly researchModelNotPromotedWithoutBeat: boolean;
  readonly noExecutionAuthority: boolean;
};

export type Alt11QualificationResult = {
  readonly marker: typeof HELIOS_ALT11_SUPPLY_CHAIN_GRAPH_QUALIFIED | typeof HELIOS_ALT11_SUPPLY_CHAIN_GRAPH_BLOCKED;
  readonly qualified: boolean;
  readonly blockers: readonly string[];
};

export function evaluateAlt11SupplyChainGraphQualification(
  checks: Alt11QualificationChecks,
): Alt11QualificationResult {
  const blockers: string[] = [];
  if (!checks.nodeTaxonomyComplete) blockers.push('node_taxonomy');
  if (!checks.edgeTaxonomyComplete) blockers.push('edge_taxonomy');
  if (!checks.evidenceRequiredOnEdges) blockers.push('evidence_backed_edges');
  if (!checks.temporalGraphAnchored) blockers.push('temporal_entity_graph_anchored');
  if (!checks.baselineMethodsPresent) blockers.push('deterministic_baselines');
  if (!checks.explainableMultiHopPath) blockers.push('explainable_multi_hop_path');
  if (!checks.attenuationAndUncertaintyOnPath) blockers.push('attenuation_and_uncertainty');
  if (!checks.researchModelNotPromotedWithoutBeat) blockers.push('ml_not_promoted_without_baseline_beat');
  if (!checks.noExecutionAuthority) blockers.push('no_execution_authority');

  const qualified = blockers.length === 0;
  return Object.freeze({
    marker: qualified ? HELIOS_ALT11_SUPPLY_CHAIN_GRAPH_QUALIFIED : HELIOS_ALT11_SUPPLY_CHAIN_GRAPH_BLOCKED,
    qualified,
    blockers: Object.freeze(blockers),
  });
}

export function runAlt11QualificationHarness(): Alt11QualificationResult {
  const fixture = seedAlt11ReferenceSupplyChainGraph();

  const edgeWithoutEvidence = fixture.fabric.appendEdge({
    edgeType: 'SUPPLIES',
    fromNodeId: fixture.supplierNodeId,
    toNodeId: fixture.companyNodeId,
    evidenceRefs: Object.freeze([]),
    source: 'test',
    confidenceState: 'CONFIRMED',
    ambiguityState: 'UNAMBIGUOUS',
    confidenceScoreMilli: 500,
    effectiveFrom: fixture.asOf,
    effectiveTo: null,
    observedAt: fixture.asOf,
    knowableAt: fixture.asOf,
    jurisdiction: 'US',
  });

  const companyNode = fixture.fabric.store.getNode(fixture.companyNodeId);
  const temporalAnchored = companyNode?.temporalAnchorNodeId != null;

  const paths = fixture.fabric.propagateRisk({
    originNodeId: fixture.portNodeId,
    focalNodeId: fixture.companyNodeId,
    disruptionKind: 'port_congestion',
    asOf: fixture.asOf,
    knowableCutoff: fixture.knowableCutoff,
  });

  const path = paths[0];
  const pathSummary = path ? formatExplainablePathSummary(path) : '';
  const explainable =
    paths.length >= 1 &&
    path!.steps.length >= 3 &&
    pathSummary.includes('Port X') &&
    pathSummary.includes('Supplier Y') &&
    pathSummary.includes('Component Z') &&
    pathSummary.includes('Company A');

  const attenuationOk =
    path !== undefined &&
    path.steps.some((s) => s.stepIndex > 0 && s.hopAttenuationMilli > 0 && s.hopAttenuationMilli < 1000) &&
    path.uncertaintyMilli >= 0 &&
    path.propagationScoreMilli > 0;

  const baselineBeatFail = evaluateResearchModelPromotion({
    modelKind: 'HETEROGENEOUS_GRAPH_ATTENTION',
    baselineMethod: 'WEIGHTED_PATH_PROPAGATION',
    baselineScoreMilli: path?.propagationScoreMilli ?? 500,
    modelScoreMilli: (path?.propagationScoreMilli ?? 500) - 1,
  });

  const exposure = fixture.fabric.exposure({
    focalNodeId: fixture.companyNodeId,
    asOf: fixture.asOf,
    knowableCutoff: fixture.knowableCutoff,
    disruption: { originNodeId: fixture.portNodeId, kind: 'port_congestion' },
    researchEvaluation: {
      modelKind: 'TEMPORAL_GNN',
      baselineMethod: 'WEIGHTED_PATH_PROPAGATION',
      baselineScoreMilli: path?.propagationScoreMilli ?? 1,
      modelScoreMilli: (path?.propagationScoreMilli ?? 1) - 5,
    },
  });

  const checks: Alt11QualificationChecks = {
    nodeTaxonomyComplete: SUPPLY_CHAIN_NODE_KINDS.length === 13,
    edgeTaxonomyComplete: SUPPLY_CHAIN_EDGE_TYPES.length === 11,
    evidenceRequiredOnEdges: edgeWithoutEvidence.ok === false,
    temporalGraphAnchored: temporalAnchored,
    baselineMethodsPresent: SUPPLY_CHAIN_BASELINE_METHODS.length === 5,
    explainableMultiHopPath: explainable,
    attenuationAndUncertaintyOnPath: attenuationOk,
    researchModelNotPromotedWithoutBeat: !baselineBeatFail.promoted,
    noExecutionAuthority:
      path?.grantsExecutionAuthority === false &&
      !baselineBeatFail.promoted &&
      exposure !== null &&
      'grantsExecutionAuthority' in exposure &&
      exposure.grantsExecutionAuthority === false,
  };

  return evaluateAlt11SupplyChainGraphQualification(checks);
}
