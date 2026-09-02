/**
 * Wave 5 productive asset identity — public exports.
 */

export { PRODUCTIVE_ASSET_IDENTITY_AUDIT } from './audit.ts';
export {
  ProductiveAssetAliasRegistry,
  aliasValueCommitment,
  createAlias,
  deriveAliasId,
} from './alias.ts';
export { commitCoordinates, commitDisplayName, commitValue } from './commitment.ts';
export { deriveAssetFingerprint, fingerprintOfAsset } from './fingerprint.ts';
export { createCollisionFixtureBundle, createCollisionFixtureRegistry, FIXTURE_NOW_UTC } from './fixtures.ts';
export { assessProductionRollup, hierarchyEdge, validateHierarchyAcyclic } from './hierarchy.ts';
export { lifecycleAllowsProduction, transitionLifecycle } from './lifecycle.ts';
export {
  ProductiveAssetIdentityRegistry,
  asProductiveAssetId,
} from './registry.ts';
export {
  buildResolutionHints,
  commitCoordinatesHint,
  policyAllowsAutomatedConsolidation,
  resolveProductiveAssetIdentity,
} from './resolution.ts';
export {
  PRODUCTIVE_ASSET_IDENTITY_SCHEMA,
  PRODUCTIVE_ASSET_CLASSES,
  PRODUCTIVE_ASSET_LIFECYCLES,
  PARTY_ROLES,
  ASSET_VERIFICATION_STATUSES,
  IDENTITY_CONFIDENCE_LEVELS,
  EXTERNAL_IDENTIFIER_KINDS,
  PRODUCTIVE_ALIAS_KINDS,
  ROLLUP_BEHAVIORS,
} from './types.ts';
export type {
  AssetHierarchyEdge,
  AssetResolutionHint,
  AssetResolutionResult,
  AssetVerificationStatus,
  CanonicalProductiveAsset,
  ExternalIdentifier,
  ExternalIdentifierKind,
  GeographicReference,
  IdentityConfidence,
  PartyReference,
  PartyRole,
  ProductiveAssetAlias,
  ProductiveAssetAliasId,
  ProductiveAssetClass,
  ProductiveAssetFingerprint,
  ProductiveAssetId,
  ProductiveAssetIdentitySnapshot,
  ProductiveAssetLifecycle,
  ProductiveAliasKind,
  ProductionAttributionAssessment,
  RegisterProductiveAssetInput,
  RollupBehavior,
} from './types.ts';
