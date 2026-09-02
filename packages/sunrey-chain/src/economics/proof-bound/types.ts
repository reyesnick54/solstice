/**
 * Wave 3 — Economic Proof Architecture types.
 *
 * Binds information authorization to monetary authorization without
 * allowing proof objects themselves to mint. Extends Chunk 71 only.
 */

export const ECONOMIC_PROOF_SCHEMA = 'sunrey.economic-proof.v1' as const;
export const ECONOMIC_CLAIM_SCHEMA = 'sunrey.economic-claim.v1' as const;

export const ECONOMIC_DOMAINS = ['HUMAN_ECONOMY', 'PRODUCTIVE_ECONOMY'] as const;
export type EconomicDomain = (typeof ECONOMIC_DOMAINS)[number];

export const CLAIM_LIFECYCLE_STATES = [
  'REGISTERED',
  'VERIFIED',
  'VALUED',
  'MONETIZATION_AUTHORIZED',
  'MONETIZED',
  'REFUSED',
] as const;
export type ClaimLifecycleState = (typeof CLAIM_LIFECYCLE_STATES)[number];

export type CanonicalEconomicClaim = {
  readonly schema: typeof ECONOMIC_CLAIM_SCHEMA;
  readonly economicClaimId: string;
  readonly claimCommitment: string;
  readonly economicDomain: EconomicDomain;
  readonly contributionClass: string;
  readonly fingerprint: string;
  readonly lifecycleState: ClaimLifecycleState;
  readonly registeredAtUtc: string;
  readonly containsRawPersonalData: false;
};

export type EvidenceCommitment = {
  readonly commitmentId: string;
  readonly commitmentHash: string;
  readonly evidenceClass: string;
  readonly subjectCommitment: string;
  readonly provenanceRef: string;
  readonly verificationPolicyVersion: string;
  readonly sealedAtUtc: string;
};

export type RightsCommitment = {
  readonly commitmentId: string;
  readonly commitmentHash: string;
  readonly rightsClass: 'CONSENT' | 'LICENSE' | 'SOURCE_RIGHTS';
  readonly purpose: string;
  readonly scopeCommitment: string;
  readonly holderCommitment: string;
  readonly validFromUnixSeconds: bigint;
  readonly expiresAtUnixSeconds: bigint;
  readonly active: boolean;
};

export type PolicyCommitment = {
  readonly commitmentId: string;
  readonly commitmentHash: string;
  readonly policyPackId: string;
  readonly policyVersion: string;
  readonly methodologyVersion: string;
  readonly active: boolean;
  readonly activatedAtHeight: number;
};

export type EconomicValuationRef = {
  readonly valuationId: string;
  readonly methodologyId: string;
  readonly methodologyVersion: string;
  readonly valuationDigest: string;
  readonly referenceValue: string;
  readonly denomination: string;
  readonly isExchangeMarketPrice: false;
};

export type GovernanceAuthorizationRef = {
  readonly authorizationId: string;
  readonly authorizedQuantity: string;
  readonly governancePolicyVersion: string;
  readonly governanceDigest: string;
  readonly authorizedBy: 'HUMAN_GOVERNANCE';
  readonly aiApproved: false;
};

export type EconomicProofBundle = {
  readonly schema: typeof ECONOMIC_PROOF_SCHEMA;
  readonly bundleId: string;
  readonly economicClaimId: string;
  readonly claimCommitment: string;
  readonly economicDomain: EconomicDomain;
  readonly evidenceCommitmentId: string;
  readonly evidenceCommitmentHash: string;
  readonly evidenceRoot: string;
  readonly rightsCommitmentId: string;
  readonly rightsCommitmentHash: string;
  readonly rightsRoot: string;
  readonly policyCommitmentId: string;
  readonly policyCommitmentHash: string;
  readonly policyRoot: string;
  readonly valuation: EconomicValuationRef;
  readonly governanceAuthorization: GovernanceAuthorizationRef;
  readonly monetizationKey: string;
  readonly protocolVersion: string;
};

export type CommitmentRootContext = {
  readonly evidenceRoot: string;
  readonly rightsRoot: string;
  readonly policyRoot: string;
  readonly blockHeight: number;
  readonly stateCommitment: string;
};

export type MonetizationConsumptionRecord = {
  readonly monetizationKey: string;
  readonly economicClaimId: string;
  readonly bundleId: string;
  readonly assetId: 'SUNREY_COIN' | 'MOONREY_COIN';
  readonly quantity: string;
  readonly transactionId: string;
  readonly blockHeight: number;
  readonly stateCommitment: string;
  readonly consumedAtUtc: string;
};

export type MonetaryIssuanceReceipt = {
  readonly receiptKind: 'MONETARY_ISSUANCE';
  readonly transactionId: string;
  readonly assetId: 'SUNREY_COIN' | 'MOONREY_COIN';
  readonly quantity: string;
  readonly economicClaimId: string;
  readonly evidenceCommitmentHash: string;
  readonly evidenceRoot: string;
  readonly rightsCommitmentHash: string;
  readonly rightsRoot: string;
  readonly policyCommitmentHash: string;
  readonly policyRoot: string;
  readonly governanceAuthorizationId: string;
  readonly finalizedBlockHeight: number;
  readonly monetaryStateCommitment: string;
  readonly monetizationKey: string;
};

export type BurnReceipt = {
  readonly receiptKind: 'MONETARY_BURN';
  readonly transactionId: string;
  readonly assetId: 'SUNREY_COIN' | 'MOONREY_COIN';
  readonly quantity: string;
  readonly burnClass: string;
  readonly account: string;
  readonly finalizedBlockHeight: number;
  readonly monetaryStateCommitment: string;
};

export type ProofBoundRejection =
  | 'CLAIM_NOT_FOUND'
  | 'CLAIM_ALREADY_MONETIZED'
  | 'CLAIM_FINGERPRINT_DUPLICATE'
  | 'CLAIM_DOMAIN_MISMATCH'
  | 'EVIDENCE_COMMITMENT_MISSING'
  | 'EVIDENCE_COMMITMENT_TAMPERED'
  | 'EVIDENCE_ROOT_MISMATCH'
  | 'EVIDENCE_NOT_IN_ROOT'
  | 'RIGHTS_COMMITMENT_MISSING'
  | 'RIGHTS_COMMITMENT_TAMPERED'
  | 'RIGHTS_ROOT_MISMATCH'
  | 'RIGHTS_NOT_IN_ROOT'
  | 'RIGHTS_EXPIRED'
  | 'RIGHTS_INACTIVE'
  | 'RIGHTS_WRONG_PURPOSE'
  | 'POLICY_COMMITMENT_MISSING'
  | 'POLICY_COMMITMENT_TAMPERED'
  | 'POLICY_ROOT_MISMATCH'
  | 'POLICY_NOT_IN_ROOT'
  | 'POLICY_INACTIVE'
  | 'POLICY_HASH_MISMATCH'
  | 'VALUATION_MISSING'
  | 'GOVERNANCE_AUTHORIZATION_MISSING'
  | 'AI_GOVERNANCE_REJECTED'
  | 'DUPLICATE_MONETIZATION_KEY'
  | 'DUPLICATE_GOVERNANCE_AUTHORIZATION'
  | 'SUNREY_PROOF_FOR_MOONREY'
  | 'MOONREY_PROOF_FOR_SUNREY'
  | 'MONETIZATION_CONSUMPTION_FAILED'
  | 'PROOF_BUNDLE_INVALID'
  | 'ZERO_SUPPLY_CHANGE_ON_FAILURE';
