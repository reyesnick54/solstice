import { COMPLIANCE_PROVIDER_CAPABILITIES, type ComplianceProviderCandidateProfile } from './types.ts';

export const FIXTURE_SANCTIONS_PROVIDER_ID = 'fixture-sanctions' as const;
export const FIXTURE_PEP_PROVIDER_ID = 'fixture-pep' as const;
export const FIXTURE_AML_PROVIDER_ID = 'fixture-aml' as const;

export function fixtureSanctionsProviderProfile(): ComplianceProviderCandidateProfile {
  return profile(FIXTURE_SANCTIONS_PROVIDER_ID, ['SANCTIONS']);
}

export function fixturePepProviderProfile(): ComplianceProviderCandidateProfile {
  return profile(FIXTURE_PEP_PROVIDER_ID, ['PEP']);
}

export function fixtureAmlProviderProfile(): ComplianceProviderCandidateProfile {
  return profile(FIXTURE_AML_PROVIDER_ID, ['TRANSACTION_MONITORING', 'FRAUD', 'ADVERSE_MEDIA', 'DEVICE_RISK', 'CASE_MANAGEMENT']);
}

function profile(
  providerId: string,
  capabilities: readonly ComplianceProviderCandidateProfile['capabilities'][number][],
): ComplianceProviderCandidateProfile {
  return Object.freeze({
    providerId,
    version: '1.0.0-candidate',
    capabilities: Object.freeze([...capabilities, ...COMPLIANCE_PROVIDER_CAPABILITIES.filter((item) => capabilities.includes(item))]),
    credentialDescriptorRef: `cred-desc:${providerId}:screening_worker`,
    endpointProfileRef: `endpoint:${providerId}:sandbox`,
    supportedJurisdictions: Object.freeze(['GB', 'US-SIM']),
    providerAcceptanceRef: null,
    dataProcessingAgreementRef: null,
    securityEvidenceRef: null,
    jurisdictionEvidenceRef: null,
    retentionPolicyRef: 'retention:normalized-result',
    residency: Object.freeze({
      supportedRegion: 'eu-west-sim',
      deployedRegion: 'eu-west-sim',
      configuredResidencyConstraint: 'EU_SIMULATION_ONLY',
      dataClass: 'COMPLIANCE_METADATA',
      dpaRef: null,
      jurisdictionReviewRef: null,
      cloudRegionDoesNotProveAdequacy: true,
    }),
    retentionDefault: 'NORMALIZED_RESULT',
    productionAuthorized: false,
    liveVendorConnected: false,
  });
}
