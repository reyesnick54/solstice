/**
 * HELIOS ALT12 — intentional modality dropout during validation.
 */

import { ALT_MODALITIES, type AltModalityId } from '../taxonomy.ts';
import type { Alt12FusionRequest, AltModalityInput, SourceDropoutResult, SourceDropoutScenario } from './types.ts';
import { executeAlt12FusionCore } from './fusion-core.ts';

const DROPOUT_SCENARIOS: readonly SourceDropoutScenario[] = Object.freeze([
  { scenarioId: 'drop_satellite', removedModalities: Object.freeze(['satellite_geospatial']) },
  { scenarioId: 'drop_workforce_macro', removedModalities: Object.freeze(['workforce', 'macro']) },
  { scenarioId: 'drop_graph_logistics', removedModalities: Object.freeze(['supply_chain_graph', 'logistics']) },
  { scenarioId: 'drop_market_fundamentals', removedModalities: Object.freeze(['market', 'fundamentals']) },
]);

function applyDropout(inputs: readonly AltModalityInput[], removed: readonly AltModalityId[]): readonly AltModalityInput[] {
  const removedSet = new Set(removed);
  return Object.freeze(
    inputs
      .filter((row) => !removedSet.has(row.modality))
      .concat(
        ALT_MODALITIES.filter((m) => removedSet.has(m) && !inputs.some((row) => row.modality === m)).map((modality) =>
          Object.freeze({
            modality,
            featureValue: null,
            featureUncertainty: null,
            evaluatedAt: null,
            providerId: null,
            missingReason: 'UNKNOWN' as const,
            reliability: Object.freeze({
              trustScore: 0,
              coverageScore: 0,
              latencyScore: 0,
              calibrationScore: 0,
            }),
          }),
        ),
      ),
  );
}

export function listDefaultDropoutScenarios(): readonly SourceDropoutScenario[] {
  return DROPOUT_SCENARIOS;
}

export function runSourceDropoutValidation(
  baseRequest: Alt12FusionRequest,
  baselineFused: number,
  baselineUncertainty: number,
): readonly SourceDropoutResult[] {
  const scenarios = listDefaultDropoutScenarios();
  return Object.freeze(
    scenarios.map((scenario) => {
      const fused = executeAlt12FusionCore({
        ...baseRequest,
        fusionId: `${baseRequest.fusionId}:${scenario.scenarioId}`,
        modalityInputs: applyDropout(baseRequest.modalityInputs, scenario.removedModalities),
        runDropoutValidation: false,
      });
      const signalDelta = Math.abs(fused.fusedSignal - baselineFused);
      const uncertaintyWidened = fused.uncertainty.total >= baselineUncertainty * 0.95;
      const catastrophic = !Number.isFinite(fused.fusedSignal) || signalDelta > 2.5;
      const gracefulDegradation = !catastrophic && (uncertaintyWidened || fused.uncertainty.total > baselineUncertainty);
      return Object.freeze({
        scenarioId: scenario.scenarioId,
        removedModalities: scenario.removedModalities,
        fusedSignal: fused.fusedSignal,
        uncertaintyTotal: fused.uncertainty.total,
        gracefulDegradation,
        catastrophic,
      });
    }),
  );
}
