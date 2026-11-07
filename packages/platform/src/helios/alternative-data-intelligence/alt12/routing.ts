/**
 * HELIOS ALT12 — dynamic modality routing (missingness-aware).
 */

import { ALT_MODALITIES, type AltFusionModelKind, type AltModalityId } from '../taxonomy.ts';
import type { Alt12RoutingContext, AltModalityInput, FusionRouteDecision, ModalityState } from './types.ts';
import { buildModalityState } from './modality.ts';

const BASE_MODALITY_WEIGHT = 1 / ALT_MODALITIES.length;

const BASELINE_MODEL_WEIGHT = 0.55;
const ADVANCED_MODEL_WEIGHT = 0.45;

function uniformModelWeights(): Record<AltFusionModelKind, number> {
  return Object.freeze({
    ROBUST_LINEAR_ENSEMBLE: BASELINE_MODEL_WEIGHT * (1 / 3),
    GRADIENT_BOOSTING: BASELINE_MODEL_WEIGHT * (1 / 3),
    BAYESIAN_MODEL_AVERAGE: BASELINE_MODEL_WEIGHT * (1 / 3),
    CROSS_ATTENTION: ADVANCED_MODEL_WEIGHT * 0.28,
    MULTI_GRAPH_FUSION: ADVANCED_MODEL_WEIGHT * 0.24,
    MIXTURE_OF_EXPERTS: ADVANCED_MODEL_WEIGHT * 0.26,
    MISSING_AWARE_TRANSFORMER: ADVANCED_MODEL_WEIGHT * 0.22,
  });
}

function normalizeModalityWeights(
  weights: Record<AltModalityId, number>,
  active: readonly AltModalityId[],
): Record<AltModalityId, number> {
  const sum = active.reduce((acc, mod) => acc + (weights[mod] ?? 0), 0);
  const denom = sum > 0 ? sum : 1;
  const next = { ...weights };
  for (const mod of ALT_MODALITIES) {
    if (!active.includes(mod)) {
      next[mod] = 0;
    } else {
      next[mod] = (weights[mod] ?? 0) / denom;
    }
  }
  return Object.freeze(next);
}

export function materializeModalityStates(
  inputs: readonly AltModalityInput[],
  asOf: import('@solstice/domain').UtcInstant,
  context: Alt12RoutingContext = {},
): readonly ModalityState[] {
  const byId = new Map(inputs.map((row) => [row.modality, row]));
  return Object.freeze(
    ALT_MODALITIES.map((modality) => {
      const input = byId.get(modality);
      if (!input) {
        return buildModalityState({
          modality,
          availability: 'MISSING',
          missingReason: 'UNKNOWN',
          featureValue: null,
          featureUncertainty: null,
          evaluatedAt: null,
          providerId: null,
          trustScore: 0,
          coverageScore: 0,
          latencyScore: 0,
          calibrationScore: 0,
          routingContext: context,
        });
      }
      return buildModalityState({
        modality,
        availability: input.missingReason ? 'MISSING' : 'PRESENT',
        missingReason: input.missingReason,
        featureValue: input.featureValue,
        featureUncertainty: input.featureUncertainty,
        evaluatedAt: input.evaluatedAt,
        providerId: input.providerId,
        trustScore: input.reliability.trustScore,
        coverageScore: input.reliability.coverageScore,
        latencyScore: input.reliability.latencyScore,
        calibrationScore: input.reliability.calibrationScore,
        routingContext: context,
      });
    }),
  );
}

export function computeFusionRoute(
  modalities: readonly ModalityState[],
  context: Alt12RoutingContext = {},
): FusionRouteDecision {
  const notes: string[] = [];
  const blocked: AltModalityId[] = [];
  const weights = Object.fromEntries(ALT_MODALITIES.map((m) => [m, BASE_MODALITY_WEIGHT])) as Record<
    AltModalityId,
    number
  >;

  for (const state of modalities) {
    if (state.availability === 'BLOCKED') {
      blocked.push(state.modality);
      weights[state.modality] = 0;
      continue;
    }
    if (state.availability === 'MISSING') {
      weights[state.modality] = 0;
      continue;
    }
    weights[state.modality] *= state.reliability.effectiveTrust;
  }

  if (context.satelliteCloudObscured) {
    weights.satellite_geospatial *= 0.15;
    notes.push('satellite_cloud_obscured:down_weight_satellite_expert');
  }

  if (context.digitalDemandReliabilityDegraded) {
    weights.digital_demand *= 0.25;
    notes.push('search_reliability_degraded:down_weight_digital_demand');
  }

  if (context.workforceGeographicCoverageLost) {
    const workforce = modalities.find((m) => m.modality === 'workforce');
    if (workforce && workforce.availability !== 'MISSING') {
      weights.workforce = 0;
      blocked.push('workforce');
      notes.push('workforce_geographic_coverage_lost:block_workforce_feature');
    }
  }

  for (const state of modalities) {
    if (state.missingReason === 'LICENSE_BLOCKED' || state.missingReason === 'PRIVACY_THRESHOLD') {
      weights[state.modality] = 0;
      if (state.availability !== 'MISSING') {
        blocked.push(state.modality);
      }
      notes.push(`${state.modality}:${state.missingReason}:blocked`);
    }
  }

  const active = ALT_MODALITIES.filter((m) => (weights[m] ?? 0) > 0 && !blocked.includes(m));

  let modelWeights = { ...uniformModelWeights() };
  if (active.length <= 2) {
    modelWeights = {
      ...modelWeights,
      MISSING_AWARE_TRANSFORMER: modelWeights.MISSING_AWARE_TRANSFORMER * 1.35,
      ROBUST_LINEAR_ENSEMBLE: modelWeights.ROBUST_LINEAR_ENSEMBLE * 1.2,
      CROSS_ATTENTION: modelWeights.CROSS_ATTENTION * 0.7,
    };
    notes.push('sparse_modality_subset:boost_missing_aware_and_robust_linear');
  }

  return Object.freeze({
    routeId: `alt12-route:${active.join('+') || 'none'}`,
    activeModalities: Object.freeze(active),
    blockedModalities: Object.freeze([...new Set(blocked)]),
    modalityRouteWeights: normalizeModalityWeights(weights, active),
    modelRouteWeights: Object.freeze(modelWeights),
    routingNotes: Object.freeze(notes),
  });
}
