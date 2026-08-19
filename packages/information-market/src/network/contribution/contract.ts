import type { UtcInstant } from '../../../../domain/src/time.ts';
import type { Result } from '../../../../domain/src/result.ts';

/**
 * Chunk 107 evidence contract.
 *
 * HIN maps realized authorized information use onto this privacy-safe
 * shape. The Human Economic Contribution Registry verifies and records
 * it. The core registry must not import the HIN engine.
 *
 * HIN is the source adapter only for INFORMATION_RIGHT_CONTRIBUTION
 * and related consent-scoped information activity. Other contribution
 * classes use their own verified attestation paths.
 */
export const INFORMATION_RIGHT_CONTRIBUTION = 'INFORMATION_RIGHT_CONTRIBUTION' as const;
export type InformationRightContributionClass = typeof INFORMATION_RIGHT_CONTRIBUTION;

export const NON_HIN_CONTRIBUTION_CLASSES = Object.freeze([
  'VERIFIED_KNOWLEDGE_CONTRIBUTION',
  'CREATIVE_PRODUCTION',
  'RESEARCH_PARTICIPATION',
  'PROFESSIONAL_EXPERTISE',
  'ECONOMIC_PARTICIPATION',
  'COMMUNITY_CONTRIBUTION',
  'EDUCATION_SKILL_ATTESTATION',
  'MODEL_TRAINING_PARTICIPATION',
  'HUMAN_SERVICE_DELIVERY',
  'ENTREPRENEURIAL_ACTIVITY',
  'CREATOR_ROYALTY_EVENT',
  'OTHER_GOVERNED_HUMAN_CONTRIBUTION',
] as const);
export type NonHinContributionClass = (typeof NON_HIN_CONTRIBUTION_CLASSES)[number];

export const HIN_CONTRIBUTION_BOUNDARY = Object.freeze({
  hinOwns: 'information rights, consent-scoped use, usage receipts, and clean-room authorization',
  registryOwns: 'canonical economic contribution record after verification',
  peveOwns: 'personal economic system measurement; not a contribution registry',
  chunk71Owns: 'monetary issuance authority; HIN compensation cannot mint',
  ownershipIsNotContribution: true,
  consentIsNotIssuance: true,
  automaticSunReyMint: false,
  productionActivated: false,
});

export type HinContributionFailure = {
  readonly code:
    | 'RIGHT_MISSING'
    | 'CONSENT_MISSING'
    | 'PURPOSE_MISMATCH'
    | 'PERMISSION_INACTIVE'
    | 'USAGE_DID_NOT_OCCUR'
    | 'RIGHT_EXPIRED_BEFORE_USE'
    | 'RIGHT_REVOKED_BEFORE_USE'
    | 'DESCRIPTOR_SUBJECT_MISMATCH'
    | 'COMPUTATION_NOT_APPROVED'
    | 'OUTPUT_CLASS_FORBIDDEN'
    | 'EVIDENCE_HASH_TAMPERED'
    | 'OWNERSHIP_IS_NOT_CONTRIBUTION'
    | 'CONSENT_IS_NOT_CONTRIBUTION'
    | 'DUPLICATE_USAGE_RECEIPT'
    | 'RAW_PERSONAL_DATA_FORBIDDEN'
    | 'HIN_COMPENSATION_CANNOT_MINT'
    | 'SCRAPING_FORBIDDEN'
    | 'EVIDENCE_INCOMPLETE'
    | 'AUTOMATIC_MINT_FORBIDDEN'
    | 'PRODUCTION_ACTIVATION_FORBIDDEN';
  readonly message: string;
};

/**
 * Privacy-safe normalized evidence. References and hashes only.
 * Never legal name, email, phone, SSN, passport, raw KYC, raw PDV,
 * raw health, raw location rows, clean-room source rows, or secrets.
 */
export type InformationRightContributionEvidence = {
  readonly contributionClass: InformationRightContributionClass;
  readonly subjectPseudonymousRef: string;
  readonly descriptorId: string;
  readonly rightId: string;
  readonly consentRef: string;
  readonly purposeRef: string;
  readonly usageReceiptId: string;
  readonly usageReceiptHash: string;
  readonly approvedComputationId: string;
  readonly approvedComputationHash: string;
  readonly approvedComputationResultId: string | null;
  readonly settlementRef: string | null;
  readonly evidenceDigest: string;
  readonly occurredAt: UtcInstant;
  readonly rawPersonalData: false;
  readonly mintRequested: false;
  readonly unrestrictedIssuance: false;
  readonly automaticSunReyMint: false;
};

export type HumanContributionRecord = {
  readonly contributionId: string;
  readonly contributionClass: InformationRightContributionClass;
  readonly status: 'VERIFIED';
  readonly evidence: InformationRightContributionEvidence;
  readonly verifiedAt: UtcInstant;
  readonly historicalRecordImmutable: true;
  readonly automaticSunReyMint: false;
  readonly rawPersonalDataOnRegistry: false;
};

/**
 * Port consumed by HIN. Implemented by the canonical Human Economic
 * Contribution Registry (Chunks 104-106) or a simulation binding of
 * that same evidence contract.
 */
export type HumanContributionRegistryPort = {
  recordVerifiedContribution(
    evidence: InformationRightContributionEvidence,
    verifiedAt: UtcInstant,
  ): Result<HumanContributionRecord, HinContributionFailure>;
  getById(contributionId: string): HumanContributionRecord | undefined;
  getByUsageReceiptId(usageReceiptId: string): HumanContributionRecord | undefined;
};

export type DataAssetContributionProjection = {
  readonly descriptorId: string;
  readonly contributionId: string;
  readonly subjectPseudonymousRef: string;
  readonly canonicalRefOnly: true;
  readonly rawContentIncluded: false;
};

export type DataAssetContributionProjectionPort = {
  attachContributionReference(
    projection: DataAssetContributionProjection,
  ): Result<DataAssetContributionProjection, HinContributionFailure>;
};
