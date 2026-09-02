export {
  RIGHTS_COMMITMENT_DOMAIN,
  RIGHTS_ROOT_DOMAIN,
  rightsCommitment,
  rightsRoot,
  verifyRightsCommitment,
} from './commitment.ts';
export type { RightsCommitment, RightsRoot, RightsRootInput } from './commitment.ts';
export {
  RIGHTS_COMMITMENT_DOMAINS,
  RIGHTS_COMMITMENT_SCHEMA_VERSION,
  RIGHTS_ECONOMY_KINDS,
  RIGHTS_EVALUATION_DECISIONS,
  RIGHTS_GRANT_STATES,
  RIGHTS_SCHEMA_VERSION,
  LICENSE_RESTRICTION_LEVELS,
  PURPOSE_AUTHORIZATION_CODES,
  HUMAN_ECONOMY_FAIL_CLOSED_CONTRIBUTION_CLASSES,
  OFF_CHAIN_RIGHTS_FIELDS,
} from './taxonomy.ts';
export type {
  LicenseRestrictionLevel,
  PurposeAuthorizationCode,
  RightsEconomyKind,
  RightsEvaluationDecision,
  RightsGrantState,
  RightsSchemaVersion,
} from './taxonomy.ts';

export {
  asConsentGrantId,
  asLicenseAuthorizationId,
  asPurposeAuthorizationId,
  asRightsCommitmentId,
  asRightsDeltaId,
  asRightsGrantId,
  asRightsRevocationId,
  newConsentGrantId,
  newLicenseAuthorizationId,
  newPurposeAuthorizationId,
  newRightsCommitmentId,
  newRightsDeltaId,
  newRightsGrantId,
  newRightsRevocationId,
  RIGHTS_ID_PREFIXES,
} from './ids.ts';
export type {
  ConsentGrantId,
  LicenseAuthorizationId,
  PurposeAuthorizationId,
  RightsCommitmentId,
  RightsDeltaId,
  RightsGrantId,
  RightsRevocationId,
} from './ids.ts';

export type {
  ConsentGrant,
  DelegationConstraints,
  HistoricalRightsProof,
  LicenseAuthorization,
  PurposeAuthorization,
  RightsCommitment,
  RightsDelta,
  RightsDenialCode,
  RightsEvaluationAllow,
  RightsEvaluationDeny,
  RightsEvaluationRequest,
  RightsEvaluationResult,
  RightsGrant,
  RightsRevocation,
} from './types.ts';

export {
  commitRightsDomain,
  consentGrantCommitment,
  licenseAuthorizationCommitment,
  purposeAuthorizationCommitment,
  rightsCommitmentDigest,
  rightsDeltaCommitment,
  rightsGrantCommitment,
  rightsRevocationCommitment,
  scopeCommitmentFromLabels,
  subjectCommitment,
  verifyRightsCommitmentIntegrity,
} from './commitments.ts';

export {
  appendRightsDelta,
  rightsRootChanged,
  rightsRootFromCommitments,
  rightsRootFromDeltas,
} from './root.ts';

export {
  attachRevocationRef,
  evaluateRevocationSemantics,
  findRevocationForTarget,
  grantActiveAt,
  grantEffectiveWindow,
  resolveGrantState,
  wasRevokedBefore,
} from './revocation.ts';

export {
  buildHistoricalRightsProof,
  consentDoesNotMint,
  evaluateRights,
  evaluateRightsFailClosed,
  rightsCommitmentDigestFor,
} from './evaluation.ts';
