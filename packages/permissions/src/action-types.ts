import type { AccountClass } from '../../domain/src/account-class.ts';
import type { AccountId } from '../../domain/src/account.ts';
import type { CurrencyCode } from '../../domain/src/currency.ts';
import type { CustomerId } from '../../domain/src/customer.ts';
import type { HoldId, HoldPurpose } from '../../domain/src/hold.ts';
import type { InterestRateVersionId } from '../../domain/src/interest.ts';
import type { Jurisdiction } from '../../domain/src/jurisdiction.ts';
import type { LegalEntityId } from '../../domain/src/legal-entity.ts';
import type { PendingSettlementId } from '../../domain/src/pending-settlement.ts';
import type { ProductId } from '../../domain/src/product.ts';
import type { UtcInstant } from '../../domain/src/time.ts';
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
  CREATE_HOLD: 'CREATE_HOLD',
  RELEASE_HOLD: 'RELEASE_HOLD',
  CAPTURE_HOLD: 'CAPTURE_HOLD',
  CANCEL_HOLD: 'CANCEL_HOLD',
  POST_FEE: 'POST_FEE',
  POST_REVERSAL: 'POST_REVERSAL',
  POST_INTEREST: 'POST_INTEREST',
  INITIATE_PENDING_SETTLEMENT: 'INITIATE_PENDING_SETTLEMENT',
  SETTLE_PENDING: 'SETTLE_PENDING',
  RETURN_PENDING: 'RETURN_PENDING',
  REQUEST_CARD: 'REQUEST_CARD',
  ACTIVATE_CARD: 'ACTIVATE_CARD',
  FREEZE_CARD: 'FREEZE_CARD',
  UNFREEZE_CARD: 'UNFREEZE_CARD',
  CLOSE_CARD: 'CLOSE_CARD',
  UPDATE_CARD_CONTROLS: 'UPDATE_CARD_CONTROLS',
  AUTHORIZE_CARD_PURCHASE: 'AUTHORIZE_CARD_PURCHASE',
  REVERSE_CARD_AUTHORIZATION: 'REVERSE_CARD_AUTHORIZATION',
  CLEAR_CARD_TRANSACTION: 'CLEAR_CARD_TRANSACTION',
  REFUND_CARD_TRANSACTION: 'REFUND_CARD_TRANSACTION',
  OPEN_CARD_DISPUTE: 'OPEN_CARD_DISPUTE',
  DECIDE_CARD_DISPUTE: 'DECIDE_CARD_DISPUTE',
  ASSESS_CARD_FEE: 'ASSESS_CARD_FEE',
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

export type CreateHoldPayload = {
  readonly holdId: HoldId;
  readonly accountId: AccountId;
  readonly amount: Money;
  readonly holdPurpose: HoldPurpose;
  readonly expiresAt?: UtcInstant;
};

export type HoldLifecyclePayload = {
  readonly holdId: HoldId;
  readonly accountId: AccountId;
};

export type PostFeePayload = {
  readonly accountId: AccountId;
  readonly amount: Money;
  readonly feeType: 'FIXED' | 'BASIS_POINTS';
  readonly basisPointsNumerator?: bigint;
  readonly basisPointsDenominator?: bigint;
};

export type PostReversalPayload = {
  readonly accountId: AccountId;
  readonly originalJournalId: string;
  readonly reason: string;
};

export type PostInterestPayload = {
  readonly accountId: AccountId;
  readonly amount: Money;
  readonly rateVersionId: InterestRateVersionId;
  readonly periodStart: UtcInstant;
  readonly periodEnd: UtcInstant;
};

export type InitiatePendingSettlementPayload = {
  readonly pendingId: PendingSettlementId;
  readonly sourceAccountId: AccountId;
  readonly pendingAccountId: AccountId;
  readonly amount: Money;
};

export type PendingSettlementLifecyclePayload = {
  readonly pendingId: PendingSettlementId;
  readonly sourceAccountId: AccountId;
  readonly pendingAccountId: AccountId;
};

export type CreateHoldIntent = ActionIntent<CreateHoldPayload> & {
  readonly actionType: typeof ACTION_TYPES.CREATE_HOLD;
};

export type ReleaseHoldIntent = ActionIntent<HoldLifecyclePayload> & {
  readonly actionType: typeof ACTION_TYPES.RELEASE_HOLD;
};

export type CaptureHoldIntent = ActionIntent<HoldLifecyclePayload> & {
  readonly actionType: typeof ACTION_TYPES.CAPTURE_HOLD;
};

export type CancelHoldIntent = ActionIntent<HoldLifecyclePayload> & {
  readonly actionType: typeof ACTION_TYPES.CANCEL_HOLD;
};

export type PostFeeIntent = ActionIntent<PostFeePayload> & {
  readonly actionType: typeof ACTION_TYPES.POST_FEE;
};

export type PostReversalIntent = ActionIntent<PostReversalPayload> & {
  readonly actionType: typeof ACTION_TYPES.POST_REVERSAL;
};

export type PostInterestIntent = ActionIntent<PostInterestPayload> & {
  readonly actionType: typeof ACTION_TYPES.POST_INTEREST;
};

export type InitiatePendingSettlementIntent = ActionIntent<InitiatePendingSettlementPayload> & {
  readonly actionType: typeof ACTION_TYPES.INITIATE_PENDING_SETTLEMENT;
};

export type SettlePendingIntent = ActionIntent<PendingSettlementLifecyclePayload> & {
  readonly actionType: typeof ACTION_TYPES.SETTLE_PENDING;
};

export type ReturnPendingIntent = ActionIntent<PendingSettlementLifecyclePayload> & {
  readonly actionType: typeof ACTION_TYPES.RETURN_PENDING;
};

export type BankingIntent =
  | OpenAccountIntent
  | PostDepositIntent
  | PostWithdrawalIntent
  | InternalTransferIntent
  | CreateHoldIntent
  | ReleaseHoldIntent
  | CaptureHoldIntent
  | CancelHoldIntent
  | PostFeeIntent
  | PostReversalIntent
  | PostInterestIntent
  | InitiatePendingSettlementIntent
  | SettlePendingIntent
  | ReturnPendingIntent;

export type PaymentIntent =
  | CreateBeneficiaryIntent
  | CreateFxQuoteIntent
  | AcceptFxQuoteIntent
  | InitiatePaymentIntent
  | CancelPaymentIntent;

export type RequestCardPayload = {
  readonly cardId: string;
  readonly accountId: AccountId;
  readonly ownerId: CustomerId;
  readonly programId: string;
  readonly formFactor: 'VIRTUAL' | 'PHYSICAL';
};

export type CardLifecyclePayload = {
  readonly cardId: string;
  readonly accountId: AccountId;
};

export type UpdateCardControlsPayload = {
  readonly cardId: string;
  readonly accountId: AccountId;
  readonly controls: {
    readonly frozen?: boolean;
    readonly transactionAmountLimitMinor?: bigint | null;
    readonly dailyAmountLimitMinor?: bigint | null;
    readonly blockedMerchantCategories?: readonly string[];
    readonly allowedMerchantCategories?: readonly string[] | null;
    readonly blockedCountries?: readonly string[];
    readonly allowedCountries?: readonly string[] | null;
    readonly ecommerceEnabled?: boolean;
    readonly cashAtmEnabled?: boolean;
    readonly contactlessEnabled?: boolean;
  };
};

export type AuthorizeCardPurchasePayload = {
  readonly cardId: string;
  readonly accountId: AccountId;
  readonly authorizationId: string;
  readonly amount: Money;
  readonly merchantCategory: string;
  readonly country: string;
  readonly processorReference: string;
};

export type ReverseCardAuthorizationPayload = {
  readonly cardId: string;
  readonly accountId: AccountId;
  readonly authorizationId: string;
};

export type ClearCardTransactionPayload = {
  readonly cardId: string;
  readonly accountId: AccountId;
  readonly clearingId: string;
  readonly authorizationId?: string;
  readonly amount: Money;
  readonly processorReference: string;
};

export type RefundCardTransactionPayload = {
  readonly cardId: string;
  readonly accountId: AccountId;
  readonly refundId: string;
  readonly originalClearingId?: string;
  readonly amount: Money;
  readonly processorReference: string;
};

export type OpenCardDisputePayload = {
  readonly cardId: string;
  readonly accountId: AccountId;
  readonly disputeId: string;
  readonly transactionRef: string;
  readonly reasonCategory: string;
  readonly amount: Money;
};

export type DecideCardDisputePayload = {
  readonly cardId: string;
  readonly accountId: AccountId;
  readonly disputeId: string;
  readonly outcome: 'WON' | 'LOST' | 'CLOSED';
};

export type AssessCardFeePayload = {
  readonly cardId: string;
  readonly accountId: AccountId;
  readonly feeType: 'PROGRAM_FEE' | 'FOREIGN_TRANSACTION_FEE' | 'ATM_FEE' | 'REPLACEMENT_FEE';
  readonly amount: Money;
};

export type RequestCardIntent = ActionIntent<RequestCardPayload> & {
  readonly actionType: typeof ACTION_TYPES.REQUEST_CARD;
};

export type ActivateCardIntent = ActionIntent<CardLifecyclePayload> & {
  readonly actionType: typeof ACTION_TYPES.ACTIVATE_CARD;
};

export type FreezeCardIntent = ActionIntent<CardLifecyclePayload> & {
  readonly actionType: typeof ACTION_TYPES.FREEZE_CARD;
};

export type UnfreezeCardIntent = ActionIntent<CardLifecyclePayload> & {
  readonly actionType: typeof ACTION_TYPES.UNFREEZE_CARD;
};

export type CloseCardIntent = ActionIntent<CardLifecyclePayload> & {
  readonly actionType: typeof ACTION_TYPES.CLOSE_CARD;
};

export type UpdateCardControlsIntent = ActionIntent<UpdateCardControlsPayload> & {
  readonly actionType: typeof ACTION_TYPES.UPDATE_CARD_CONTROLS;
};

export type AuthorizeCardPurchaseIntent = ActionIntent<AuthorizeCardPurchasePayload> & {
  readonly actionType: typeof ACTION_TYPES.AUTHORIZE_CARD_PURCHASE;
};

export type ReverseCardAuthorizationIntent = ActionIntent<ReverseCardAuthorizationPayload> & {
  readonly actionType: typeof ACTION_TYPES.REVERSE_CARD_AUTHORIZATION;
};

export type ClearCardTransactionIntent = ActionIntent<ClearCardTransactionPayload> & {
  readonly actionType: typeof ACTION_TYPES.CLEAR_CARD_TRANSACTION;
};

export type RefundCardTransactionIntent = ActionIntent<RefundCardTransactionPayload> & {
  readonly actionType: typeof ACTION_TYPES.REFUND_CARD_TRANSACTION;
};

export type OpenCardDisputeIntent = ActionIntent<OpenCardDisputePayload> & {
  readonly actionType: typeof ACTION_TYPES.OPEN_CARD_DISPUTE;
};

export type DecideCardDisputeIntent = ActionIntent<DecideCardDisputePayload> & {
  readonly actionType: typeof ACTION_TYPES.DECIDE_CARD_DISPUTE;
};

export type AssessCardFeeIntent = ActionIntent<AssessCardFeePayload> & {
  readonly actionType: typeof ACTION_TYPES.ASSESS_CARD_FEE;
};

export type CardIntent =
  | RequestCardIntent
  | ActivateCardIntent
  | FreezeCardIntent
  | UnfreezeCardIntent
  | CloseCardIntent
  | UpdateCardControlsIntent
  | AuthorizeCardPurchaseIntent
  | ReverseCardAuthorizationIntent
  | ClearCardTransactionIntent
  | RefundCardTransactionIntent
  | OpenCardDisputeIntent
  | DecideCardDisputeIntent
  | AssessCardFeeIntent;
