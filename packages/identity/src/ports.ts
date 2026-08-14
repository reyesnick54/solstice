import type { UtcInstant } from '../../domain/src/time.ts';
import type { BusinessIdentity } from './model.ts';
import type { KycRecord } from './kyc.ts';
import type { DeviceRiskProvider } from './auth.ts';

export type IdentityVerificationResult = {
  readonly providerRef: string;
  readonly outcome: 'VERIFIED' | 'FAILED' | 'IN_PROGRESS';
  readonly reasonCodes: readonly string[];
  readonly evidenceRefs: readonly string[];
  readonly observedAt: UtcInstant;
};

export type IdentityVerificationProvider = {
  verifyPerson(identityId: string, now: UtcInstant): IdentityVerificationResult;
};

export type DocumentVerificationProvider = {
  verifyDocument(documentRef: string, now: UtcInstant): IdentityVerificationResult;
};

export type LivenessVerificationProvider = {
  verifyLiveness(sessionRef: string, now: UtcInstant): IdentityVerificationResult;
};

export type BusinessVerificationProvider = {
  verifyBusiness(business: BusinessIdentity, now: UtcInstant): IdentityVerificationResult;
};

export type BeneficialOwnershipProvider = {
  lookupBeneficialOwners(registrationRef: string, now: UtcInstant): {
    readonly ownerRefs: readonly string[];
    readonly providerRef: string;
    readonly observedAt: UtcInstant;
  };
};

export type IdentityProviderPorts = {
  readonly identityVerification: IdentityVerificationProvider;
  readonly documentVerification: DocumentVerificationProvider;
  readonly liveness: LivenessVerificationProvider;
  readonly businessVerification: BusinessVerificationProvider;
  readonly beneficialOwnership: BeneficialOwnershipProvider;
  readonly deviceRisk: DeviceRiskProvider;
};

export type KycRecordWriter = {
  record(record: KycRecord): void;
};
