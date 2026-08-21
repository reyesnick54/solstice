import { secretRef } from '../../../../security/src/secrets.ts';
import type { ComplianceAdapterProfile, FraudRecommendedAction, ProviderMatchState } from './types.ts';

export const SANDBOX_COMPLIANCE_PROVIDER_ID = 'sandbox-compliance-adapter' as const;

export function sandboxComplianceProfile(): ComplianceAdapterProfile {
  return Object.freeze({
    providerId: SANDBOX_COMPLIANCE_PROVIDER_ID,
    version: 'phase-d-03/1',
    lifecycle: 'SANDBOX',
    environment: 'SANDBOX',
    capabilities: Object.freeze(['SANCTIONS', 'PEP', 'ADVERSE_MEDIA', 'AML', 'FRAUD', 'BLOCKCHAIN_RISK'] as const),
    health: 'HEALTHY',
    certified: false,
    credentialRef: secretRef('simulation', 'screening-worker-credential'),
    supportedJurisdictions: Object.freeze(['GB', 'US', 'AE', 'SA']),
    dataProcessingAgreementRef: null,
    retentionPolicyRef: 'retention:normalized-result',
    productionAuthorized: false,
    liveVendorConnected: false,
  });
}

export function unavailableComplianceProfile(): ComplianceAdapterProfile {
  return Object.freeze({
    ...sandboxComplianceProfile(),
    providerId: 'sandbox-compliance-unavailable',
    health: 'UNAVAILABLE',
  });
}

export function sanctionsMatchFor(subjectRef: string): ProviderMatchState {
  if (subjectRef.includes('unavailable')) return 'UNAVAILABLE';
  if (subjectRef.includes('confirmed') || subjectRef.includes('sanctions_match')) return 'CONFIRMED_MATCH';
  if (subjectRef.includes('possible') || subjectRef.includes('sanctions')) return 'POSSIBLE_MATCH';
  if (subjectRef.includes('review')) return 'REQUIRES_REVIEW';
  return 'NO_MATCH';
}

export function pepMatchFor(subjectRef: string): ProviderMatchState {
  if (subjectRef.includes('pep')) return 'POSSIBLE_MATCH';
  return 'NO_MATCH';
}

export function adverseMediaMatchFor(subjectRef: string): ProviderMatchState {
  if (subjectRef.includes('media') || subjectRef.includes('adverse')) return 'POSSIBLE_MATCH';
  return 'NO_MATCH';
}

export function amlAlertFor(subjectRef: string): boolean {
  return subjectRef.includes('aml') || subjectRef.includes('alert');
}

export function fraudActionFor(subjectRef: string): FraudRecommendedAction {
  if (subjectRef.includes('fraud') || subjectRef.includes('high-risk') || subjectRef.includes('high_risk')) {
    return 'HOLD';
  }
  return 'ALLOW';
}
