/**
 * Wave 6 — SunRey Human Economy monetary pipeline types.
 *
 * Extends Wave 3 proof-bound issuance. No earlier component may directly mint.
 * PEVE result must not automatically equal SunRey quantity.
 */

export const SUNREY_HUMAN_ECONOMY_PROPOSAL_SCHEMA =
  'sunrey.human-economy.issuance-proposal.v1' as const;

export const SUNREY_ECONOMIC_RECEIPT_SCHEMA = 'sunrey.human-economy.economic-receipt.v1' as const;

export const PRODUCTION_SUNREY_ISSUANCE_FORMULA_APPROVED = false as const;

export const HUMAN_CONTRIBUTION_DOMAINS = [
  'RESEARCH',
  'WORK',
  'EDUCATION',
  'COMPUTATION',
] as const;
export type HumanContributionDomain = (typeof HUMAN_CONTRIBUTION_DOMAINS)[number];

export const CLAIM_CHALLENGE_REASONS = [
  'ATTESTATION_REVOKED',
  'CREDENTIAL_FRAUDULENT',
  'IDENTITY_COMPROMISE',
  'DUPLICATE_CONTRIBUTION',
  'SOURCE_CORRECTION',
  'RIGHTS_DISPUTE',
] as const;
export type ClaimChallengeReason = (typeof CLAIM_CHALLENGE_REASONS)[number];

export const CLAIM_CHALLENGE_STATES = [
  'FILED',
  'UNDER_REVIEW',
  'UPHELD',
  'REJECTED',
  'CORRECTION_RECORDED',
] as const;
export type ClaimChallengeState = (typeof CLAIM_CHALLENGE_STATES)[number];

export type PeveValuationRef = {
  readonly valuationId: string;
  readonly methodologyId: string;
  readonly methodologyVersion: string;
  readonly referenceValue: string;
  readonly denomination: string;
  readonly valuationDigest: string;
  readonly peveEqualsSunReyQuantity: false;
};

export type MonetaryPolicyRef = {
  readonly policyId: string;
  readonly policyVersion: string;
  readonly conversionPolicyVersion: string;
  readonly productionApproved: false;
  readonly simulationOnly: true;
};

export type CanonicalContributionEventRef = {
  readonly contributionEventId: string;
  readonly contributionClass: string;
  readonly fingerprint: string;
  readonly verificationReceiptId: string;
  readonly registeredAtUtc: string;
};

export type PseudonymousActorRef = {
  readonly actorCommitment: string;
  readonly containsRawPersonalData: false;
};

export type VerificationReceiptRef = {
  readonly receiptId: string;
  readonly verificationPolicyVersion: string;
  readonly verifierCommitment: string;
  readonly verifiedAtUtc: string;
};

export type SunReyHumanEconomyIssuanceProposal = {
  readonly schema: typeof SUNREY_HUMAN_ECONOMY_PROPOSAL_SCHEMA;
  readonly proposalId: string;
  readonly schemaVersion: 1;
  readonly economicClaimId: string;
  readonly canonicalContributionEvent: CanonicalContributionEventRef;
  readonly pseudonymousActor: PseudonymousActorRef;
  readonly verificationReceipt: VerificationReceiptRef;
  readonly evidenceProofRef: string;
  readonly rightsProofRef: string;
  readonly policyProofRef: string;
  readonly peveValuation: PeveValuationRef;
  readonly monetaryPolicy: MonetaryPolicyRef;
  readonly proposedSunReyQuantity: string;
  readonly peveReferenceValue: string;
  readonly quantityDerivedFromPeve: false;
  readonly governanceRequirements: readonly string[];
  readonly governanceAuthorizationId: string | null;
  readonly monetizationKey: string;
  readonly network: 'DEVELOPMENT' | 'TESTNET' | 'MAINNET';
  readonly status: 'DRAFT' | 'AWAITING_GOVERNANCE' | 'AUTHORIZED_SIMULATION' | 'REFUSED' | 'ISSUED';
  readonly productionIssuanceDisabled: true;
};

export type SunReyEconomicReceipt = {
  readonly schema: typeof SUNREY_ECONOMIC_RECEIPT_SCHEMA;
  readonly receiptKind: 'SUNREY_HUMAN_ECONOMY_ISSUANCE';
  readonly transactionId: string;
  readonly sunReyQuantity: string;
  readonly economicClaimId: string;
  readonly canonicalContributionEventId: string;
  readonly pseudonymousActorCommitment: string;
  readonly verificationReceiptId: string;
  readonly evidenceRoot: string;
  readonly evidenceProofHash: string;
  readonly rightsRoot: string;
  readonly rightsProofHash: string;
  readonly policyRoot: string;
  readonly policyProofHash: string;
  readonly peveValuationId: string;
  readonly peveReferenceValue: string;
  readonly monetaryPolicyId: string;
  readonly governanceAuthorizationId: string;
  readonly finalizedBlockHeight: number;
  readonly monetaryStateRoot: string;
  readonly monetizationKey: string;
  readonly containsRawPersonalData: false;
};

export type ClaimChallengeRecord = {
  readonly challengeId: string;
  readonly economicClaimId: string;
  readonly reason: ClaimChallengeReason;
  readonly state: ClaimChallengeState;
  readonly filedAtUtc: string;
  readonly filedBy: 'HUMAN_GOVERNANCE' | 'PROTOCOL';
  readonly relatedTransactionId: string | null;
  readonly appendOnly: true;
};

export type PostFinalityCorrectionRecord = {
  readonly correctionId: string;
  readonly economicClaimId: string;
  readonly challengeId: string;
  readonly relatedTransactionId: string;
  readonly correctionKind: 'CHALLENGE_UPHELD' | 'SOURCE_CORRECTION' | 'RIGHTS_DISPUTE_RESOLVED';
  readonly recordedAtUtc: string;
  readonly automaticSeizureForbidden: true;
  readonly automaticBurnForbidden: true;
  readonly requiresGovernedMonetaryPolicy: true;
  readonly appendOnly: true;
};

export type VerifierReputationSignal = {
  readonly verifierCommitment: string;
  readonly contributionDomain: HumanContributionDomain;
  readonly verificationAccuracyBps: number;
  readonly signatureIntegrityBps: number;
  readonly revocationFrequencyBps: number;
  readonly disputeRateBps: number;
  readonly issuerStatus: 'ACTIVE' | 'SUSPENDED' | 'REVOKED';
  readonly sourceIndependence: 'INDEPENDENT' | 'AFFILIATED' | 'UNKNOWN';
  readonly historicalReliabilityBps: number;
  readonly reputationIsRiskSignalNotTruth: true;
};

export type DomainCircuitBreakerState = {
  readonly contributionDomain: HumanContributionDomain;
  readonly paused: boolean;
  readonly reason: string | null;
  readonly pausedAtUtc: string | null;
  readonly pausedBy: 'HUMAN_GOVERNANCE' | 'PROTOCOL' | null;
  readonly ordinaryTransfersUnaffected: true;
  readonly unrelatedDomainsUnaffected: true;
};

export type HumanEconomyMonitoringSnapshot = {
  readonly contributionsSubmitted: number;
  readonly contributionsVerified: number;
  readonly contributionsRejected: number;
  readonly manualReview: number;
  readonly duplicateDetected: number;
  readonly identityConflicts: number;
  readonly sybilSignals: number;
  readonly consentDenials: number;
  readonly rightsDenials: number;
  readonly peveCalculations: number;
  readonly sunReyProposals: number;
  readonly sunReyProposalRejections: number;
  readonly challengedClaims: number;
  readonly attestationProviderHealthAlerts: number;
  readonly containsSensitivePersonalInformation: false;
};

export type HumanEconomyPipelineRejection =
  | 'PEVE_EQUALS_SUNREY_QUANTITY_FORBIDDEN'
  | 'PRODUCTION_SUNREY_ISSUANCE_FORMULA_NOT_APPROVED'
  | 'PRODUCTION_ISSUANCE_DISABLED'
  | 'FORBIDDEN_MONETARY_AUTHORITY'
  | 'GOVERNANCE_AUTHORIZATION_MISSING'
  | 'AI_GOVERNANCE_REJECTED'
  | 'DOMAIN_VERIFICATION_PAUSED'
  | 'CLAIM_ALREADY_MONETIZED'
  | 'CLAIM_NOT_FOUND'
  | 'DUPLICATE_MONETIZATION_KEY'
  | 'INVALID_PROPOSAL'
  | 'MONETARY_POLICY_BOUNDARY_VIOLATION'
  | import('../proof-bound/types.ts').ProofBoundRejection
  | import('../../native-assets/issuance-pipelines.ts').PipelineRefusal;
