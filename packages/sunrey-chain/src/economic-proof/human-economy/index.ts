export {
  HUMAN_ECONOMY_SCHEMA_VERSION,
  HUMAN_DATA_CLASSIFICATIONS,
  HUMAN_ECONOMY_PURPOSE_CODES,
  HUMAN_ECONOMY_TO_WAVE3_PURPOSE,
  HUMAN_ECONOMY_PURPOSE_NON_IMPLICATIONS,
  AUTHORIZED_CONTRIBUTION_KINDS,
  MINIMUM_NECESSARY_PROOF_KINDS,
  HUMAN_ECONOMY_COMMITMENT_DOMAINS,
  OFF_CHAIN_SENSITIVE_FIELDS,
  CONSENT_LIFECYCLE_STATES,
} from './taxonomy.ts';
export type {
  HumanEconomySchemaVersion,
  HumanDataClassification,
  HumanEconomyPurposeCode,
  AuthorizedContributionKind,
  MinimumNecessaryProofKind,
  ConsentLifecycleState,
} from './taxonomy.ts';

export {
  asHumanEconomyConsentGrantId,
  asAuthorizedContributionId,
  asHumanDataUsageReceiptId,
  asOffChainRecordRefId,
  newHumanEconomyConsentGrantId,
  newAuthorizedContributionId,
  newHumanDataUsageReceiptId,
  newOffChainRecordRefId,
  HUMAN_ECONOMY_ID_PREFIXES,
} from './ids.ts';
export type {
  HumanEconomyConsentGrantId,
  AuthorizedContributionId,
  HumanDataUsageReceiptId,
  OffChainRecordRefId,
} from './ids.ts';

export type {
  HumanEconomyConsentGrant,
  AuthorizedDatasetContribution,
  AuthorizedComputationParticipation,
  AuthorizedContribution,
  MinimumNecessaryProof,
  HumanDataUsageReceipt,
  OffChainRecordReference,
  HumanEconomyDenialCode,
  HumanEconomyEvaluationRequest,
  HumanEconomyEvaluationAllow,
  HumanEconomyEvaluationDeny,
  HumanEconomyEvaluationResult,
  HistoricalAuthorizationProof,
} from './types.ts';

export {
  isHumanDataClassification,
  classificationRank,
  requiresExplicitConsent,
  requiresPurposeAuthorization,
  isContributionEligibleClassification,
  mapProductClassificationToHumanData,
  classificationPermitsOnChainCommitment,
  maxClassification,
} from './classification.ts';

export {
  buildHumanEconomyConsentGrant,
  renewHumanEconomyConsent,
  markConsentRevoked,
  markConsentExpired,
  attachUsageReceiptCommitment,
  humanEconomyPurposeAuthorization,
  consentCoversScope,
  consentCoversRecipient,
} from './consent.ts';
export type { BuildHumanEconomyConsentInput } from './consent.ts';

export {
  isRawDataContribution,
  buildAuthorizedDatasetContribution,
  buildAuthorizedComputationParticipation,
  isAuthorizedContribution,
  contributionCommitment,
  buildOffChainRecordReference,
  minimumNecessaryProofSufficient,
} from './contribution.ts';
export type { RawDataContributionAttempt } from './contribution.ts';

export {
  humanEconomyConsentCommitment,
  humanDataUsageReceiptCommitment,
  serializedCommitmentExcludesSensitiveFields,
} from './commitments.ts';

export {
  isPurposeImpliedNotPermitted,
  purposesAreDistinct,
  researchCannotBecomeMonetary,
  agentCannotBecomeDatasetMonetization,
} from './purpose-controls.ts';

export {
  evaluateHumanEconomyRights,
  buildHistoricalAuthorizationProof,
  rightsCommitmentDigestFor,
} from './evaluation.ts';

export {
  buildHumanDataUsageReceipt,
  usageReceiptExcludesRawPayload,
  usageReceiptCommitmentDigest,
  receiptBindsAuthorization,
} from './usage-receipt.ts';
export type { BuildUsageReceiptInput } from './usage-receipt.ts';

export {
  UNCONFIGURED_SELECTIVE_DISCLOSURE_BOUNDARY,
  selectiveDisclosureAvailable,
} from './selective-disclosure.ts';
export type {
  VerifiableCredentialPresentation,
  SelectiveDisclosureRequest,
  SelectiveDisclosureResult,
  ZeroKnowledgeProofRequest,
  ZeroKnowledgeProofVerification,
  PrivacyPreservingComputationRequest,
  PrivacyPreservingComputationResult,
  VerifiableCredentialPort,
  ZeroKnowledgeProofPort,
  PrivacyPreservingComputationPort,
  SelectiveDisclosureBoundary,
} from './selective-disclosure.ts';

export {
  assessCommitmentEntropy,
  handleOffChainRecordDeletion,
  offChainRecordAvailableForFutureUse,
  historicalCommitmentRemainsValidAfterDeletion,
} from './deletion-boundary.ts';
export type { CommitmentEntropyAssessment, OffChainDeletionOutcome } from './deletion-boundary.ts';

export {
  HIN_DOMAIN_AUDIT,
  auditDomainsMatching,
  domainsWithIngestBlocked,
} from './hin-audit.ts';
export type { HinDataPathStatus, HinDomainAuditEntry } from './hin-audit.ts';
