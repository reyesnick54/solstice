import type { Account } from '../../domain/src/account.ts';
import { catalogFor, isCustomerFundedClass } from '../../domain/src/account-class.ts';
import type { LegalEntity } from '../../domain/src/legal-entity.ts';
import type { Product, ProductCatalog } from '../../domain/src/product.ts';
import { err, ok, type Result } from '../../domain/src/result.ts';
import { AssetQuantity } from '../../money/src/asset-quantity.ts';
import { Money } from '../../money/src/money.ts';
import type { ActionIntent } from './action-intent.ts';
import {
  ACTION_TYPES,
  type AcceptFxQuoteIntent,
  type AcceptInboundPaymentIntent,
  type CancelPaymentIntent,
  type CaptureHoldIntent,
  type CancelHoldIntent,
  type CreateBeneficiaryIntent,
  type CreateFxQuoteIntent,
  type CreateHoldIntent,
  type InitiatePaymentIntent,
  type InitiatePendingSettlementIntent,
  type InternalTransferIntent,
  type OpenAccountIntent,
  type PendingSettlementLifecyclePayload,
  type PostDepositIntent,
  type PostFeeIntent,
  type PostInterestIntent,
  type PostReversalIntent,
  type PostWithdrawalIntent,
  type ReleaseHoldIntent,
  type ReturnPendingIntent,
  type SettlePendingIntent,
  type RequestCardIntent,
  type CardLifecyclePayload,
  type UpdateCardControlsIntent,
  type AuthorizeCardPurchaseIntent,
  type ReverseCardAuthorizationIntent,
  type ClearCardTransactionIntent,
  type RefundCardTransactionIntent,
  type OpenCardDisputeIntent,
  type DecideCardDisputeIntent,
  type AssessCardFeeIntent,
  type ProvisionCardToWalletIntent,
  type SuspendWalletTokenIntent,
  type RegisterAcceptanceDeviceIntent,
  type CreateAcceptanceSessionIntent,
  type StartAcceptancePaymentIntent,
  type SettleAcceptancePaymentIntent,
  type ReserveTreasuryLiquidityIntent,
  type ReleaseTreasuryLiquidityIntent,
  type CommitTreasuryLiquidityIntent,
  type ProposeTreasuryRebalanceIntent,
  type ExecuteTreasuryRebalanceIntent,
  type SetTreasuryKillSwitchIntent,
  type OpenInvestmentAccountIntent,
  type FundBrokerageCashIntent,
  type WithdrawBrokerageCashIntent,
  type CreatePaperOrderIntent,
  type CancelPaperOrderIntent,
  type SettleInvestmentIntent,
  type ProcessCorporateActionIntent,
  type IssueSunReyCoinIntent,
  type TransferSunReyCoinIntent,
  type BurnSunReyCoinIntent,
  type OpenExchangeAccountIntent,
  type PlaceExchangeOrderIntent,
  type CancelExchangeOrderIntent,
  type SettleExchangeTradeIntent,
  type HaltExchangeIntent,
  type CreditExternalDepositIntent,
  type AddWithdrawalDestinationIntent,
  type InitiateAssetWithdrawalIntent,
  type DecideAssetListingIntent,
  type RestrictExchangeParticipantIntent,
  type SetExchangeControlIntent,
} from './action-types.ts';
import { isHoldPurpose } from '../../domain/src/hold.ts';

/**
 * Structural (well-formedness) validation only.
 * This is NOT authorization. It must not duplicate, pre-empt, or
 * short-circuit any Compliance Kernel proof.
 */
export type StructuralCatalog = {
  readonly products: ProductCatalog;
  readonly legalEntities: {
    get(id: LegalEntity['id']): LegalEntity | undefined;
  };
  readonly accounts: {
    get(id: Account['id']): Account | undefined;
  };
};

export type StructuralRejection = {
  readonly code: 'STRUCTURAL_INVALID';
  readonly field: string;
  readonly message: string;
};

export type StructuralValidationResult = Result<true, StructuralRejection>;

export function validateIntentStructure(
  intent: ActionIntent,
  catalog: StructuralCatalog,
): StructuralValidationResult {
  if (intent.actionType === ACTION_TYPES.OPEN_ACCOUNT) {
    return validateOpenAccount(intent as OpenAccountIntent, catalog);
  }
  if (intent.actionType === ACTION_TYPES.POST_DEPOSIT) {
    return validatePostDeposit(intent as PostDepositIntent, catalog);
  }
  if (intent.actionType === ACTION_TYPES.POST_WITHDRAWAL) {
    return validatePostWithdrawal(intent as PostWithdrawalIntent, catalog);
  }
  if (intent.actionType === ACTION_TYPES.INTERNAL_TRANSFER) {
    return validateInternalTransfer(intent as InternalTransferIntent, catalog);
  }
  if (intent.actionType === ACTION_TYPES.CREATE_BENEFICIARY) {
    return validateCreateBeneficiary(intent as CreateBeneficiaryIntent, catalog);
  }
  if (intent.actionType === ACTION_TYPES.CREATE_FX_QUOTE) {
    return validateCreateFxQuote(intent as CreateFxQuoteIntent, catalog);
  }
  if (intent.actionType === ACTION_TYPES.ACCEPT_FX_QUOTE) {
    return validateAccountOnly((intent as AcceptFxQuoteIntent).payload.accountId, catalog);
  }
  if (intent.actionType === ACTION_TYPES.INITIATE_PAYMENT) {
    return validateInitiatePayment(intent as InitiatePaymentIntent, catalog);
  }
  if (intent.actionType === ACTION_TYPES.CANCEL_PAYMENT) {
    return validateAccountOnly((intent as CancelPaymentIntent).payload.accountId, catalog);
  }
  if (intent.actionType === ACTION_TYPES.ACCEPT_INBOUND_PAYMENT) {
    return validateAcceptInbound(intent as AcceptInboundPaymentIntent, catalog);
  }
  if (intent.actionType === ACTION_TYPES.CREATE_HOLD) {
    return validateCreateHold(intent as CreateHoldIntent, catalog);
  }
  if (
    intent.actionType === ACTION_TYPES.RELEASE_HOLD ||
    intent.actionType === ACTION_TYPES.CAPTURE_HOLD ||
    intent.actionType === ACTION_TYPES.CANCEL_HOLD
  ) {
    return validateHoldLifecycle(
      intent as ReleaseHoldIntent | CaptureHoldIntent | CancelHoldIntent,
      catalog,
    );
  }
  if (intent.actionType === ACTION_TYPES.POST_FEE) {
    return validatePostFee(intent as PostFeeIntent, catalog);
  }
  if (intent.actionType === ACTION_TYPES.POST_REVERSAL) {
    return validatePostReversal(intent as PostReversalIntent, catalog);
  }
  if (intent.actionType === ACTION_TYPES.POST_INTEREST) {
    return validatePostInterest(intent as PostInterestIntent, catalog);
  }
  if (intent.actionType === ACTION_TYPES.INITIATE_PENDING_SETTLEMENT) {
    return validateInitiatePending(intent as InitiatePendingSettlementIntent, catalog);
  }
  if (
    intent.actionType === ACTION_TYPES.SETTLE_PENDING ||
    intent.actionType === ACTION_TYPES.RETURN_PENDING
  ) {
    return validatePendingLifecycle(
      intent as SettlePendingIntent | ReturnPendingIntent,
      catalog,
    );
  }
  if (intent.actionType === ACTION_TYPES.REQUEST_CARD) {
    return validateRequestCard(intent as RequestCardIntent, catalog);
  }
  if (
    intent.actionType === ACTION_TYPES.ACTIVATE_CARD ||
    intent.actionType === ACTION_TYPES.FREEZE_CARD ||
    intent.actionType === ACTION_TYPES.UNFREEZE_CARD ||
    intent.actionType === ACTION_TYPES.CLOSE_CARD
  ) {
    return validateAccountOnly((intent.payload as CardLifecyclePayload).accountId, catalog);
  }
  if (intent.actionType === ACTION_TYPES.UPDATE_CARD_CONTROLS) {
    return validateAccountOnly((intent as UpdateCardControlsIntent).payload.accountId, catalog);
  }
  if (intent.actionType === ACTION_TYPES.AUTHORIZE_CARD_PURCHASE) {
    return validateAuthorizeCard(intent as AuthorizeCardPurchaseIntent, catalog);
  }
  if (intent.actionType === ACTION_TYPES.REVERSE_CARD_AUTHORIZATION) {
    return validateAccountOnly((intent as ReverseCardAuthorizationIntent).payload.accountId, catalog);
  }
  if (intent.actionType === ACTION_TYPES.CLEAR_CARD_TRANSACTION) {
    return validateCardAmount((intent as ClearCardTransactionIntent).payload.accountId, (intent as ClearCardTransactionIntent).payload.amount, catalog);
  }
  if (intent.actionType === ACTION_TYPES.REFUND_CARD_TRANSACTION) {
    return validateCardAmount((intent as RefundCardTransactionIntent).payload.accountId, (intent as RefundCardTransactionIntent).payload.amount, catalog);
  }
  if (intent.actionType === ACTION_TYPES.OPEN_CARD_DISPUTE) {
    return validateCardAmount((intent as OpenCardDisputeIntent).payload.accountId, (intent as OpenCardDisputeIntent).payload.amount, catalog);
  }
  if (intent.actionType === ACTION_TYPES.DECIDE_CARD_DISPUTE) {
    return validateAccountOnly((intent as DecideCardDisputeIntent).payload.accountId, catalog);
  }
  if (intent.actionType === ACTION_TYPES.ASSESS_CARD_FEE) {
    return validateCardAmount((intent as AssessCardFeeIntent).payload.accountId, (intent as AssessCardFeeIntent).payload.amount, catalog);
  }
  if (intent.actionType === ACTION_TYPES.PROVISION_CARD_TO_WALLET) {
    return validateAccountOnly((intent as ProvisionCardToWalletIntent).payload.accountId, catalog);
  }
  if (intent.actionType === ACTION_TYPES.SUSPEND_WALLET_TOKEN) {
    return validateAccountOnly((intent as SuspendWalletTokenIntent).payload.accountId, catalog);
  }
  if (intent.actionType === ACTION_TYPES.REGISTER_ACCEPTANCE_DEVICE) {
    return validateAccountOnly((intent as RegisterAcceptanceDeviceIntent).payload.accountId, catalog);
  }
  if (intent.actionType === ACTION_TYPES.CREATE_ACCEPTANCE_SESSION) {
    return validateAccountOnly((intent as CreateAcceptanceSessionIntent).payload.accountId, catalog);
  }
  if (intent.actionType === ACTION_TYPES.START_ACCEPTANCE_PAYMENT) {
    return validateCardAmount(
      (intent as StartAcceptancePaymentIntent).payload.accountId,
      (intent as StartAcceptancePaymentIntent).payload.amount,
      catalog,
    );
  }
  if (intent.actionType === ACTION_TYPES.SETTLE_ACCEPTANCE_PAYMENT) {
    return validateAccountOnly((intent as SettleAcceptancePaymentIntent).payload.accountId, catalog);
  }
  if (intent.actionType === ACTION_TYPES.RESERVE_TREASURY_LIQUIDITY) {
    return validateCardAmount(
      (intent as ReserveTreasuryLiquidityIntent).payload.accountId,
      (intent as ReserveTreasuryLiquidityIntent).payload.amount,
      catalog,
    );
  }
  if (intent.actionType === ACTION_TYPES.RELEASE_TREASURY_LIQUIDITY) {
    return validateAccountOnly((intent as ReleaseTreasuryLiquidityIntent).payload.accountId, catalog);
  }
  if (intent.actionType === ACTION_TYPES.COMMIT_TREASURY_LIQUIDITY) {
    return validateAccountOnly((intent as CommitTreasuryLiquidityIntent).payload.accountId, catalog);
  }
  if (intent.actionType === ACTION_TYPES.PROPOSE_TREASURY_REBALANCE) {
    return validateCardAmount(
      (intent as ProposeTreasuryRebalanceIntent).payload.accountId,
      (intent as ProposeTreasuryRebalanceIntent).payload.amount,
      catalog,
    );
  }
  if (intent.actionType === ACTION_TYPES.EXECUTE_TREASURY_REBALANCE) {
    return validateAccountOnly((intent as ExecuteTreasuryRebalanceIntent).payload.accountId, catalog);
  }
  if (intent.actionType === ACTION_TYPES.SET_TREASURY_KILL_SWITCH) {
    return validateAccountOnly((intent as SetTreasuryKillSwitchIntent).payload.accountId, catalog);
  }
  if (intent.actionType === ACTION_TYPES.OPEN_INVESTMENT_ACCOUNT) {
    return validateAccountOnly((intent as OpenInvestmentAccountIntent).payload.accountId, catalog);
  }
  if (intent.actionType === ACTION_TYPES.FUND_BROKERAGE_CASH) {
    return validateCardAmount(
      (intent as FundBrokerageCashIntent).payload.accountId,
      (intent as FundBrokerageCashIntent).payload.amount,
      catalog,
    );
  }
  if (intent.actionType === ACTION_TYPES.WITHDRAW_BROKERAGE_CASH) {
    return validateCardAmount(
      (intent as WithdrawBrokerageCashIntent).payload.accountId,
      (intent as WithdrawBrokerageCashIntent).payload.amount,
      catalog,
    );
  }
  if (intent.actionType === ACTION_TYPES.CREATE_PAPER_ORDER) {
    const payload = (intent as CreatePaperOrderIntent).payload;
    if (!/^-?\d+$/.test(payload.quantityUnits)) {
      return reject('quantityUnits', 'quantity must be an integer scaled-units string; floating-point is rejected');
    }
    if (payload.side !== 'BUY' && payload.side !== 'SELL') {
      return reject('side', 'only BUY and SELL are permitted; shorting is forbidden');
    }
    return validateAccountOnly(payload.accountId, catalog);
  }
  if (intent.actionType === ACTION_TYPES.CANCEL_PAPER_ORDER) {
    return validateAccountOnly((intent as CancelPaperOrderIntent).payload.accountId, catalog);
  }
  if (intent.actionType === ACTION_TYPES.SETTLE_INVESTMENT) {
    return validateAccountOnly((intent as SettleInvestmentIntent).payload.accountId, catalog);
  }
  if (intent.actionType === ACTION_TYPES.PROCESS_CORPORATE_ACTION) {
    return validateAccountOnly((intent as ProcessCorporateActionIntent).payload.accountId, catalog);
  }
  if (intent.actionType === ACTION_TYPES.ISSUE_SUNREY_COIN) {
    return validateSunReyCoinAmount((intent as IssueSunReyCoinIntent).payload.amount);
  }
  if (intent.actionType === ACTION_TYPES.TRANSFER_SUNREY_COIN) {
    const payload = (intent as TransferSunReyCoinIntent).payload;
    if (payload.accountId === payload.destinationAccountId) {
      return reject('destinationAccountId', 'source and destination must differ');
    }
    return validateSunReyCoinAmount(payload.amount);
  }
  if (intent.actionType === ACTION_TYPES.BURN_SUNREY_COIN) {
    return validateSunReyCoinAmount((intent as BurnSunReyCoinIntent).payload.amount);
  }
  if (intent.actionType === ACTION_TYPES.OPEN_EXCHANGE_ACCOUNT) {
    const payload = (intent as OpenExchangeAccountIntent).payload;
    if (typeof payload.accountId !== 'string' || payload.accountId.length === 0) {
      return reject('accountId', 'exchange account id is required');
    }
    if (typeof payload.customerId !== 'string' || payload.customerId.length === 0) {
      return reject('customerId', 'customer id is required');
    }
    return ok(true);
  }
  if (intent.actionType === ACTION_TYPES.PLACE_EXCHANGE_ORDER) {
    const payload = (intent as PlaceExchangeOrderIntent).payload;
    if (typeof payload.accountId !== 'string' || payload.accountId.length === 0) {
      return reject('accountId', 'account id is required');
    }
    if (payload.side !== 'BUY' && payload.side !== 'SELL') {
      return reject('side', 'side must be BUY or SELL');
    }
    return validateSunReyCoinAmount(payload.quantity);
  }
  if (intent.actionType === ACTION_TYPES.CANCEL_EXCHANGE_ORDER) {
    const payload = (intent as CancelExchangeOrderIntent).payload;
    if (typeof payload.orderId !== 'string' || payload.orderId.length === 0) {
      return reject('orderId', 'order id is required');
    }
    return ok(true);
  }
  if (intent.actionType === ACTION_TYPES.SETTLE_EXCHANGE_TRADE) {
    const payload = (intent as SettleExchangeTradeIntent).payload;
    if (typeof payload.tradeId !== 'string' || payload.tradeId.length === 0) {
      return reject('tradeId', 'trade id is required');
    }
    return ok(true);
  }
  if (intent.actionType === ACTION_TYPES.HALT_EXCHANGE) {
    const payload = (intent as HaltExchangeIntent).payload;
    if (typeof payload.scope !== 'string' || payload.scope.length === 0) {
      return reject('scope', 'halt scope is required');
    }
    return ok(true);
  }
  if (intent.actionType === ACTION_TYPES.CREDIT_EXTERNAL_DEPOSIT) {
    const payload = (intent as CreditExternalDepositIntent).payload;
    if (typeof payload.depositId !== 'string' || payload.depositId.length === 0) {
      return reject('depositId', 'deposit id is required');
    }
    return validateSunReyCoinAmount(payload.amount);
  }
  if (intent.actionType === ACTION_TYPES.ADD_WITHDRAWAL_DESTINATION) {
    const payload = (intent as AddWithdrawalDestinationIntent).payload;
    if (typeof payload.addressHash !== 'string' || payload.addressHash.length === 0) {
      return reject('addressHash', 'address hash is required');
    }
    return ok(true);
  }
  if (intent.actionType === ACTION_TYPES.INITIATE_ASSET_WITHDRAWAL) {
    const payload = (intent as InitiateAssetWithdrawalIntent).payload;
    if (typeof payload.destinationId !== 'string' || payload.destinationId.length === 0) {
      return reject('destinationId', 'destination id is required');
    }
    return validateSunReyCoinAmount(payload.amount);
  }
  if (intent.actionType === ACTION_TYPES.DECIDE_ASSET_LISTING) {
    const payload = (intent as DecideAssetListingIntent).payload;
    if (typeof payload.listingId !== 'string' || payload.listingId.length === 0) {
      return reject('listingId', 'listing id is required');
    }
    if (payload.status === 'LIVE_APPROVED') {
      return reject('status', 'LIVE_APPROVED is forbidden');
    }
    return ok(true);
  }
  if (intent.actionType === ACTION_TYPES.RESTRICT_EXCHANGE_PARTICIPANT) {
    const payload = (intent as RestrictExchangeParticipantIntent).payload;
    if (typeof payload.accountId !== 'string' || payload.accountId.length === 0) {
      return reject('accountId', 'account id is required');
    }
    return ok(true);
  }
  if (intent.actionType === ACTION_TYPES.SET_EXCHANGE_CONTROL) {
    const payload = (intent as SetExchangeControlIntent).payload;
    if (typeof payload.scope !== 'string' || payload.scope.length === 0) {
      return reject('scope', 'control scope is required');
    }
    return ok(true);
  }
  return reject('actionType', `unknown actionType ${intent.actionType}`);
}

function reject(field: string, message: string): StructuralValidationResult {
  return err(Object.freeze({ code: 'STRUCTURAL_INVALID' as const, field, message }));
}

function validateOpenAccount(
  intent: OpenAccountIntent,
  catalog: StructuralCatalog,
): StructuralValidationResult {
  const payload = intent.payload;
  const product = catalog.products.get(payload.productId);
  if (!product) {
    return reject('productId', 'product does not exist');
  }
  if (product.status !== 'ACTIVE') {
    return reject('productId', 'product is not ACTIVE');
  }
  if (product.accountClass !== payload.accountClass) {
    return reject('accountClass', 'account class does not match product');
  }
  const entity = catalog.legalEntities.get(payload.legalEntityId);
  if (!entity) {
    return reject('legalEntityId', 'legal entity does not exist');
  }
  if (entity.jurisdiction !== payload.jurisdiction) {
    return reject('jurisdiction', 'jurisdiction does not match legal entity');
  }
  if (product.jurisdiction !== payload.jurisdiction) {
    return reject('jurisdiction', 'jurisdiction does not match product');
  }
  if (product.legalEntityId !== payload.legalEntityId) {
    return reject('legalEntityId', 'legal entity does not match product');
  }
  if (product.currency !== payload.currency) {
    return reject('currency', 'currency does not match product');
  }
  return ok(true);
}

function validatePostDeposit(
  intent: PostDepositIntent,
  catalog: StructuralCatalog,
): StructuralValidationResult {
  return validateSingleAccountMoney(intent.payload.accountId, intent.payload.amount, catalog);
}

function validatePostWithdrawal(
  intent: PostWithdrawalIntent,
  catalog: StructuralCatalog,
): StructuralValidationResult {
  return validateSingleAccountMoney(intent.payload.accountId, intent.payload.amount, catalog);
}

function validateSingleAccountMoney(
  accountId: Account['id'],
  amount: Money,
  catalog: StructuralCatalog,
): StructuralValidationResult {
  if (!(amount instanceof Money)) {
    return reject('amount', 'amount must be Money (bigint minor units)');
  }
  if (typeof amount.minorUnits !== 'bigint') {
    return reject('amount', 'amount minor units must be bigint; floating-point is forbidden');
  }
  if (!amount.isPositive()) {
    return reject('amount', 'amount must be a positive integer of minor units');
  }
  const account = catalog.accounts.get(accountId);
  if (!account) {
    return reject('accountId', 'account does not exist');
  }
  if (account.currency !== amount.currency) {
    return reject('currency', 'amount currency does not match account');
  }
  if (!isCustomerFundedClass(account.accountClass)) {
    return reject('accountClass', 'money movement requires a customer-funded account class');
  }
  if (account.status !== 'OPEN') {
    return reject('status', 'account is not OPEN');
  }
  return ok(true);
}

function validateInternalTransfer(
  intent: InternalTransferIntent,
  catalog: StructuralCatalog,
): StructuralValidationResult {
  const { sourceAccountId, destinationAccountId, amount } = intent.payload;
  if (sourceAccountId === destinationAccountId) {
    return reject('destinationAccountId', 'source and destination must differ');
  }
  const sourceCheck = validateSingleAccountMoney(sourceAccountId, amount, catalog);
  if (!sourceCheck.ok) {
    return sourceCheck;
  }
  const destCheck = validateSingleAccountMoney(destinationAccountId, amount, catalog);
  if (!destCheck.ok) {
    return destCheck;
  }
  const source = catalog.accounts.get(sourceAccountId);
  const dest = catalog.accounts.get(destinationAccountId);
  if (!source || !dest) {
    return reject('accountId', 'account does not exist');
  }
  if (source.ownerId !== dest.ownerId) {
    return reject('ownerId', 'internal transfer requires the same owner');
  }
  if (source.currency !== dest.currency) {
    return reject('currency', 'source and destination currencies must match');
  }
  void catalogFor;
  return ok(true);
}

function validateCreateHold(
  intent: CreateHoldIntent,
  catalog: StructuralCatalog,
): StructuralValidationResult {
  if (!isHoldPurpose(intent.payload.holdPurpose)) {
    return reject('holdPurpose', 'hold purpose is not recognized');
  }
  return validateOutgoingAccountMoney(intent.payload.accountId, intent.payload.amount, catalog);
}

function validateHoldLifecycle(
  intent: ReleaseHoldIntent | CaptureHoldIntent | CancelHoldIntent,
  catalog: StructuralCatalog,
): StructuralValidationResult {
  const account = catalog.accounts.get(intent.payload.accountId);
  if (!account) {
    return reject('accountId', 'account does not exist');
  }
  if (account.status === 'CLOSED') {
    return reject('status', 'account is CLOSED');
  }
  return ok(true);
}

function validatePostFee(
  intent: PostFeeIntent,
  catalog: StructuralCatalog,
): StructuralValidationResult {
  if (intent.payload.feeType === 'BASIS_POINTS') {
    if (
      typeof intent.payload.basisPointsNumerator !== 'bigint' ||
      typeof intent.payload.basisPointsDenominator !== 'bigint'
    ) {
      return reject('basisPoints', 'basis-point fee requires bigint numerator and denominator');
    }
    if (intent.payload.basisPointsDenominator === 0n) {
      return reject('basisPoints', 'basis-point denominator must be non-zero');
    }
  }
  return validateOutgoingAccountMoney(intent.payload.accountId, intent.payload.amount, catalog);
}

function validatePostReversal(
  intent: PostReversalIntent,
  catalog: StructuralCatalog,
): StructuralValidationResult {
  if (typeof intent.payload.originalJournalId !== 'string' || intent.payload.originalJournalId.length === 0) {
    return reject('originalJournalId', 'original journal id is required');
  }
  const account = catalog.accounts.get(intent.payload.accountId);
  if (!account) {
    return reject('accountId', 'account does not exist');
  }
  if (account.status === 'CLOSED') {
    return reject('status', 'account is CLOSED');
  }
  return ok(true);
}

function validatePostInterest(
  intent: PostInterestIntent,
  catalog: StructuralCatalog,
): StructuralValidationResult {
  return validateSingleAccountMoney(intent.payload.accountId, intent.payload.amount, catalog);
}

function validateInitiatePending(
  intent: InitiatePendingSettlementIntent,
  catalog: StructuralCatalog,
): StructuralValidationResult {
  const source = validateOutgoingAccountMoney(
    intent.payload.sourceAccountId,
    intent.payload.amount,
    catalog,
  );
  if (!source.ok) {
    return source;
  }
  const pending = catalog.accounts.get(intent.payload.pendingAccountId);
  if (!pending) {
    return reject('pendingAccountId', 'pending settlement account does not exist');
  }
  if (pending.accountClass !== 'PENDING_SETTLEMENT') {
    return reject('pendingAccountId', 'pending account must be PENDING_SETTLEMENT class');
  }
  if (pending.status !== 'OPEN') {
    return reject('status', 'pending settlement account is not OPEN');
  }
  if (pending.currency !== intent.payload.amount.currency) {
    return reject('currency', 'pending account currency does not match amount');
  }
  return ok(true);
}

function validatePendingLifecycle(
  intent: SettlePendingIntent | ReturnPendingIntent,
  catalog: StructuralCatalog,
): StructuralValidationResult {
  const payload: PendingSettlementLifecyclePayload = intent.payload;
  const source = catalog.accounts.get(payload.sourceAccountId);
  const pending = catalog.accounts.get(payload.pendingAccountId);
  if (!source || !pending) {
    return reject('accountId', 'account does not exist');
  }
  if (pending.accountClass !== 'PENDING_SETTLEMENT') {
    return reject('pendingAccountId', 'pending account must be PENDING_SETTLEMENT class');
  }
  return ok(true);
}

function validateAccountOnly(
  accountId: Account['id'],
  catalog: StructuralCatalog,
): StructuralValidationResult {
  const account = catalog.accounts.get(accountId);
  if (!account) {
    return reject('accountId', 'account does not exist');
  }
  if (account.status === 'CLOSED') {
    return reject('status', 'account is CLOSED');
  }
  return ok(true);
}

function validateCreateBeneficiary(
  intent: CreateBeneficiaryIntent,
  catalog: StructuralCatalog,
): StructuralValidationResult {
  const accountCheck = validateAccountOnly(intent.payload.accountId, catalog);
  if (!accountCheck.ok) {
    return accountCheck;
  }
  const account = catalog.accounts.get(intent.payload.accountId);
  if (!account) {
    return reject('accountId', 'account does not exist');
  }
  if (account.ownerId !== intent.payload.ownerId) {
    return reject('ownerId', 'beneficiary owner must match the source account owner');
  }
  if (intent.payload.kind !== 'PERSON' && intent.payload.kind !== 'BUSINESS') {
    return reject('kind', 'beneficiary kind must be PERSON or BUSINESS');
  }
  if (typeof intent.payload.legalName !== 'string' || intent.payload.legalName.trim().length === 0) {
    return reject('legalName', 'legal name is required');
  }
  if (typeof intent.payload.destinationCountry !== 'string' || intent.payload.destinationCountry.length !== 2) {
    return reject('destinationCountry', 'destination country must be ISO 3166-1 alpha-2');
  }
  if (typeof intent.payload.currency !== 'string' || intent.payload.currency.length !== 3) {
    return reject('currency', 'currency must be an ISO 4217 code');
  }
  return ok(true);
}

function validateCreateFxQuote(
  intent: CreateFxQuoteIntent,
  catalog: StructuralCatalog,
): StructuralValidationResult {
  const accountCheck = validateAccountOnly(intent.payload.accountId, catalog);
  if (!accountCheck.ok) {
    return accountCheck;
  }
  const hasSource = intent.payload.sourceAmount instanceof Money;
  const hasDest = intent.payload.destinationAmount instanceof Money;
  if (hasSource === hasDest) {
    return reject('amount', 'quote must specify exactly one of sourceAmount or destinationAmount');
  }
  const amount = hasSource ? intent.payload.sourceAmount : intent.payload.destinationAmount;
  if (!amount || !amount.isPositive()) {
    return reject('amount', 'quote amount must be a positive Money value');
  }
  if (typeof amount.minorUnits !== 'bigint') {
    return reject('amount', 'amount minor units must be bigint; floating-point is forbidden');
  }
  return ok(true);
}

function validateInitiatePayment(
  intent: InitiatePaymentIntent,
  catalog: StructuralCatalog,
): StructuralValidationResult {
  if (intent.payload.accountId !== intent.payload.sourceAccountId) {
    return reject('accountId', 'accountId must equal sourceAccountId');
  }
  const amount = intent.payload.sourceAmount;
  if (!(amount instanceof Money)) {
    return reject('amount', 'amount must be Money (bigint minor units)');
  }
  if (typeof amount.minorUnits !== 'bigint') {
    return reject('amount', 'amount minor units must be bigint; floating-point is forbidden');
  }
  if (!amount.isPositive()) {
    return reject('amount', 'amount must be a positive integer of minor units');
  }
  const accountCheck = validateAccountOnly(intent.payload.sourceAccountId, catalog);
  if (!accountCheck.ok) {
    return accountCheck;
  }
  const account = catalog.accounts.get(intent.payload.sourceAccountId);
  if (!account) {
    return reject('accountId', 'account does not exist');
  }
  if (account.currency !== amount.currency) {
    return reject('currency', 'amount currency does not match account');
  }
  if (!isCustomerFundedClass(account.accountClass)) {
    return reject('accountClass', 'money movement requires a customer-funded account class');
  }
  return ok(true);
}

function validateRequestCard(
  intent: RequestCardIntent,
  catalog: StructuralCatalog,
): StructuralValidationResult {
  const accountCheck = validateAccountOnly(intent.payload.accountId, catalog);
  if (!accountCheck.ok) {
    return accountCheck;
  }
  const account = catalog.accounts.get(intent.payload.accountId);
  if (!account) {
    return reject('accountId', 'account does not exist');
  }
  if (account.ownerId !== intent.payload.ownerId) {
    return reject('ownerId', 'card owner must match the funding account owner');
  }
  if (intent.payload.formFactor !== 'VIRTUAL' && intent.payload.formFactor !== 'PHYSICAL') {
    return reject('formFactor', 'form factor must be VIRTUAL or PHYSICAL');
  }
  if (typeof intent.payload.programId !== 'string' || intent.payload.programId.length === 0) {
    return reject('programId', 'card program id is required');
  }
  return ok(true);
}

function validateAuthorizeCard(
  intent: AuthorizeCardPurchaseIntent,
  catalog: StructuralCatalog,
): StructuralValidationResult {
  return validateCardAmount(intent.payload.accountId, intent.payload.amount, catalog);
}

function validateCardAmount(
  accountId: Account['id'],
  amount: Money,
  catalog: StructuralCatalog,
): StructuralValidationResult {
  if (!(amount instanceof Money) || typeof amount.minorUnits !== 'bigint') {
    return reject('amount', 'amount must be Money bigint minor units');
  }
  if (!amount.isPositive()) {
    return reject('amount', 'amount must be a positive integer of minor units');
  }
  return validateAccountOnly(accountId, catalog);
}

function validateOutgoingAccountMoney(
  accountId: Account['id'],
  amount: Money,
  catalog: StructuralCatalog,
): StructuralValidationResult {
  const check = validateSingleAccountMoney(accountId, amount, catalog);
  if (!check.ok) {
    return check;
  }
  const account = catalog.accounts.get(accountId);
  if (!account) {
    return reject('accountId', 'account does not exist');
  }
  if (account.status === 'FROZEN') {
    return reject('status', 'FROZEN account cannot initiate outgoing movement');
  }
  return ok(true);
}

function validateSunReyCoinAmount(amount: AssetQuantity): StructuralValidationResult {
  if (!(amount instanceof AssetQuantity)) {
    return reject('amount', 'amount must be AssetQuantity (bigint scaled units)');
  }
  if (typeof amount.scaledUnits !== 'bigint') {
    return reject('amount', 'scaled units must be bigint; floating-point is forbidden');
  }
  if (!amount.isPositive()) {
    return reject('amount', 'amount must be a positive integer of scaled units');
  }
  if (typeof amount.assetId !== 'string' || amount.assetId.length === 0) {
    return reject('assetId', 'asset id is required');
  }
  return ok(true);
}

function validateAcceptInbound(
  intent: AcceptInboundPaymentIntent,
  catalog: StructuralCatalog,
): StructuralValidationResult {
  const amount = intent.payload.amount;
  if (!(amount instanceof Money) || typeof amount.minorUnits !== 'bigint' || !amount.isPositive()) {
    return reject('amount', 'inbound amount must be a positive Money value');
  }
  return validateAccountOnly(intent.payload.accountId, catalog);
}
