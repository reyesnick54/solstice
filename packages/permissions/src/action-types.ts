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
import type { AssetQuantity } from '../../money/src/asset-quantity.ts';
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
  ACCEPT_INBOUND_PAYMENT: 'ACCEPT_INBOUND_PAYMENT',
  CREATE_HOLD: 'CREATE_HOLD',
  ADJUST_HOLD: 'ADJUST_HOLD',
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
  PROVISION_CARD_TO_WALLET: 'PROVISION_CARD_TO_WALLET',
  SUSPEND_WALLET_TOKEN: 'SUSPEND_WALLET_TOKEN',
  REGISTER_ACCEPTANCE_DEVICE: 'REGISTER_ACCEPTANCE_DEVICE',
  CREATE_ACCEPTANCE_SESSION: 'CREATE_ACCEPTANCE_SESSION',
  START_ACCEPTANCE_PAYMENT: 'START_ACCEPTANCE_PAYMENT',
  SETTLE_ACCEPTANCE_PAYMENT: 'SETTLE_ACCEPTANCE_PAYMENT',
  RESERVE_TREASURY_LIQUIDITY: 'RESERVE_TREASURY_LIQUIDITY',
  RELEASE_TREASURY_LIQUIDITY: 'RELEASE_TREASURY_LIQUIDITY',
  COMMIT_TREASURY_LIQUIDITY: 'COMMIT_TREASURY_LIQUIDITY',
  PROPOSE_TREASURY_REBALANCE: 'PROPOSE_TREASURY_REBALANCE',
  EXECUTE_TREASURY_REBALANCE: 'EXECUTE_TREASURY_REBALANCE',
  SET_TREASURY_KILL_SWITCH: 'SET_TREASURY_KILL_SWITCH',
  OPEN_INVESTMENT_ACCOUNT: 'OPEN_INVESTMENT_ACCOUNT',
  FUND_BROKERAGE_CASH: 'FUND_BROKERAGE_CASH',
  WITHDRAW_BROKERAGE_CASH: 'WITHDRAW_BROKERAGE_CASH',
  CREATE_PAPER_ORDER: 'CREATE_PAPER_ORDER',
  CANCEL_PAPER_ORDER: 'CANCEL_PAPER_ORDER',
  SETTLE_INVESTMENT: 'SETTLE_INVESTMENT',
  PROCESS_CORPORATE_ACTION: 'PROCESS_CORPORATE_ACTION',
  ISSUE_SUNREY_COIN: 'ISSUE_SUNREY_COIN',
  TRANSFER_SUNREY_COIN: 'TRANSFER_SUNREY_COIN',
  BURN_SUNREY_COIN: 'BURN_SUNREY_COIN',
  OPEN_EXCHANGE_ACCOUNT: 'OPEN_EXCHANGE_ACCOUNT',
  PLACE_EXCHANGE_ORDER: 'PLACE_EXCHANGE_ORDER',
  CANCEL_EXCHANGE_ORDER: 'CANCEL_EXCHANGE_ORDER',
  SETTLE_EXCHANGE_TRADE: 'SETTLE_EXCHANGE_TRADE',
  HALT_EXCHANGE: 'HALT_EXCHANGE',
  CREDIT_EXTERNAL_DEPOSIT: 'CREDIT_EXTERNAL_DEPOSIT',
  ADD_WITHDRAWAL_DESTINATION: 'ADD_WITHDRAWAL_DESTINATION',
  INITIATE_ASSET_WITHDRAWAL: 'INITIATE_ASSET_WITHDRAWAL',
  DECIDE_ASSET_LISTING: 'DECIDE_ASSET_LISTING',
  RESTRICT_EXCHANGE_PARTICIPANT: 'RESTRICT_EXCHANGE_PARTICIPANT',
  SET_EXCHANGE_CONTROL: 'SET_EXCHANGE_CONTROL',
  REHEARSE_AUTHORITY_PATH: 'REHEARSE_AUTHORITY_PATH',
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

export type AcceptInboundPaymentPayload = {
  readonly inboundId: string;
  readonly accountId: AccountId;
  readonly amount: Money;
  readonly provider: string;
  readonly rail: string;
  readonly sourceReference: string;
  readonly destinationReference: string;
  readonly sourceDisplayName: string;
  readonly purposeReference: string;
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

export type AcceptInboundPaymentIntent = ActionIntent<AcceptInboundPaymentPayload> & {
  readonly actionType: typeof ACTION_TYPES.ACCEPT_INBOUND_PAYMENT;
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

export type AdjustHoldPayload = {
  readonly holdId: HoldId;
  readonly accountId: AccountId;
  readonly amount: Money;
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
  readonly reversalKind?: 'FULL' | 'PARTIAL';
  readonly amount?: Money;
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

export type AdjustHoldIntent = ActionIntent<AdjustHoldPayload> & {
  readonly actionType: typeof ACTION_TYPES.ADJUST_HOLD;
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
  | AdjustHoldIntent
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
  | CancelPaymentIntent
  | AcceptInboundPaymentIntent;

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

export type ProvisionCardToWalletPayload = {
  readonly cardId: string;
  readonly accountId: AccountId;
  readonly deviceId: string;
  readonly walletProvider: 'APPLE_WALLET' | 'GOOGLE_WALLET';
  readonly tokenId: string;
};

export type SuspendWalletTokenPayload = {
  readonly tokenId: string;
  readonly accountId: AccountId;
  readonly deviceId: string;
  readonly reason: string;
};

export type RegisterAcceptanceDevicePayload = {
  readonly merchantId: string;
  readonly accountId: AccountId;
  readonly deviceId: string;
  readonly providerDeviceReference: string;
};

export type CreateAcceptanceSessionPayload = {
  readonly merchantId: string;
  readonly accountId: AccountId;
  readonly deviceId: string;
  readonly sessionId: string;
  readonly currency: CurrencyCode;
};

export type StartAcceptancePaymentPayload = {
  readonly sessionId: string;
  readonly accountId: AccountId;
  readonly paymentId: string;
  readonly amount: Money;
  readonly merchantReference: string;
};

export type SettleAcceptancePaymentPayload = {
  readonly paymentId: string;
  readonly accountId: AccountId;
  readonly providerTransactionRef: string;
};

export type ProvisionCardToWalletIntent = ActionIntent<ProvisionCardToWalletPayload> & {
  readonly actionType: typeof ACTION_TYPES.PROVISION_CARD_TO_WALLET;
};

export type SuspendWalletTokenIntent = ActionIntent<SuspendWalletTokenPayload> & {
  readonly actionType: typeof ACTION_TYPES.SUSPEND_WALLET_TOKEN;
};

export type RegisterAcceptanceDeviceIntent = ActionIntent<RegisterAcceptanceDevicePayload> & {
  readonly actionType: typeof ACTION_TYPES.REGISTER_ACCEPTANCE_DEVICE;
};

export type CreateAcceptanceSessionIntent = ActionIntent<CreateAcceptanceSessionPayload> & {
  readonly actionType: typeof ACTION_TYPES.CREATE_ACCEPTANCE_SESSION;
};

export type StartAcceptancePaymentIntent = ActionIntent<StartAcceptancePaymentPayload> & {
  readonly actionType: typeof ACTION_TYPES.START_ACCEPTANCE_PAYMENT;
};

export type SettleAcceptancePaymentIntent = ActionIntent<SettleAcceptancePaymentPayload> & {
  readonly actionType: typeof ACTION_TYPES.SETTLE_ACCEPTANCE_PAYMENT;
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
  | AssessCardFeeIntent
  | ProvisionCardToWalletIntent
  | SuspendWalletTokenIntent
  | RegisterAcceptanceDeviceIntent
  | CreateAcceptanceSessionIntent
  | StartAcceptancePaymentIntent
  | SettleAcceptancePaymentIntent;

export type ReserveTreasuryLiquidityPayload = {
  readonly accountId: AccountId;
  readonly paymentId: string;
  readonly corridorId: string;
  readonly provider: string;
  readonly amount: Money;
};

export type TreasuryReservationLifecyclePayload = {
  readonly accountId: AccountId;
  readonly reservationId: string;
};

export type ProposeTreasuryRebalancePayload = {
  readonly accountId: AccountId;
  readonly proposalId: string;
  readonly sourceTreasuryAccountId: string;
  readonly destinationTreasuryAccountId: string;
  readonly amount: Money;
  readonly narrative: string;
};

export type ExecuteTreasuryRebalancePayload = {
  readonly accountId: AccountId;
  readonly proposalId: string;
};

export type SetTreasuryKillSwitchPayload = {
  readonly accountId: AccountId;
  readonly killSwitchId: string;
  readonly scope:
    | 'PROVIDER'
    | 'RAIL'
    | 'CORRIDOR'
    | 'SETTLEMENT_ACCOUNT'
    | 'CURRENCY_ROUTE'
    | 'HALT_RESERVATIONS'
    | 'RECONCILIATION_ONLY';
  readonly target: string;
  readonly enabled: boolean;
  readonly reason: string;
};

export type ReserveTreasuryLiquidityIntent = ActionIntent<ReserveTreasuryLiquidityPayload> & {
  readonly actionType: typeof ACTION_TYPES.RESERVE_TREASURY_LIQUIDITY;
};

export type ReleaseTreasuryLiquidityIntent = ActionIntent<TreasuryReservationLifecyclePayload> & {
  readonly actionType: typeof ACTION_TYPES.RELEASE_TREASURY_LIQUIDITY;
};

export type CommitTreasuryLiquidityIntent = ActionIntent<TreasuryReservationLifecyclePayload> & {
  readonly actionType: typeof ACTION_TYPES.COMMIT_TREASURY_LIQUIDITY;
};

export type ProposeTreasuryRebalanceIntent = ActionIntent<ProposeTreasuryRebalancePayload> & {
  readonly actionType: typeof ACTION_TYPES.PROPOSE_TREASURY_REBALANCE;
};

export type ExecuteTreasuryRebalanceIntent = ActionIntent<ExecuteTreasuryRebalancePayload> & {
  readonly actionType: typeof ACTION_TYPES.EXECUTE_TREASURY_REBALANCE;
};

export type SetTreasuryKillSwitchIntent = ActionIntent<SetTreasuryKillSwitchPayload> & {
  readonly actionType: typeof ACTION_TYPES.SET_TREASURY_KILL_SWITCH;
};

export type TreasuryIntent =
  | ReserveTreasuryLiquidityIntent
  | ReleaseTreasuryLiquidityIntent
  | CommitTreasuryLiquidityIntent
  | ProposeTreasuryRebalanceIntent
  | ExecuteTreasuryRebalanceIntent
  | SetTreasuryKillSwitchIntent;

export type OpenInvestmentAccountPayload = {
  readonly accountId: AccountId;
  readonly investmentAccountId: string;
  readonly customerId: CustomerId;
  readonly brokerageCashAccountId: AccountId;
  readonly securitiesAccountId: AccountId;
  readonly pendingSettlementAccountId: AccountId;
  readonly productId: ProductId;
  readonly legalEntityId: LegalEntityId;
  readonly jurisdiction: Jurisdiction;
  readonly currency: CurrencyCode;
};

export type FundBrokerageCashPayload = {
  readonly accountId: AccountId;
  readonly sourceAccountId: AccountId;
  readonly amount: Money;
};

export type WithdrawBrokerageCashPayload = {
  readonly accountId: AccountId;
  readonly destinationAccountId: AccountId;
  readonly amount: Money;
};

export type CreatePaperOrderPayload = {
  readonly accountId: AccountId;
  readonly investmentAccountId: string;
  readonly orderId: string;
  readonly instrumentId: string;
  readonly side: 'BUY' | 'SELL';
  readonly quantityUnits: string;
  readonly orderType: 'MARKET_SIMULATION' | 'LIMIT_SIMULATION';
  readonly limitPriceMinorUnits?: string;
  readonly feeMinorUnits?: string;
};

export type CancelPaperOrderPayload = {
  readonly accountId: AccountId;
  readonly orderId: string;
};

export type SettleInvestmentPayload = {
  readonly accountId: AccountId;
  readonly settlementId: string;
};

export type ProcessCorporateActionPayload = {
  readonly accountId: AccountId;
  readonly investmentAccountId: string;
  readonly corporateActionId: string;
  readonly instrumentId: string;
  readonly kind: 'DIVIDEND' | 'SPLIT';
  readonly recordRef: string;
  readonly cashMinorUnits?: string;
  readonly splitNumerator?: string;
  readonly splitDenominator?: string;
};

export type OpenInvestmentAccountIntent = ActionIntent<OpenInvestmentAccountPayload> & {
  readonly actionType: typeof ACTION_TYPES.OPEN_INVESTMENT_ACCOUNT;
};

export type FundBrokerageCashIntent = ActionIntent<FundBrokerageCashPayload> & {
  readonly actionType: typeof ACTION_TYPES.FUND_BROKERAGE_CASH;
};

export type WithdrawBrokerageCashIntent = ActionIntent<WithdrawBrokerageCashPayload> & {
  readonly actionType: typeof ACTION_TYPES.WITHDRAW_BROKERAGE_CASH;
};

export type CreatePaperOrderIntent = ActionIntent<CreatePaperOrderPayload> & {
  readonly actionType: typeof ACTION_TYPES.CREATE_PAPER_ORDER;
};

export type CancelPaperOrderIntent = ActionIntent<CancelPaperOrderPayload> & {
  readonly actionType: typeof ACTION_TYPES.CANCEL_PAPER_ORDER;
};

export type SettleInvestmentIntent = ActionIntent<SettleInvestmentPayload> & {
  readonly actionType: typeof ACTION_TYPES.SETTLE_INVESTMENT;
};

export type ProcessCorporateActionIntent = ActionIntent<ProcessCorporateActionPayload> & {
  readonly actionType: typeof ACTION_TYPES.PROCESS_CORPORATE_ACTION;
};

export type InvestmentIntent =
  | OpenInvestmentAccountIntent
  | FundBrokerageCashIntent
  | WithdrawBrokerageCashIntent
  | CreatePaperOrderIntent
  | CancelPaperOrderIntent
  | SettleInvestmentIntent
  | ProcessCorporateActionIntent;

export type IssueSunReyCoinPayload = {
  readonly accountId: string;
  readonly proposalId: string;
  readonly receiptId: string;
  readonly contributionId: string;
  readonly amount: AssetQuantity;
};

export type TransferSunReyCoinPayload = {
  readonly accountId: string;
  readonly destinationAccountId: string;
  readonly amount: AssetQuantity;
};

export type BurnSunReyCoinPayload = {
  readonly accountId: string;
  readonly amount: AssetQuantity;
};

export type IssueSunReyCoinIntent = ActionIntent<IssueSunReyCoinPayload> & {
  readonly actionType: typeof ACTION_TYPES.ISSUE_SUNREY_COIN;
};

export type TransferSunReyCoinIntent = ActionIntent<TransferSunReyCoinPayload> & {
  readonly actionType: typeof ACTION_TYPES.TRANSFER_SUNREY_COIN;
};

export type BurnSunReyCoinIntent = ActionIntent<BurnSunReyCoinPayload> & {
  readonly actionType: typeof ACTION_TYPES.BURN_SUNREY_COIN;
};

export type SunReyCoinIntent = IssueSunReyCoinIntent | TransferSunReyCoinIntent | BurnSunReyCoinIntent;

export type OpenExchangeAccountPayload = {
  readonly accountId: string;
  readonly customerId: CustomerId;
};

export type PlaceExchangeOrderPayload = {
  readonly accountId: string;
  readonly orderId: string;
  readonly side: 'BUY' | 'SELL';
  readonly quantity: AssetQuantity;
};

export type CancelExchangeOrderPayload = {
  readonly accountId: string;
  readonly orderId: string;
};

export type SettleExchangeTradePayload = {
  readonly accountId: string;
  readonly tradeId: string;
};

export type HaltExchangePayload = {
  readonly accountId: string;
  readonly scope: string;
};

export type OpenExchangeAccountIntent = ActionIntent<OpenExchangeAccountPayload> & {
  readonly actionType: typeof ACTION_TYPES.OPEN_EXCHANGE_ACCOUNT;
};

export type PlaceExchangeOrderIntent = ActionIntent<PlaceExchangeOrderPayload> & {
  readonly actionType: typeof ACTION_TYPES.PLACE_EXCHANGE_ORDER;
};

export type CancelExchangeOrderIntent = ActionIntent<CancelExchangeOrderPayload> & {
  readonly actionType: typeof ACTION_TYPES.CANCEL_EXCHANGE_ORDER;
};

export type SettleExchangeTradeIntent = ActionIntent<SettleExchangeTradePayload> & {
  readonly actionType: typeof ACTION_TYPES.SETTLE_EXCHANGE_TRADE;
};

export type HaltExchangeIntent = ActionIntent<HaltExchangePayload> & {
  readonly actionType: typeof ACTION_TYPES.HALT_EXCHANGE;
};

export type CreditExternalDepositPayload = {
  readonly accountId: string;
  readonly customerId: CustomerId;
  readonly depositId: string;
  readonly amount: AssetQuantity;
};

export type AddWithdrawalDestinationPayload = {
  readonly accountId: string;
  readonly customerId: CustomerId;
  readonly addressHash: string;
};

export type InitiateAssetWithdrawalPayload = {
  readonly accountId: string;
  readonly customerId: CustomerId;
  readonly destinationId: string;
  readonly amount: AssetQuantity;
};

export type DecideAssetListingPayload = {
  readonly accountId: string;
  readonly listingId: string;
  readonly status: string;
};

export type RestrictExchangeParticipantPayload = {
  readonly accountId: string;
  readonly status: string;
};

export type SetExchangeControlPayload = {
  readonly accountId: string;
  readonly scope: string;
};

export type CreditExternalDepositIntent = ActionIntent<CreditExternalDepositPayload> & {
  readonly actionType: typeof ACTION_TYPES.CREDIT_EXTERNAL_DEPOSIT;
};

export type AddWithdrawalDestinationIntent = ActionIntent<AddWithdrawalDestinationPayload> & {
  readonly actionType: typeof ACTION_TYPES.ADD_WITHDRAWAL_DESTINATION;
};

export type InitiateAssetWithdrawalIntent = ActionIntent<InitiateAssetWithdrawalPayload> & {
  readonly actionType: typeof ACTION_TYPES.INITIATE_ASSET_WITHDRAWAL;
};

export type DecideAssetListingIntent = ActionIntent<DecideAssetListingPayload> & {
  readonly actionType: typeof ACTION_TYPES.DECIDE_ASSET_LISTING;
};

export type RestrictExchangeParticipantIntent = ActionIntent<RestrictExchangeParticipantPayload> & {
  readonly actionType: typeof ACTION_TYPES.RESTRICT_EXCHANGE_PARTICIPANT;
};

export type SetExchangeControlIntent = ActionIntent<SetExchangeControlPayload> & {
  readonly actionType: typeof ACTION_TYPES.SET_EXCHANGE_CONTROL;
};

/**
 * TEST_ONLY rehearsal of the authority path. Not a money movement.
 * Execution records evidence only. Never posts a journal.
 */
export type RehearseAuthorityPathPayload = {
  readonly accountId: string;
  readonly rehearsalId: string;
};

export type RehearseAuthorityPathIntent = ActionIntent<RehearseAuthorityPathPayload> & {
  readonly actionType: typeof ACTION_TYPES.REHEARSE_AUTHORITY_PATH;
};

export type SunReyExchangeIntent =
  | OpenExchangeAccountIntent
  | PlaceExchangeOrderIntent
  | CancelExchangeOrderIntent
  | SettleExchangeTradeIntent
  | HaltExchangeIntent
  | DecideAssetListingIntent
  | RestrictExchangeParticipantIntent
  | SetExchangeControlIntent;

export type CustodyIntent =
  | CreditExternalDepositIntent
  | AddWithdrawalDestinationIntent
  | InitiateAssetWithdrawalIntent;
