import type { IdentityProviderCandidateProfile } from './types.ts';
import { IDENTITY_PROVIDER_CAPABILITIES } from './types.ts';

export const FIXTURE_IDENTITY_PROVIDER_ID = 'fixture-identity' as const;

export function fixtureIdentityProviderProfile(): IdentityProviderCandidateProfile {
  return Object.freeze({
    providerId: FIXTURE_IDENTITY_PROVIDER_ID,
    version: '1.0.0-candidate',
    capabilities: IDENTITY_PROVIDER_CAPABILITIES,
    credentialDescriptorRef: 'cred-desc:fixture-identity:kyc_worker',
    endpointProfileRef: 'endpoint:fixture-identity:sandbox',
    supportedJurisdictions: Object.freeze(['GB', 'US-SIM']),
    providerAcceptanceRef: null,
    dataProcessingAgreementRef: null,
    securityEvidenceRef: null,
    jurisdictionEvidenceRef: null,
    retentionPolicyRef: 'retention:reference-only',
    residency: Object.freeze({
      supportedRegion: 'eu-west-sim',
      deployedRegion: 'eu-west-sim',
      configuredResidencyConstraint: 'EU_SIMULATION_ONLY',
      dataClass: 'IDENTITY_METADATA',
      dpaRef: null,
      jurisdictionReviewRef: null,
      cloudRegionDoesNotProveAdequacy: true,
    }),
    retentionDefault: 'REFERENCE_ONLY',
    productionAuthorized: false,
    liveVendorConnected: false,
  });
}
