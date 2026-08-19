export {
  HIN_CONTRIBUTION_BOUNDARY,
  INFORMATION_RIGHT_CONTRIBUTION,
  NON_HIN_CONTRIBUTION_CLASSES,
  type DataAssetContributionProjection,
  type DataAssetContributionProjectionPort,
  type HinContributionFailure,
  type HumanContributionRecord,
  type HumanContributionRegistryPort,
  type InformationRightContributionClass,
  type InformationRightContributionEvidence,
  type NonHinContributionClass,
} from './contract.ts';
export { createHinContributionAdapter, HinContributionAdapter } from './adapter.ts';
export {
  bindCanonicalHumanContributionRegistry,
  type CanonicalContributionRecorder,
  type CanonicalContributionRecord,
} from './canonical-bind.ts';
export { toInformationRightContributionEvidence } from './evidence.ts';
export { evaluateHinContributionInvariants } from './invariants.ts';
export { assertPrivacySafeRegistryPayload, FORBIDDEN_REGISTRY_KEYS } from './privacy.ts';
export {
  createInMemoryDataAssetProjection,
  HinContributionProjection,
} from './projection.ts';
export { contributionEvidenceDigest, createInProcessHumanContributionRegistry, evaluateHinContributionEvidence } from './registry.ts';
