export {
  ATTESTATION_SOURCE_CLASSES,
  ATTESTATION_SOURCE_CLASS_WEIGHTS,
  SELF_ATTESTATION_SOURCE_CLASS,
  attestationSourceClassWeight,
  countsTowardIndependentEvidence,
  isAttestationSourceClass,
  isAuthoritativeAttestationSource,
  isSelfAttestationSource,
  isStrongAttestationSource,
  selfAttestationCannotSoleVerify,
  selfAttestationMaySupportClaimInput,
  type AttestationEvidentiaryWeight,
  type AttestationSourceClass,
} from './source-classes.ts';

export {
  ATTESTATION_MESH_METHODOLOGY,
  ATTESTATION_MESH_POLICY_ID,
  ATTESTATION_MESH_POLICY_VERSION,
  CLASS_ATTESTATION_REQUIREMENTS,
  HUMAN_CONTRIBUTION_ATTESTATION_VERIFICATION_POLICY,
  classAttestationRequirementFor,
  selfAttestationEvidentiaryWeight,
  type ClassAttestationRequirement,
  type HumanContributionAttestationVerificationPolicy,
} from './policy.ts';

export {
  HUMAN_PROVIDER_CATALOG_AUDIT,
  auditSummary,
  awaitingMasterListProviders,
  implementedHumanProviders,
  providersByDomain,
  type HumanProviderAuditEntry,
  type HumanProviderDomain,
  type HumanProviderIntegrationState,
} from './provider-audit.ts';

export {
  analyzeAttestationIndependence,
  attestationsShareLineage,
  copiedSourceLineageDetected,
  effectiveIndependentAttestationCount,
  type AttestationIndependenceAnalysis,
} from './independence.ts';

export {
  assessIssuerTrust,
  verifyCredential,
  type CredentialIssuerTrust,
  type CredentialLifecycleState,
  type CredentialVerificationInput,
  type CredentialVerificationResult,
} from './credentials.ts';

export {
  detectFraudSignals,
  fraudSignalsRequireRejection,
  fraudSignalsRequireReview,
  type FraudDetectionContext,
  type FraudSignal,
  type FraudSignalKind,
} from './fraud.ts';

export {
  HumanContributionAttestationMesh,
  createContributionAttestation,
  verifyHumanContribution,
} from './engine.ts';

export {
  attestationMeshAuthorizesSunReyIssuance,
  attestationMeshCreatesMoney,
  attestationMeshCreatesPeve,
  buildAttestationMeshIcPromotion,
  buildHumanEconomicClaimPromotion,
  type AttestationMeshIcObservation,
  type AttestationMeshIcPromotion,
  type HumanEconomicClaimPromotion,
} from './ic-promotion.ts';

export {
  MESH_FIXTURE_CONTRIBUTION_ID,
  MESH_FIXTURE_EVENT,
  MESH_FIXTURE_NOW,
  MESH_FIXTURE_SUBJECT,
  fixtureAuthorizedDataAttestation,
  fixtureComputationReceiptAttestation,
  fixtureCopiedLineageAttestations,
  fixtureDuplicateReceiptAttestations,
  fixtureEducationCredentialAttestation,
  fixtureForgedAttestation,
  fixtureMeshInput,
  fixturePublicationAuthorMismatchAttestation,
  fixtureResearchPublisherAttestation,
  fixtureResearchRegistryAttestation,
  fixtureRevokedCredentialCheck,
  fixtureSelfAttestation,
  fixtureSignedWorkReceiptAttestation,
  fixtureStaleAttestation,
  fixtureValidCredentialCheck,
  fixtureWorkEmployerAttestation,
  fixtureWrongPersonAttestation,
} from './fixtures.ts';

export {
  ATTESTATION_MESH_SCHEMA_VERSION,
  type AttestationLineageSummary,
  type AttestationMeshVerificationEvaluation,
  type AttestationMeshVerificationInput,
  type AttestationRights,
  type AttestationRightsStatus,
  type AttestationStatementType,
  type AttestationValidity,
  type AttestationVerificationStatus,
  type ContributionAttestation,
  type HumanContributionVerificationReceipt,
  type HumanContributionVerificationResult,
  type IdentityAssuranceSummary,
  type VerificationExplanationCode,
} from './types.ts';
