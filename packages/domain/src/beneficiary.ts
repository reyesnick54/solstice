import type { CustomerId } from './customer.ts';
import type { CurrencyCode } from './currency.ts';
import type { Jurisdiction } from './jurisdiction.ts';
import type { BeneficiaryId } from './ids.ts';
import type { UtcInstant } from './time.ts';

export const BENEFICIARY_VERIFICATION_STATES = [
  'UNVERIFIED',
  'PENDING',
  'VERIFIED',
  'FAILED',
] as const;

export type BeneficiaryVerificationState = (typeof BENEFICIARY_VERIFICATION_STATES)[number];

export type InstitutionIdentifiers = {
  readonly iban?: string;
  readonly bic?: string;
  readonly routingNumber?: string;
  readonly accountNumber?: string;
  readonly institutionName?: string;
};

export type Beneficiary = {
  readonly id: BeneficiaryId;
  readonly ownerCustomerId: CustomerId;
  readonly name: string;
  readonly country: Jurisdiction;
  readonly institution: InstitutionIdentifiers;
  readonly currency: CurrencyCode;
  readonly verificationState: BeneficiaryVerificationState;
  readonly version: number;
  readonly createdAt: UtcInstant;
  readonly updatedAt: UtcInstant;
};

export type BeneficiaryDraft = {
  readonly id: BeneficiaryId;
  readonly ownerCustomerId: CustomerId;
  readonly name: string;
  readonly country: Jurisdiction;
  readonly institution: InstitutionIdentifiers;
  readonly currency: CurrencyCode;
};

export function freezeBeneficiary(input: Beneficiary): Beneficiary {
  return Object.freeze({
    id: input.id,
    ownerCustomerId: input.ownerCustomerId,
    name: input.name,
    country: input.country,
    institution: Object.freeze({ ...input.institution }),
    currency: input.currency,
    verificationState: input.verificationState,
    version: input.version,
    createdAt: input.createdAt,
    updatedAt: input.updatedAt,
  });
}
