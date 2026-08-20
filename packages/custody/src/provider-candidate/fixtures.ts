import { secretRef } from '../../../security/src/secrets.ts';
import type { CustodyProviderCandidateProfile } from './types.ts';
import { fixtureEvidenceBundle } from './evidence.ts';

export const FIXTURE_CUSTODY_HMAC_SECRET = 'sunrey-custody-provider-candidate-fixture';

export function fixtureCustodyProviderProfile(): CustodyProviderCandidateProfile {
  const evidence = fixtureEvidenceBundle();
  return Object.freeze({
    providerId: 'fixture-custody-provider-candidate',
    version: '1.0.0-candidate',
    providerType: 'HYBRID',
    supportedAssets: Object.freeze(['SUNREY_COIN', 'MOONREY_COIN'] as const),
    supportedNetworks: Object.freeze(['sunrey-devnet']),
    credentialDescriptorRef: 'credential://fixture/custody-worker',
    endpointProfileRef: 'endpoint://fixture/custody-sandbox',
    signingProviderRef: 'signing://fixture/hsm',
    kmsProviderRef: 'kms://fixture/non-exportable',
    hsmProviderRef: 'hsm://fixture/non-exportable',
    callbackProfileRef: 'callback://fixture/hmac',
    confirmationPolicy: 'require-chain-finality',
    providerAcceptanceRef: evidence.providerAcceptanceRef,
    contractEvidenceRef: evidence.contractEvidenceRef,
    securityAssessmentRef: evidence.securityAssessmentRef,
    HsmAttestationEvidenceRef: evidence.HsmAttestationEvidenceRef,
    keyManagementEvidenceRef: evidence.keyManagementEvidenceRef,
    licenseRegistrationEvidenceRef: evidence.licenseRegistrationEvidenceRef,
    jurisdictionEvidenceRef: evidence.jurisdictionEvidenceRef,
    businessContinuityEvidenceRef: evidence.businessContinuityEvidenceRef,
    productionAuthorized: false,
  });
}

export function fixtureCustodySecretRef() {
  return secretRef('simulation', 'custody/worker/hmac');
}
