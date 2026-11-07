/**
 * HELIOS ALT12 fusion core (no validation dropout; breaks import cycles).
 */

import {
  HELIOS_ALT12_MULTIMODAL_FUSION_AUTHORITY,
  HELIOS_ALT12_MULTIMODAL_FUSION_SCHEMA,
} from '../taxonomy.ts';
import { computeFusionRoute, materializeModalityStates } from './routing.ts';
import { runAllAdvancedModels } from './models/advanced.ts';
import { runAllBaselineModels } from './models/baseline.ts';
import { computeSourceContributions } from './contributions.ts';
import { calibrateFusionUncertainty, fuseModelOutputs } from './uncertainty.ts';
import type { AlternativeDataFusionState, Alt12FusionRequest } from './types.ts';

export function executeAlt12FusionCore(request: Alt12FusionRequest): AlternativeDataFusionState {
  const context = request.routingContext ?? {};
  const modalities = materializeModalityStates(request.modalityInputs, request.asOf, context);
  const route = computeFusionRoute(modalities, context);

  const baselineOutputs = runAllBaselineModels(modalities, route);
  const advancedOutputs = runAllAdvancedModels(modalities, route);
  const allOutputs = Object.freeze([...Object.values(baselineOutputs), ...Object.values(advancedOutputs)]);

  const { fusedSignal } = fuseModelOutputs(allOutputs, route);
  const uncertainty = calibrateFusionUncertainty({
    modalities,
    modelOutputs: allOutputs,
    route,
    fusedSignal,
  });
  const sourceContributions = computeSourceContributions(modalities, route, fusedSignal);

  return Object.freeze({
    schema: HELIOS_ALT12_MULTIMODAL_FUSION_SCHEMA,
    authority: HELIOS_ALT12_MULTIMODAL_FUSION_AUTHORITY,
    fusionId: request.fusionId,
    entityId: request.entityId,
    asOf: request.asOf,
    researchOnly: true,
    notAFact: true,
    grantsExecutionAuthority: false,
    modalities,
    route,
    baselineOutputs,
    advancedOutputs,
    fusedSignal,
    uncertainty,
    sourceContributions,
    dropoutResults: Object.freeze([]),
  });
}
