import type { Account } from '../../domain/src/account.ts';
import { catalogFor, isCustomerFundedClass } from '../../domain/src/account-class.ts';
import type { LegalEntity } from '../../domain/src/legal-entity.ts';
import type { Product, ProductCatalog } from '../../domain/src/product.ts';
import { err, ok, type Result } from '../../domain/src/result.ts';
import { Money } from '../../money/src/money.ts';
import type { ActionIntent } from './action-intent.ts';
import {
  ACTION_TYPES,
  type AcceptFxQuoteIntent,
  type CancelPaymentIntent,
  type CreateBeneficiaryIntent,
  type CreateFxQuoteIntent,
  type InitiatePaymentIntent,
  type InternalTransferIntent,
  type OpenAccountIntent,
  type PostDepositIntent,
  type PostWithdrawalIntent,
} from './action-types.ts';

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
