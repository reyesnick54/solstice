import type { CustomerId } from './customer.ts';
import type { CurrencyCode } from './currency.ts';
import type { AccountId } from './ids.ts';
import type { UtcInstant } from './time.ts';

export const ACCOUNT_CLASSES = [
  'deposits',
  'investments',
  'digital_assets',
  'rewards',
  'pending',
  'house_nostro',
  'house_fx',
  'settlement_clearing',
  'rail_clearing',
] as const;

export type AccountClass = (typeof ACCOUNT_CLASSES)[number];

export type Account = {
  readonly id: AccountId;
  readonly ownerCustomerId: CustomerId | 'HOUSE';
  readonly accountClass: AccountClass;
  readonly currency: CurrencyCode;
  readonly openedAt: UtcInstant;
  readonly version: number;
};

export function createAccount(input: Omit<Account, 'version'> & { version?: number }): Account {
  return Object.freeze({
    id: input.id,
    ownerCustomerId: input.ownerCustomerId,
    accountClass: input.accountClass,
    currency: input.currency,
    openedAt: input.openedAt,
    version: input.version ?? 0,
  });
}
