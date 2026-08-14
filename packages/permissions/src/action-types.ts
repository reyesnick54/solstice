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
