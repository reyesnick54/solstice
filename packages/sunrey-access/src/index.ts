export { AccessFabricService } from './service.ts';
export {
  decideAllocation,
  evaluateScarcity,
  buildAccessQuote,
  detectForbiddenInputs,
  buildVerifiedCapacityState,
  validateCapacityState,
  isCapacityStale,
  SCARCITY_MODEL_V1,
  resolveScarcityModel,
  DEFAULT_MECHANISM_POLICY,
  selectMechanism,
} from './service.ts';
export type {
  AccessQuote,
  AllocationDecision,
  AllocationRequest,
  MechanismSelectionPolicy,
  ScarcityEvaluationInput,
  ScarcityRefusal,
  ScarcityState,
  TaggedInput,
  AllocationBasis,
  ForbiddenInputProbe,
  VerifiedCapacityState,
  CapacityRefusal,
  AllocationEngineResult,
} from './service.ts';
export type { AllocationEngineInput } from './allocation/engine.ts';
export {
  ALLOCATION_MECHANISMS,
  ACCESS_REGIME_HINTS,
  SCARCITY_BANDS,
  FORBIDDEN_SCARCITY_INPUTS,
  ALLOCATION_OUTCOMES,
  type AllocationMechanism,
  type AccessRegimeHint,
  type ScarcityBand,
  type AllocationOutcomeKind,
} from './taxonomy.ts';
