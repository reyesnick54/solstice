import type { DataPurpose, LegalBasis, PersonalDataCategory } from '@solstice/kernel';

export const IDENTITY_EXPOSURE_LEVELS = ['identified', 'pseudonymous', 'anonymous'] as const;
export type IdentityExposureLevel = (typeof IDENTITY_EXPOSURE_LEVELS)[number];

export const CONSENT_STATUSES = ['ACTIVE', 'REVOKED', 'SUPERSEDED'] as const;
export type ConsentStatus = (typeof CONSENT_STATUSES)[number];

export type ConsentCompensation = {
  readonly indicativeMinorUnits: bigint;
  readonly currency: string;
  readonly presentation: 'INDICATIVE_COMPENSATION_NOT_A_PRICE';
};

export type ConsentRecord = {
  readonly consentId: string;
  readonly subjectRef: string;
  readonly requesterId: string;
  readonly purpose: DataPurpose;
  readonly dataCategories: readonly PersonalDataCategory[];
  readonly identityExposureLevel: IdentityExposureLevel;
  readonly start: string;
  readonly expiry: string;
  readonly resalePermission: boolean;
  readonly aiTrainingPermission: boolean;
  readonly compensation: ConsentCompensation;
  readonly revocability: boolean;
  readonly jurisdiction: string;
  readonly status: ConsentStatus;
  readonly policyVersion: string;
  readonly versionNumber: number;
  readonly legalBasis: LegalBasis;
  readonly priorVersionNumber: number | null;
};

export type ConsentGrantInput = Omit<
  ConsentRecord,
  'status' | 'versionNumber' | 'priorVersionNumber'
>;

export type ConsentModifyInput = {
  readonly consentId: string;
  readonly changes: Partial<
    Pick<
      ConsentRecord,
      | 'purpose'
      | 'dataCategories'
      | 'identityExposureLevel'
      | 'expiry'
      | 'resalePermission'
      | 'aiTrainingPermission'
      | 'compensation'
      | 'jurisdiction'
      | 'policyVersion'
      | 'legalBasis'
    >
  >;
};

export function isIdentityExposureLevel(value: unknown): value is IdentityExposureLevel {
  return typeof value === 'string' && (IDENTITY_EXPOSURE_LEVELS as readonly string[]).includes(value);
}
