import type { CurrencyCode } from '../../domain/src/currency.ts';
import type { CustomerId } from '../../domain/src/customer.ts';
import type { UtcInstant } from '../../domain/src/time.ts';
import type { BeneficiaryId, ScreeningRef } from './ids.ts';

export const BENEFICIARY_KINDS = ['PERSON', 'BUSINESS'] as const;
export type BeneficiaryKind = (typeof BENEFICIARY_KINDS)[number];

export const BENEFICIARY_STATUSES = [
  'PENDING',
  'ACTIVE',
  'REVIEW',
  'BLOCKED',
  'DISABLED',
] as const;
export type BeneficiaryStatus = (typeof BENEFICIARY_STATUSES)[number];

/**
 * Account coordinates are stored as a hash plus a display hint.
 * Raw bank details never appear on the persisted beneficiary, events, or evidence.
 */
export type AccountCoordinateRef = {
  readonly scheme: string;
  readonly coordinateRef: string;
  readonly displayHint: string;
};

export type Beneficiary = {
  readonly beneficiaryId: BeneficiaryId;
  readonly ownerId: CustomerId;
  readonly kind: BeneficiaryKind;
  readonly destinationCountry: string;
  readonly currency: CurrencyCode;
  readonly legalName: string;
  readonly accountCoordinate: AccountCoordinateRef;
  readonly screeningStatus: 'NOT_SCREENED' | 'CLEAR' | 'PEP' | 'SANCTIONED' | 'FRAUD';
  readonly screeningRef: ScreeningRef | null;
  readonly status: BeneficiaryStatus;
  readonly createdAt: UtcInstant;
};

export function freezeBeneficiary(beneficiary: Beneficiary): Beneficiary {
  return Object.freeze({
    ...beneficiary,
    accountCoordinate: Object.freeze({ ...beneficiary.accountCoordinate }),
  });
}

export function isUsableBeneficiary(beneficiary: Beneficiary): boolean {
  return beneficiary.status === 'ACTIVE' && beneficiary.screeningStatus === 'CLEAR';
}
