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
  CREATE_BENEFICIARY: 'CREATE_BENEFICIARY',
  CREATE_FX_QUOTE: 'CREATE_FX_QUOTE',
  ACCEPT_FX_QUOTE: 'ACCEPT_FX_QUOTE',
  INITIATE_PAYMENT: 'INITIATE_PAYMENT',
  CANCEL_PAYMENT: 'CANCEL_PAYMENT',
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

export type CreateBeneficiaryPayload = {
  readonly beneficiaryId: string;
  readonly ownerId: CustomerId;
  readonly accountId: AccountId;
  readonly kind: 'PERSON' | 'BUSINESS';
  readonly destinationCountry: string;
  readonly currency: CurrencyCode;
  readonly legalName: string;
  readonly accountCoordinate: {
    readonly scheme: string;
    readonly value: string;
  };
};

export type CreateFxQuotePayload = {
  readonly quoteId: string;
  readonly accountId: AccountId;
  readonly baseCurrency: CurrencyCode;
  readonly quoteCurrency: CurrencyCode;
  readonly sourceAmount?: Money;
  readonly destinationAmount?: Money;
  readonly corridorId: string;
};

export type AcceptFxQuotePayload = {
  readonly quoteId: string;
  readonly accountId: AccountId;
};

export type InitiatePaymentPayload = {
  readonly paymentId: string;
  readonly accountId: AccountId;
  readonly sourceAccountId: AccountId;
  readonly beneficiaryId: string;
  readonly quoteId: string;
  readonly sourceAmount: Money;
  readonly purposeReference: string;
};

export type CancelPaymentPayload = {
  readonly paymentId: string;
  readonly accountId: AccountId;
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

export type CreateBeneficiaryIntent = ActionIntent<CreateBeneficiaryPayload> & {
  readonly actionType: typeof ACTION_TYPES.CREATE_BENEFICIARY;
};

export type CreateFxQuoteIntent = ActionIntent<CreateFxQuotePayload> & {
  readonly actionType: typeof ACTION_TYPES.CREATE_FX_QUOTE;
};

export type AcceptFxQuoteIntent = ActionIntent<AcceptFxQuotePayload> & {
  readonly actionType: typeof ACTION_TYPES.ACCEPT_FX_QUOTE;
};

export type InitiatePaymentIntent = ActionIntent<InitiatePaymentPayload> & {
  readonly actionType: typeof ACTION_TYPES.INITIATE_PAYMENT;
};

export type CancelPaymentIntent = ActionIntent<CancelPaymentPayload> & {
  readonly actionType: typeof ACTION_TYPES.CANCEL_PAYMENT;
};

export type BankingIntent =
  | OpenAccountIntent
  | PostDepositIntent
  | PostWithdrawalIntent
  | InternalTransferIntent;

export type PaymentIntent =
  | CreateBeneficiaryIntent
  | CreateFxQuoteIntent
  | AcceptFxQuoteIntent
  | InitiatePaymentIntent
  | CancelPaymentIntent;
