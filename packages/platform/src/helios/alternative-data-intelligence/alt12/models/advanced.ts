/**
 * HELIOS ALT12 advanced research fusion models (fixture-grade deterministic stubs).
 */

import type { AltAdvancedFusionModel } from '../../taxonomy.ts';
import type { FusionRouteDecision, ModelFusionOutput, ModalityState } from '../types.ts';
import { runAllBaselineModels } from './baseline.ts';

function present(modalities: readonly ModalityState[]): readonly ModalityState[] {
  return modalities.filter((m) => m.availability === 'PRESENT' && m.featureValue !== null);
}

function weightedMean(
  modalities: readonly ModalityState[],
  route: FusionRouteDecision,
  interactionBoost: (a: ModalityState, b: ModalityState) => number,
): { readonly mean: number; readonly uncertainty: number } {
  const rows = present(modalities);
  if (rows.length === 0) return { mean: 0, uncertainty: 1 };
  let num = 0;
  let den = 0;
  let unc = 0;
  for (const a of rows) {
    let w = (route.modalityRouteWeights[a.modality] ?? 0) * a.reliability.effectiveTrust;
    for (const b of rows) {
      if (b.modality <= a.modality) continue;
      w += 0.05 * interactionBoost(a, b);
    }
    num += w * a.featureValue!;
    den += w;
    unc += (a.featureUncertainty ?? 0.12) * w;
  }
  const mean = den > 0 ? num / den : 0;
  return { mean, uncertainty: den > 0 ? unc / den : 1 };
}

export function runCrossAttention(
  modalities: readonly ModalityState[],
  route: FusionRouteDecision,
): ModelFusionOutput {
  const { mean, uncertainty } = weightedMean(modalities, route, (a, b) =>
    a.modality === 'market' || b.modality === 'market' ? 0.12 : 0.04,
  );
  return Object.freeze({
    modelKind: 'CROSS_ATTENTION',
    pointEstimate: mean,
    uncertainty: Math.max(0.05, uncertainty * 0.92),
    activeModalityCount: present(modalities).length,
    researchOnly: true,
  });
}

export function runMultiGraphFusion(
  modalities: readonly ModalityState[],
  route: FusionRouteDecision,
): ModelFusionOutput {
  const graphModalities = new Set<ModalityState['modality']>([
    'supply_chain_graph',
    'logistics',
    'procurement',
    'workforce',
  ]);
  const graphRows = present(modalities).filter((m) => graphModalities.has(m.modality));
  const nonGraph = present(modalities).filter((m) => !graphModalities.has(m.modality));

  const graph = weightedMean(graphRows, route, () => 0.08);
  const rest = weightedMean(nonGraph, route, () => 0.02);
  const graphW = graphRows.length > 0 ? 0.55 : 0;
  const restW = nonGraph.length > 0 ? 0.45 : 0;
  const denom = graphW + restW || 1;
  const pointEstimate = (graph.mean * graphW + rest.mean * restW) / denom;
  const uncertainty = (graph.uncertainty * graphW + rest.uncertainty * restW) / denom;

  return Object.freeze({
    modelKind: 'MULTI_GRAPH_FUSION',
    pointEstimate,
    uncertainty: Math.max(0.05, uncertainty),
    activeModalityCount: present(modalities).length,
    researchOnly: true,
  });
}

export function runMixtureOfExperts(
  modalities: readonly ModalityState[],
  route: FusionRouteDecision,
): ModelFusionOutput {
  const baseline = runAllBaselineModels(modalities, route);
  let num = 0;
  let den = 0;
  let unc = 0;
  for (const output of Object.values(baseline)) {
    const w = route.modelRouteWeights[output.modelKind] ?? 0;
    num += w * output.pointEstimate;
    den += w;
    unc += w * output.uncertainty;
  }
  return Object.freeze({
    modelKind: 'MIXTURE_OF_EXPERTS',
    pointEstimate: den > 0 ? num / den : 0,
    uncertainty: den > 0 ? unc / den : 1,
    activeModalityCount: present(modalities).length,
    researchOnly: true,
  });
}

export function runMissingAwareTransformer(
  modalities: readonly ModalityState[],
  route: FusionRouteDecision,
): ModelFusionOutput {
  const rows = present(modalities);
  const missingCount = modalities.length - rows.length;
  const { mean, uncertainty } = weightedMean(modalities, route, () => 0.03);
  const missingPenalty = 1 + 0.08 * missingCount;
  return Object.freeze({
    modelKind: 'MISSING_AWARE_TRANSFORMER',
    pointEstimate: mean,
    uncertainty: Math.max(0.05, uncertainty * missingPenalty),
    activeModalityCount: rows.length,
    researchOnly: true,
  });
}

export function runAllAdvancedModels(
  modalities: readonly ModalityState[],
  route: FusionRouteDecision,
): Record<AltAdvancedFusionModel, ModelFusionOutput> {
  return Object.freeze({
    CROSS_ATTENTION: runCrossAttention(modalities, route),
    MULTI_GRAPH_FUSION: runMultiGraphFusion(modalities, route),
    MIXTURE_OF_EXPERTS: runMixtureOfExperts(modalities, route),
    MISSING_AWARE_TRANSFORMER: runMissingAwareTransformer(modalities, route),
  });
}
