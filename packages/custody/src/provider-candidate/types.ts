import type { EncryptedEnvelope } from '../../../security/src/envelope.ts';
import type { SecretReference } from '../../../security/src/secrets.ts';
import type { NativeCustodyAssetId } from '../native-assets.ts';

export const REGULATED_TRAVEL_RULE_WORKLOAD = 'travel_rule_worker' as const;
export const FIXTURE_TRAVEL_RULE_PROVIDER_ID = 'fixture-travel-rule' as const;

export const TRAVEL_RULE_CANDIDATE_STATES = [
  'DISCOVERED',
  'PREPARED',
  'SUBMITTED',
  'ACKNOWLEDGED',
  'FAILED',
  'RETRY_PENDING',
] as const;
export type TravelRuleCandidateState = (typeof TRAVEL_RULE_CANDIDATE_STATES)[number];

export type TravelRuleCandidateProfile = {
  readonly providerId: typeof FIXTURE_TRAVEL_RULE_PROVIDER_ID;
  readonly version: string;
  readonly credentialDescriptorRef: string;
  readonly endpointProfileRef: string;
  readonly dataProcessingAgreementRef: string | null;
  readonly securityEvidenceRef: string | null;
  readonly jurisdictionEvidenceRef: string | null;
  readonly retentionPolicyRef: string;
  readonly productionAuthorized: false;
  readonly liveNetworkConnected: false;
  readonly payloadOnChain: false;
};

export type TravelRuleCandidateMessage = {
  readonly messageId: string;
  readonly withdrawalId: string;
  readonly recipientBinding: string;
  readonly purposeBinding: 'TRAVEL_RULE_ORIGINATOR_BENEFICIARY';
  readonly minimumNecessaryFields: true;
  readonly envelope: EncryptedEnvelope;
  readonly state: TravelRuleCandidateState;
  readonly acknowledged: boolean;
  readonly authorizesWithdrawal: false;
  readonly publicChainContainsRawPii: false;
  readonly loggedPlaintext: false;
  readonly evidenceRefs: readonly string[];
};

export type TravelRuleCandidateTransport = {
  readonly kind: 'FAKE';
  readonly realNetwork: false;
  discover(address: string): { readonly discovered: boolean; readonly counterpartyRef: string | null };
  submit(messageId: string): { readonly acknowledged: boolean; readonly failed: boolean };
};

export type TravelRuleCredentialBinding = {
  readonly providerId: typeof FIXTURE_TRAVEL_RULE_PROVIDER_ID;
  readonly credentialRef: SecretReference;
  readonly workloadIdentity: typeof REGULATED_TRAVEL_RULE_WORKLOAD;
  readonly crossWorkloadReuseRejected: true;
  readonly plaintextCredentialPresent: false;
};

/**
 * Production-candidate custody provider types.
 *
 * Simulation / fixture only. Does not replace CustodyProviderPort.
 * Does not become SunRey Chain state or AssetSupplyBook.
 */

export const CUSTODY_PROVIDER_CANDIDATE_TYPES = ['HSM', 'MPC', 'EXTERNAL_CUSTODIAN', 'HYBRID'] as const;
export type CustodyProviderCandidateType = (typeof CUSTODY_PROVIDER_CANDIDATE_TYPES)[number];

export const CUSTODY_SUBMISSION_STATES = [
  'NOT_SUBMITTED',
  'SUBMITTED',
  'PENDING',
  'FINALIZED',
  'REJECTED',
  'SUBMISSION_UNKNOWN',
  'RECONCILIATION_REQUIRED',
] as const;
export type CustodySubmissionState = (typeof CUSTODY_SUBMISSION_STATES)[number];

export const CUSTODY_KEY_ORIGINS = [
  'GENERATE_IN_HSM',
  'IMPORT_WRAPPED_KEY',
  'EXTERNAL_MPC_KEY',
  'COLD_OFFLINE_KEY',
] as const;
export type CustodyKeyOrigin = (typeof CUSTODY_KEY_ORIGINS)[number];

export const CUSTODY_KEY_LIFECYCLES = ['ACTIVE', 'ROTATING', 'VERIFY_ONLY', 'DISABLED', 'COMPROMISED'] as const;
export type CustodyKeyLifecycle = (typeof CUSTODY_KEY_LIFECYCLES)[number];

export const CUSTODY_CANDIDATE_WORKLOADS = [
  'custody_worker',
  'hsm_worker',
  'kms_worker',
  'validator_signer',
  'governance_kms',
  'oracle_collector',
] as const;
export type CustodyCandidateWorkload = (typeof CUSTODY_CANDIDATE_WORKLOADS)[number];

export type CustodyProviderCandidateProfile = {
  readonly providerId: string;
  readonly version: string;
  readonly providerType: CustodyProviderCandidateType;
  readonly supportedAssets: readonly NativeCustodyAssetId[];
  readonly supportedNetworks: readonly string[];
  readonly credentialDescriptorRef: string;
  readonly endpointProfileRef: string;
  readonly signingProviderRef: string;
  readonly kmsProviderRef: string;
  readonly hsmProviderRef: string;
  readonly callbackProfileRef: string;
  readonly confirmationPolicy: string;
  readonly providerAcceptanceRef: string;
  readonly contractEvidenceRef: string;
  readonly securityAssessmentRef: string;
  readonly HsmAttestationEvidenceRef: string;
  readonly keyManagementEvidenceRef: string;
  readonly licenseRegistrationEvidenceRef: string;
  readonly jurisdictionEvidenceRef: string;
  readonly businessContinuityEvidenceRef: string;
  readonly productionAuthorized: false;
};

export type CustodyCandidateWallet = {
  readonly walletId: string;
  readonly vaultId: string;
  readonly assetId: NativeCustodyAssetId;
  readonly address: string;
  readonly network: string;
  readonly chainId: string;
  readonly signerHandle: string;
  readonly securityTier: 'HOT' | 'WARM' | 'COLD';
  readonly createdAt: string;
};

export type CustodyCandidatePreview = {
  readonly previewId: string;
  readonly source: string;
  readonly destination: string;
  readonly assetId: NativeCustodyAssetId;
  readonly quantity: bigint;
  readonly feeAssetId: NativeCustodyAssetId;
  readonly feeLimit: bigint;
  readonly nonce: bigint;
  readonly networkId: string;
  readonly chainId: string;
  readonly canonicalBytes: string;
  readonly previewHash: string;
};

export type ProviderOperationalBalance = {
  readonly assetId: NativeCustodyAssetId;
  readonly quantity: bigint;
  readonly isAssetSupplyBook: false;
  readonly isNativeSupply: false;
  readonly isCustomerFiatLedgerBalance: false;
  readonly reconciliationEvidenceOnly: true;
};

export type CustodyCandidateFailure = {
  readonly code: string;
  readonly message: string;
};

export type CustodyCandidateResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: CustodyCandidateFailure };

export function candidateOk<T>(value: T): CustodyCandidateResult<T> {
  return Object.freeze({ ok: true, value });
}

export function candidateErr(code: string, message: string): CustodyCandidateResult<never> {
  return Object.freeze({ ok: false, error: Object.freeze({ code, message }) });
}
