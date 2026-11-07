export {
  HELIOS_ALT12_MULTIMODAL_FUSION_SCHEMA,
  HELIOS_ALT12_MULTIMODAL_FUSION_AUTHORITY,
  HELIOS_ALT12_MULTIMODAL_FUSION_QUALIFIED,
  HELIOS_ALT12_MULTIMODAL_FUSION_BLOCKED,
  ALT_MODALITIES,
  ALT_MISSING_REASONS,
  ALT_BASELINE_FUSION_MODELS,
  ALT_ADVANCED_FUSION_MODELS,
  ALT12_FUSION_MODULE,
  type AltModalityId,
  type AltMissingReason,
  type AltBaselineFusionModel,
  type AltAdvancedFusionModel,
  type AltFusionModelKind,
} from '../taxonomy.ts';

export type {
  AlternativeDataFusionState,
  ModalityState,
  ModalityReliability,
  FusionRoute,
  FusionRouteDecision,
  FusionUncertainty,
  SourceContribution,
  AltModalityInput,
  Alt12FusionRequest,
  Alt12RoutingContext,
  SourceDropoutResult,
  SourceDropoutScenario,
  ModelFusionOutput,
} from './types.ts';

export { runAlt12MultimodalFusion } from './engine.ts';
export { computeFusionRoute, materializeModalityStates } from './routing.ts';
export { runAllBaselineModels } from './models/baseline.ts';
export { runAllAdvancedModels } from './models/advanced.ts';
export { calibrateFusionUncertainty } from './uncertainty.ts';
export { computeSourceContributions } from './contributions.ts';
export { listDefaultDropoutScenarios, runSourceDropoutValidation } from './dropout-validation.ts';

export {
  evaluateAlt12MultimodalFusionQualification,
  qualificationChecksFromState,
  type Alt12MultimodalFusionQualificationChecks,
  type Alt12MultimodalFusionQualificationResult,
} from './qualification.ts';

export {
  ALT12_FIXTURE_ENTITY_ID,
  ALT12_FIXTURE_AS_OF,
  alt12FullModalityInputs,
  alt12SparseModalityInputs,
} from './fixtures.ts';
