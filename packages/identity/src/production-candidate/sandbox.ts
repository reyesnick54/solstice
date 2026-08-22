import { secretRef } from '../../../security/src/secrets.ts';
import type { IdentityAdapterProfile, IdentityVerificationState, KybVerificationState } from './types.ts';

export const SANDBOX_IDENTITY_PROVIDER_ID = 'sandbox-identity-adapter' as const;

export const IDENTITY_SANDBOX_SCENARIOS = [
  'verified_customer',
  'verification_pending',
  'document_failure',
  'requires_review',
  'expired',
  'provider_unavailable',
] as const;
export type IdentitySandboxScenario = (typeof IDENTITY_SANDBOX_SCENARIOS)[number];

export function sandboxIdentityProfile(): IdentityAdapterProfile {
  return Object.freeze({
    providerId: SANDBOX_IDENTITY_PROVIDER_ID,
    version: 'phase-d-03/1',
    lifecycle: 'SANDBOX',
    environment: 'SANDBOX',
    capabilities: Object.freeze(['IDENTITY_VERIFICATION', 'DOCUMENT_VERIFICATION', 'KYC', 'KYB', 'ONGOING_MONITORING'] as const),
    health: 'HEALTHY',
    certified: false,
    credentialRef: secretRef('simulation', 'kyc-worker-credential'),
    supportedJurisdictions: Object.freeze(['GB', 'US', 'AE', 'SA']),
    dataProcessingAgreementRef: null,
    retentionPolicyRef: 'retention:reference-only',
    productionAuthorized: false,
    liveVendorConnected: false,
  });
}

export function identityStateForSubject(identityId: string): IdentityVerificationState {
  if (identityId.includes('pending')) return 'IN_PROGRESS';
  if (identityId.includes('review')) return 'REQUIRES_REVIEW';
  if (identityId.includes('fail') || identityId.includes('document')) return 'FAILED';
  if (identityId.includes('expired')) return 'EXPIRED';
  if (identityId.includes('unavailable')) return 'FAILED';
  if (identityId.includes('verified') || identityId.includes('ok')) return 'VERIFIED';
  return 'IN_PROGRESS';
}

export function kybStateForBusiness(businessId: string): KybVerificationState {
  if (businessId.includes('review')) return 'REQUIRES_REVIEW';
  if (businessId.includes('fail')) return 'FAILED';
  if (businessId.includes('verified') || businessId.includes('ok')) return 'VERIFIED';
  return 'IN_PROGRESS';
}

export function documentAuthenticityFor(documentRef: string) {
  if (documentRef.includes('fail') || documentRef.includes('document_failure')) return 'FAILED' as const;
  if (documentRef.includes('review')) return 'INCONCLUSIVE' as const;
  return 'AUTHENTIC' as const;
}
