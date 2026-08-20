import type { EncryptedEnvelope } from '../../../security/src/envelope.ts';
import type { SecretReference } from '../../../security/src/secrets.ts';

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
