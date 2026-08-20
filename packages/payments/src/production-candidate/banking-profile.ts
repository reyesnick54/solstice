import type { CurrencyCode } from '../../../domain/src/currency.ts';
import type { SecretReference } from '../../../security/src/secrets.ts';
import { freezeCandidate } from './provider-profile.ts';
import type {
  AccountReferenceClass,
  CredentialDescriptorRef,
  DataResidencyRef,
  EndpointProfileRef,
  EvidenceRef,
  ProviderAcceptanceRef,
  ProviderCandidateState,
  SettlementReportProfileRef,
  WebhookProfileRef,
} from './types.ts';

export type BankingProviderCandidateProfile = {
  readonly providerId: string;
  readonly version: string;
  readonly providerAcceptanceRef: ProviderAcceptanceRef;
  readonly supportedAccountReferenceClasses: readonly AccountReferenceClass[];
  readonly supportedCurrencies: readonly CurrencyCode[];
  readonly supportedRegions: readonly string[];
  readonly supportedCorridors: readonly string[];
  readonly credentialDescriptorRef: CredentialDescriptorRef;
  readonly endpointProfileRef: EndpointProfileRef;
  readonly webhookProfileRef: WebhookProfileRef;
  readonly settlementReportProfileRef: SettlementReportProfileRef;
  readonly dataResidencyRef: DataResidencyRef;
  readonly contractEvidenceRef: EvidenceRef;
  readonly licenseRegistrationEvidenceRef: EvidenceRef;
  readonly jurisdictionEvidenceRef: EvidenceRef;
  readonly securityEvidenceRef: EvidenceRef;
  readonly commercialEvidenceRef: EvidenceRef;
  readonly state: ProviderCandidateState;
  readonly productionAuthorized: false;
};

export function freezeBankingProviderCandidateProfile(
  input: BankingProviderCandidateProfile,
): BankingProviderCandidateProfile {
  if (input.providerAcceptanceRef.domain !== 'BANKING_REFERENCE') {
    throw new TypeError('banking profile must bind BANKING_REFERENCE');
  }
  if (input.productionAuthorized !== false) {
    throw new TypeError('banking productionAuthorized must remain false');
  }
  assertSecretOnly(input.credentialDescriptorRef.secretRef);
  return freezeCandidate({
    ...input,
    supportedAccountReferenceClasses: Object.freeze([...input.supportedAccountReferenceClasses]),
    supportedCurrencies: Object.freeze([...input.supportedCurrencies]),
    supportedRegions: Object.freeze([...input.supportedRegions]),
    supportedCorridors: Object.freeze([...input.supportedCorridors]),
    credentialDescriptorRef: Object.freeze({ ...input.credentialDescriptorRef, plaintextCredential: false }),
    productionAuthorized: false,
  });
}

function assertSecretOnly(ref: SecretReference): void {
  if (ref.scheme !== 'secret') {
    throw new TypeError('banking credentials must be SecretReference values');
  }
}
