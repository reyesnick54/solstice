/**
 * HELIOS ALT12 — missing-aware multimodal fusion orchestration.
 */

import { executeAlt12FusionCore } from './fusion-core.ts';
import { runSourceDropoutValidation } from './dropout-validation.ts';
import type { AlternativeDataFusionState, Alt12FusionRequest } from './types.ts';

export { executeAlt12FusionCore } from './fusion-core.ts';

export function runAlt12MultimodalFusion(request: Alt12FusionRequest): AlternativeDataFusionState {
  const core = executeAlt12FusionCore(request);
  if (request.runDropoutValidation === false) {
    return core;
  }
  const dropoutResults = runSourceDropoutValidation(request, core.fusedSignal, core.uncertainty.total);
  return Object.freeze({ ...core, dropoutResults });
}
