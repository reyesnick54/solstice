import type { Jurisdiction } from '../../../domain/src/jurisdiction.ts';
import type { SecretReference } from '../../../security/src/secrets.ts';
import type { RegulatedServiceMode } from './modes.ts';

export const REGULATED_PROVIDER_SERVICE_CLASSES = [
  'IDENTITY_KYC',
  'SANCTIONS_PEP',
  'AML_TRANSACTION_MONITORING',
  'FRAUD_RISK',
  'TRAVEL_RULE',
  'CUSTODY_HSM',
  'QUALIFIED_CUSTODY_REFERENCE',
  'MARKET_SURVEILLANCE',
  'CASE_MANAGEMENT',
  'FIAT_BANKING_REFERENCE',
] as const;
export type RegulatedProviderServiceClass = (typeof REGULATED_PROVIDER_SERVICE_CLASSES)[number];

export const PROVIDER_HEALTH_STATES = [
  'HEALTHY',
  'DEGRADED',
  'UNAVAILABLE',
  'UNKNOWN',
] as const;
export type ProviderHealthState = (typeof PROVIDER_HEALTH_STATES)[number];

export const ACTIVATION_ELIGIBILITY_STATES = [
  'INELIGIBLE',
  'SANDBOX_ONLY',
  'INTEGRATION_TEST_ONLY',
  'EVIDENCE_INCOMPLETE',
  'PRODUCTION_CANDIDATE_DISABLED',
] as const;
export type ActivationEligibility = (typeof ACTIVATION_ELIGIBILITY_STATES)[number];

export const EVIDENCE_COMPLETENESS = [
  'MISSING',
  'REFERENCED_UNVERIFIED',
  'ENGINEERING_RECORDED',
  'EXTERNAL_VERIFICATION_REQUIRED',
] as const;
export type EvidenceCompleteness = (typeof EVIDENCE_COMPLETENESS)[number];

export type ProviderEvidenceSlot = {
  readonly slot: string;
  readonly completeness: EvidenceCompleteness;
  readonly reference: string | null;
  readonly notes: string;
  readonly claimsApproval: false;
};

export type RegulatedServiceProvider = {
  readonly providerId: string;
  readonly serviceClass: RegulatedProviderServiceClass;
  readonly jurisdiction: Jurisdiction;
  readonly endpointConfigRef: string;
  readonly credentialRef: SecretReference;
  readonly contractEvidence: ProviderEvidenceSlot;
  readonly licenseRegistrationEvidence: ProviderEvidenceSlot;
  readonly securityReviewEvidence: ProviderEvidenceSlot;
  readonly dataProcessingPrivacyEvidence: ProviderEvidenceSlot;
  readonly supportedCapabilities: readonly string[];
  readonly environment: RegulatedServiceMode;
  readonly health: ProviderHealthState;
  readonly activationEligibility: ActivationEligibility;
  readonly qualifiedOrApprovedClaim: false;
};

export function emptyEvidenceSlot(slot: string, notes: string): ProviderEvidenceSlot {
  return Object.freeze({
    slot,
    completeness: 'MISSING',
    reference: null,
    notes,
    claimsApproval: false,
  });
}

export function providerMayActivateLive(_provider: RegulatedServiceProvider): false {
  return false;
}
