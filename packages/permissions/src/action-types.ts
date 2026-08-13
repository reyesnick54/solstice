import type { AccountClass } from '../../domain/src/account-class.ts';
import type { AccountId } from '../../domain/src/account.ts';
import type { CurrencyCode } from '../../domain/src/currency.ts';
import type { CustomerId } from '../../domain/src/customer.ts';
import type { Jurisdiction } from '../../domain/src/jurisdiction.ts';
import type { LegalEntityId } from '../../domain/src/legal-entity.ts';
import type { ProductId } from '../../domain/src/product.ts';
import type { Money } from '../../money/src/money.ts';
import type { ActionIntent } from './action-intent.ts';

/**
 * How an actionType is declared: add a key to ACTION_TYPES, a payload
 * interface, and an intent alias that uses the ActionIntent envelope.
 * Do not invent a parallel intent shape.
 */
export const ACTION_TYPES = {
  OPEN_ACCOUNT: 'OPEN_ACCOUNT',
  POST_DEPOSIT: 'POST_DEPOSIT',
  POST_WITHDRAWAL: 'POST_WITHDRAWAL',
  INTERNAL_TRANSFER: 'INTERNAL_TRANSFER',
} as const;

export type ActionType = (typeof ACTION_TYPES)[keyof typeof ACTION_TYPES];

export type OpenAccountPayload = {
  readonly accountId: AccountId;
  readonly ownerId: CustomerId;
  readonly productId: ProductId;
  readonly accountClass: AccountClass;
  readonly legalEntityId: LegalEntityId;
  readonly jurisdiction: Jurisdiction;
  readonly currency: CurrencyCode;
};

export type PostDepositPayload = {
  readonly accountId: AccountId;
  readonly amount: Money;
};

export type PostWithdrawalPayload = {
  readonly accountId: AccountId;
  readonly amount: Money;
};

export type InternalTransferPayload = {
  readonly sourceAccountId: AccountId;
  readonly destinationAccountId: AccountId;
  readonly amount: Money;
};

export type OpenAccountIntent = ActionIntent<OpenAccountPayload> & {
  readonly actionType: typeof ACTION_TYPES.OPEN_ACCOUNT;
};

export type PostDepositIntent = ActionIntent<PostDepositPayload> & {
  readonly actionType: typeof ACTION_TYPES.POST_DEPOSIT;
};

export type PostWithdrawalIntent = ActionIntent<PostWithdrawalPayload> & {
  readonly actionType: typeof ACTION_TYPES.POST_WITHDRAWAL;
};

export type InternalTransferIntent = ActionIntent<InternalTransferPayload> & {
  readonly actionType: typeof ACTION_TYPES.INTERNAL_TRANSFER;
};

export type BankingIntent =
  | OpenAccountIntent
  | PostDepositIntent
  | PostWithdrawalIntent
  | InternalTransferIntent;
