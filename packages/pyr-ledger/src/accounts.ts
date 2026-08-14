import type { AccountId, CustomerId, UtcInstant } from '@solstice/domain';
import { PYR_ASSET, PYR_ASSET_CLASS } from './amount.ts';

export const PYR_HOLDER_CLASSES = ['CUSTOMER', 'CORPORATE'] as const;
export type PyrHolderClass = (typeof PYR_HOLDER_CLASSES)[number];

export const PYR_BOOK_ROLES = [
  'WALLET',
  'EARNINGS_CONTRA',
  'TREASURY',
  'COMPENSATION_EXPENSE',
  'ISSUANCE_CONTRA',
] as const;

export type PyrBookRole = (typeof PYR_BOOK_ROLES)[number];

/**
 * PYR account. Balance is never stored; it is summed from journals.
 * Customer and corporate holder classes are disjoint.
 */
export type PyrAccount = {
  readonly id: AccountId;
  readonly holderClass: PyrHolderClass;
  readonly ownerId: CustomerId | 'SOLSTICE_CORPORATE';
  readonly assetClass: typeof PYR_ASSET_CLASS;
  readonly asset: typeof PYR_ASSET;
  readonly role: PyrBookRole;
  readonly jurisdiction: string;
  readonly openedAt: UtcInstant;
};

export function freezePyrAccount(account: PyrAccount): PyrAccount {
  return Object.freeze({ ...account });
}
