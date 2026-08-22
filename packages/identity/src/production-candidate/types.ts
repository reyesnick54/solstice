/**
 * Phase D Prompt 3 — provider-independent identity verification contracts.
 *
 * Extends Chunk 152 fixture adapters. Vendor vocabulary stops here.
 * A provider VERIFIED result is not an account, payment, trade, or
 * Execution Authority. Sandbox verified is never production KYC.
 */

import type { UtcInstant } from '../../../domain/src/time.ts';
import type { SecretReference } from '../../../security/src/secrets.ts';
import type { Jurisdiction } from '../../../domain/src/jurisdiction.ts';
import type { KycVerificationLevel, KycVerificationState } from '../kyc.ts';

export const IDENTITY_ADAPTER_CAPABILITY = 'sunrey-identity-verification-adapters' as const;
export const IDENTITY_ADAPTER_VERSION = 'phase-d-03/1' as const;

export const PROVIDER_LIFECYCLE_STATES = [
  'SIMULATED',
  'SANDBOX',
  'CERTIFICATION',
  'PREPRODUCTION',
  'LIMITED_LIVE',
  'PRODUCTION',
] as const;
export type ProviderLifecycleState = (typeof PROVIDER_LIFECYCLE_STATES)[number];

/**
 * Canonical identity-verification states for the adapter contract.
 * REQUIRES_REVIEW is adapter-layer vocabulary. Persisted KycRecord maps
 * it to IN_PROGRESS plus a REQUIRES_REVIEW reason code so customer and
 * SQL enums stay stable.
 */
export const IDENTITY_VERIFICATION_STATES = [
  'NOT_STARTED',
  'IN_PROGRESS',
  'VERIFIED',
  'REQUIRES_REVIEW',
  'FAILED',
  'EXPIRED',
] as const;
export type IdentityVerificationState = (typeof IDENTITY_VERIFICATION_STATES)[number];

export const IDENTITY_VERIFICATION_CLIENT_STATES = [
  'NOT_STARTED',
  'IN_PROGRESS',
  'ACTION_REQUIRED',
  'VERIFIED',
  'REVIEW',
] as const;
export type IdentityVerificationClientState = (typeof IDENTITY_VERIFICATION_CLIENT_STATES)[number];

export const DOCUMENT_TYPES = [
  'PASSPORT',
  'NATIONAL_ID',
  'DRIVERS_LICENSE',
  'RESIDENCE_PERMIT',
  'COMPANY_REGISTRATION',
  'OTHER',
] as const;
export type DocumentType = (typeof DOCUMENT_TYPES)[number];

export const DOCUMENT_AUTHENTICITY = [
  'AUTHENTIC',
  'INCONCLUSIVE',
  'FAILED',
  'NOT_EVALUATED',
] as const;
export type DocumentAuthenticity = (typeof DOCUMENT_AUTHENTICITY)[number];

export const KYB_VERIFICATION_STATES = [
  'NOT_STARTED',
  'IN_PROGRESS',
  'VERIFIED',
  'REQUIRES_REVIEW',
  'FAILED',
  'EXPIRED',
] as const;
export type KybVerificationState = (typeof KYB_VERIFICATION_STATES)[number];

export const IDENTITY_ADAPTER_CAPABILITIES = [
  'IDENTITY_VERIFICATION',
  'DOCUMENT_VERIFICATION',
  'KYC',
  'KYB',
  'BENEFICIAL_OWNERSHIP',
  'ONGOING_MONITORING',
] as const;
export type IdentityAdapterCapability = (typeof IDENTITY_ADAPTER_CAPABILITIES)[number];

export type IdentityAdapterFlags = {
  readonly productionAuthorized: false;
  readonly productionActive: false;
  readonly liveVendorConnected: false;
  readonly sandboxVerifiedIsProductionKyc: false;
  readonly providerResultIsKernelDecision: false;
  readonly adapterCanOpenAccount: false;
  readonly adapterCanIssueExecutionAuthority: false;
};

export const IDENTITY_ADAPTER_FLAGS: IdentityAdapterFlags = Object.freeze({
  productionAuthorized: false,
  productionActive: false,
  liveVendorConnected: false,
  sandboxVerifiedIsProductionKyc: false,
  providerResultIsKernelDecision: false,
  adapterCanOpenAccount: false,
  adapterCanIssueExecutionAuthority: false,
});

export type IdentityAdapterProfile = {
  readonly providerId: string;
  readonly version: string;
  readonly lifecycle: ProviderLifecycleState;
  readonly environment: 'SIMULATION' | 'SANDBOX' | 'CERTIFICATION';
  readonly capabilities: readonly IdentityAdapterCapability[];
  readonly health: 'HEALTHY' | 'DEGRADED' | 'UNAVAILABLE';
  readonly certified: boolean;
  readonly credentialRef: SecretReference | null;
  readonly supportedJurisdictions: readonly string[];
  readonly dataProcessingAgreementRef: string | null;
  readonly retentionPolicyRef: string | null;
  readonly productionAuthorized: false;
  readonly liveVendorConnected: false;
};

export type IdentityApplicant = {
  readonly applicantId: string;
  readonly identityId: string;
  readonly providerRef: string;
  readonly createdAt: UtcInstant;
  readonly jurisdiction: Jurisdiction;
};

export type IdentityVerificationRecord = {
  readonly verificationId: string;
  readonly applicantId: string;
  readonly identityId: string;
  readonly providerRef: string;
  readonly state: IdentityVerificationState;
  readonly level: KycVerificationLevel;
  readonly environment: IdentityAdapterProfile['environment'];
  readonly reasonCodes: readonly string[];
  readonly evidenceRefs: readonly string[];
  readonly providerEvidenceRef: string | null;
  readonly observedAt: UtcInstant;
  readonly expiresAt: UtcInstant | null;
  readonly sandboxOnly: boolean;
  readonly isProductionKyc: false;
};

export type DocumentVerificationRecord = {
  readonly documentRef: string;
  readonly providerRef: string;
  readonly documentType: DocumentType;
  readonly country: string;
  readonly authenticity: DocumentAuthenticity;
  readonly expired: boolean;
  readonly nameMatch: boolean | null;
  readonly dateMatch: boolean | null;
  readonly storageRef: string | null;
  readonly imageRetained: false;
  readonly reasonCodes: readonly string[];
  readonly observedAt: UtcInstant;
};

export type KybRecord = {
  readonly kybId: string;
  readonly businessId: string;
  readonly registrationRef: string | null;
  readonly jurisdiction: Jurisdiction;
  readonly state: KybVerificationState;
  readonly providerRef: string;
  readonly beneficialOwnerRefs: readonly string[];
  readonly directorRefs: readonly string[];
  readonly documentRefs: readonly string[];
  readonly businessRisk: 'LOW' | 'STANDARD' | 'ELEVATED' | 'HIGH' | 'UNKNOWN';
  readonly ongoingMonitoring: boolean;
  readonly reasonCodes: readonly string[];
  readonly evidenceRefs: readonly string[];
  readonly observedAt: UtcInstant;
  readonly isIndividualKyc: false;
};

export function toPersistedKycState(state: IdentityVerificationState): KycVerificationState {
  if (state === 'REQUIRES_REVIEW') {
    return 'IN_PROGRESS';
  }
  return state;
}

export function sandboxVerifiedIsProductionKyc(): false {
  return false;
}

export function providerVerifiedOpensAccount(): false {
  return false;
}

export function providerVerifiedIssuesExecutionAuthority(): false {
  return false;
}
