export {
  AI_CAN_VERIFY_EXTERNAL_EVIDENCE,
  AUTOMATION_CAN_VERIFY_EXTERNAL_EVIDENCE,
  CONFIDENTIAL_DOCUMENT_ON_CHAIN,
  ENGINEERING_TEST_EQUALS_EXTERNAL_EVIDENCE,
  EXPIRED_EVIDENCE_COUNTS,
  EXTERNAL_EVIDENCE_ACTOR_KINDS,
  EXTERNAL_EVIDENCE_FRESHNESS_STATES,
  EXTERNAL_EVIDENCE_HASH_DOMAIN,
  EXTERNAL_EVIDENCE_REFERENCE_KINDS,
  EXTERNAL_EVIDENCE_SCHEMA_VERSION,
  EXTERNAL_EVIDENCE_SUBJECT_TYPES,
  EXTERNAL_EVIDENCE_TOOL_VERSION,
  EXTERNAL_EVIDENCE_VAULT_KIND,
  EXTERNAL_EVIDENCE_VERIFICATION_STATES,
  EXTERNAL_EVIDENCE_VERIFIER_ROLES,
  EXTERNAL_PRODUCTION_EVIDENCE_CLASSES,
  FIXTURE_COUNTS_AS_EXTERNAL,
  GROK_CAN_VERIFY_EXTERNAL_EVIDENCE,
  NON_HUMAN_VERIFIER_KINDS,
  PRODUCTION_ACTIVE,
  REVOKED_EVIDENCE_COUNTS,
  S3M_CAN_VERIFY_EXTERNAL_EVIDENCE,
  STRING_SLOT_SATISFIES_EXTERNAL_READINESS,
  VERIFIED_EVIDENCE_SCOPE_BOUND,
  VERIFIED_FOR_PRODUCTION_STATE_EXISTS,
  externalEvidenceErr,
  externalEvidenceOk,
  isExternalProductionEvidenceClass,
  isVerifiedExternalState,
  isVerifiedFixtureState,
  satisfiesProductionVerification,
} from './types.ts';
export type {
  ExternalEvidenceActorKind,
  ExternalEvidenceFreshness,
  ExternalEvidenceQuery,
  ExternalEvidenceReference,
  ExternalEvidenceReferenceKind,
  ExternalEvidenceRegistryError,
  ExternalEvidenceResult,
  ExternalEvidenceScope,
  ExternalEvidenceSubjectType,
  ExternalEvidenceVerificationState,
  ExternalEvidenceVerifier,
  ExternalEvidenceVerifierRole,
  ExternalProductionEvidenceClass,
  ExternalProductionEvidenceRecord,
  PublicExternalEvidenceView,
} from './types.ts';
export {
  canonicalizeReference,
  canonicalizeScope,
  externalEvidenceCommitmentHash,
  recordCommitmentHash,
  verificationSurvivesSemanticChange,
} from './hash.ts';
export { inferClassFromAnotherClass, recordMatchesQuery, scopeFromParts, scopeMatchesQuery } from './scope.ts';
export {
  applyFreshness,
  expiredBlocksEligibility,
  freshnessOf,
  isCurrentForEligibility,
  stateAfterExpiry,
} from './expiry.ts';
export {
  actorLooksNonHuman,
  invalidateVerificationAfterChange,
  markUnderReview,
  rejectExternalEvidence,
  requiredVerifierRoles,
  roleMayVerify,
  softwareCannotSelfDeclareRegulatory,
  verifyExternalEvidence,
} from './verification.ts';
export {
  revocationBlocksEligibility,
  revokeExternalEvidence,
  supersedeExternalEvidence,
  supersededPreservesHistory,
} from './revocation.ts';
export { ExternalEvidenceRegistry, recordFreshness, registryFromSnapshot } from './registry.ts';
export type { ExternalEvidenceDraft, ExternalEvidenceRegistrySnapshot } from './registry.ts';
export {
  DIMENSION_TO_EXTERNAL_CLASS,
  EVIDENCE_TYPE_TO_EXTERNAL,
  PROVIDER_CLASS_TO_EXTERNAL,
  bindReadinessRecordToRegistry,
  readinessRecordHasVerifiedRegistryReference,
  stringSlotSatisfiesExternalReadiness,
  toClassifiedEvidence,
  toProviderEvidenceRecord,
  toProviderVerificationState,
  toReadinessEvidenceState,
  toVerifierRole,
} from './bindings.ts';
export { assertNoConfidentialDocument, confidentialContentsAbsentFromPublicView, publicSafeView } from './report.ts';
export {
  FIXTURE_CANNOT_SATISFY_PRODUCTION,
  FIXTURE_NOW_UTC,
  counselOpinionDraft,
  createFixtureRegistry,
  externalLookingDraft,
  fixtureSecurityAuditDraft,
  providerAgreementDraft,
  registerFixtureSecurityAudit,
  regulatoryApprovalDraft,
} from './fixtures.ts';
export { sealExternalEvidenceCommitment } from './vault.ts';
