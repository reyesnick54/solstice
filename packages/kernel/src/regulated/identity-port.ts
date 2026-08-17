import type { UtcInstant } from '../../../domain/src/time.ts';
import type { IdentityFacts } from '../../../identity/src/facts.ts';
import type { KycVerificationLevel, KycVerificationState } from '../../../identity/src/kyc.ts';
import type { IdentityStatus } from '../../../identity/src/model.ts';

/**
 * Provider-neutral KYC/identity port. External vendor payloads stop here.
 * The adapter emits IdentityFacts for the existing Compliance Kernel.
 * It cannot issue Execution Authority.
 */
export type IdentityKycProviderRequest = {
  readonly subjectRef: string;
  readonly actorId: string;
  readonly jurisdiction: string;
  readonly now: UtcInstant;
};

export type IdentityKycProviderResponse = {
  readonly available: boolean;
  readonly providerRef: string;
  readonly providerHash: string;
  readonly outcome: 'PASS' | 'REVIEW' | 'FAIL' | 'UNAVAILABLE';
  readonly kycState: KycVerificationState;
  readonly kycLevel: KycVerificationLevel;
  readonly identityStatus: IdentityStatus;
  readonly evidenceRefs: readonly string[];
  readonly reasonCodes: readonly string[];
  readonly rawVendorSecretPresent: false;
};

export type IdentityKycProviderPort = {
  verify(request: IdentityKycProviderRequest): IdentityKycProviderResponse;
};

export function toIdentityFacts(
  request: IdentityKycProviderRequest,
  response: IdentityKycProviderResponse,
): IdentityFacts {
  const verified = response.available && response.outcome === 'PASS' && response.kycState === 'VERIFIED';
  return Object.freeze({
    identityExists: response.available && response.outcome !== 'FAIL',
    identityStatus: response.available ? response.identityStatus : null,
    subjectId: request.subjectRef,
    actorId: request.actorId,
    actorSubjectMatch: true,
    authenticated: verified,
    sessionValid: verified,
    authenticationAssurance: verified ? 'HIGH_ASSURANCE' : null,
    kycState: response.available ? response.kycState : null,
    kycLevel: response.available ? response.kycLevel : null,
    kycFresh: verified,
    kycVersion: verified ? 1 : null,
    customerId: null,
    authorizedCapabilities: Object.freeze([]),
  });
}

export function identityPortIssuesExecutionAuthority(): false {
  return false;
}
