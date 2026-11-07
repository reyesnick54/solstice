export {
  HELIOS_ALT03,
  HELIOS_ALT03_ENTITY_ASSET_GRAPH_SCHEMA,
  HELIOS_ALT03_AUTHORITY,
  ALT_ASSET_ENTITY_KINDS,
  ALT_ASSET_RELATIONSHIP_TYPES,
  ALT_OBSERVATION_MATCH_STATES,
  ALT_MATCH_CASCADE_STAGES,
  ALT_OBSERVATION_SURFACES,
  HELIOS_ALT03_ENTITY_ASSET_GRAPH_QUALIFIED,
  HELIOS_ALT03_ENTITY_ASSET_GRAPH_BLOCKED,
  type AltAssetEntityKind,
  type AltAssetRelationshipType,
  type AltObservationMatchState,
  type AltMatchCascadeStage,
  type AltObservationSurface,
} from './taxonomy.ts';

export type {
  AltDeterministicIdentifier,
  AltCrosswalkEntry,
  AltCrosswalkRegistry,
  AltObservationResolutionInput,
  AltMatchCascadeStepEvidence,
  AltLlmMatchProposal,
  CertifiedAltMatchProposal,
  AltObservationMatchRecord,
  AltAppendAssetRelationInput,
} from './types.ts';
export { preferredTargetKindForSurface } from './types.ts';

export { normalizeAltLabel, normalizeIdentifierToken } from './normalize.ts';
export { assertAltObservationCompanyFeatureEligible, type AltCompanyFeatureGateResult } from './feature-gate.ts';
export { appendAltAssetRelation } from './relation-bridge.ts';
export { runAltObservationMatchingCascade, type AltMatchingCascadeOptions } from './matching-cascade.ts';
export {
  createHeliosAlt03EntityAssetGraphFabric,
  type HeliosAlt03EntityAssetGraphFabric,
  type HeliosAlt03EntityAssetGraphFabricOptions,
} from './fabric.ts';
export { seedAlt03ReferenceEntityAssetGraph, type Alt03FixtureHandles } from './fixtures.ts';
export {
  evaluateAlt03EntityAssetGraphQualification,
  runAlt03QualificationHarness,
  type Alt03QualificationChecks,
  type Alt03QualificationResult,
} from './qualification.ts';
