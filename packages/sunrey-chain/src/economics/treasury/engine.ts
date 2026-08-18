/**
 * ProtocolTreasuryEngine — native protocol-owned SunRey/MoonRey
 * treasury. Redistributes existing quantity under governed budgets.
 * Cannot mint. Cannot claim customer assets. Cannot represent fiat.
 */

import { createHash } from 'node:crypto';

import type { FeeDispositionV2 } from '../../fees/v2/types.ts';
import {
  CUSTOMER_ASSET_DOMAINS,
  FIAT_LABELS,
  PROTOCOL_TREASURY_ACCOUNT_PREFIX,
  PROTOCOL_TREASURY_POLICY_VERSION_ID,
  type BudgetApprovalState,
  type CustomerAssetDomain,
  type NativeMonetaryAssetId,
  type ProtocolReserveClass,
  type ProtocolTreasuryAccount,
  type ProtocolTreasuryPolicy,
  type TreasuryActor,
  type TreasuryAllocation,
  type TreasuryBudget,
  type TreasuryBudgetCycle,
  type TreasuryBudgetPolicy,
  type TreasuryDisbursementIntent,
  type TreasuryEquation,
  type TreasuryFundingSource,
  type TreasuryFundingSourceKind,
  type TreasuryGovernancePackage,
  type TreasuryPurposeClass,
  type TreasuryReceipt,
  type TreasuryRecipientClass,
  type TreasuryReconciliation,
  type TreasuryRefusalCode,
  type TreasuryReservation,
  type TreasuryResult,
  type TreasurySolvencyMetrics,
  type TreasuryTransparencyReport,
} from './types.ts';
import { developmentBudgetPolicy, developmentTreasuryPolicy, unconfiguredSpendingConstraints } from './policy.ts';

export type FundInput = {
  readonly fundingId: string;
  readonly source: TreasuryFundingSourceKind;
  readonly asset: NativeMonetaryAssetId;
  readonly reserveClass: ProtocolReserveClass;
  readonly quantity: bigint;
  readonly epoch: bigint;
  readonly height: bigint;
  readonly evidenceRef: string;
  readonly monetaryPolicyVersion: string;
};

export type BudgetDraft = {
  readonly budgetId: string;
  readonly asset: NativeMonetaryAssetId;
  readonly reserveClass: ProtocolReserveClass;
  readonly purpose: TreasuryPurposeClass;
  readonly maximumAuthorizedQuantity: bigint;
  readonly cycle: TreasuryBudgetCycle;
  readonly recipientClass: TreasuryRecipientClass;
  readonly evidenceRefs: readonly string[];
  readonly governanceProposalRef: string;
};

export type IntentDraft = {
  readonly intentId: string;
  readonly budgetId: string;
  readonly recipient: string;
  readonly recipientClass: TreasuryRecipientClass;
  readonly asset: NativeMonetaryAssetId;
  readonly quantity: bigint;
  readonly purpose: TreasuryPurposeClass;
  readonly expirationEpoch: bigint;
};

function err<T>(code: TreasuryRefusalCode, message: string): TreasuryResult<T> {
  return { ok: false, code, message };
}

function ok<T>(value: T): TreasuryResult<T> {
  return { ok: true, value };
}

function accountIdOf(asset: NativeMonetaryAssetId, reserveClass: ProtocolReserveClass): string {
  return `${PROTOCOL_TREASURY_ACCOUNT_PREFIX}.${asset}.${reserveClass}`;
}

export function contentHashOf(input: {
  readonly intentId: string;
  readonly budgetId: string;
  readonly recipient: string;
  readonly asset: NativeMonetaryAssetId;
  readonly quantity: bigint;
  readonly purpose: TreasuryPurposeClass;
  readonly policyVersion: string;
}): string {
  return createHash('sha256')
    .update(
      [
        input.intentId,
        input.budgetId,
        input.recipient,
        input.asset,
        input.quantity.toString(),
        input.purpose,
        input.policyVersion,
      ].join('|'),
    )
    .digest('hex');
}

export function treasuryEquationOf(account: ProtocolTreasuryAccount): TreasuryEquation {
  const left = account.openingBalance + account.authorizedFunding + account.returnedFunds - account.finalizedDisbursements;
  const right = account.availableQuantity + account.reservedQuantity + account.encumberedQuantity;
  return Object.freeze({
    openingBalance: account.openingBalance,
    authorizedFunding: account.authorizedFunding,
    returnedFunds: account.returnedFunds,
    finalizedDisbursements: account.finalizedDisbursements,
    availableQuantity: account.availableQuantity,
    reservedQuantity: account.reservedQuantity,
    encumberedQuantity: account.encumberedQuantity,
    left,
    right,
    balanced: left === right && left >= 0n && right >= 0n,
  });
}

function emptyAccount(
  asset: NativeMonetaryAssetId,
  reserveClass: ProtocolReserveClass,
  policyVersion: string,
): ProtocolTreasuryAccount {
  return Object.freeze({
    classification: 'SUNREY_BLOCKCHAIN_TREASURY',
    distinctFromFiatTreasuryPackage: true,
    fiatTreasuryOwner: 'packages/treasury',
    accountId: accountIdOf(asset, reserveClass),
    asset,
    reserveClass,
    policyVersion,
    openingBalance: 0n,
    authorizedFunding: 0n,
    returnedFunds: 0n,
    finalizedDisbursements: 0n,
    availableQuantity: 0n,
    reservedQuantity: 0n,
    encumberedQuantity: 0n,
    governanceAuthority: 'SUNREY_PROTOCOL_GOVERNANCE',
    spendingConstraints: unconfiguredSpendingConstraints(),
  });
}

function requireHuman(actor: TreasuryActor, action: string): TreasuryResult<true> {
  if (actor.kind === 'AI' || actor.kind === 'AGENT') {
    return err('AI_APPROVAL_REJECTED', `AI cannot ${action}`);
  }
  if (actor.kind !== 'HUMAN' || !actor.governanceAuthorized) {
    return err('UNAUTHORIZED_BUDGET_REJECTED', `human governance required to ${action}`);
  }
  if (actor.rootOfTrustKeyRefs.length === 0) {
    return err('UNAUTHORIZED_BUDGET_REJECTED', 'root-of-trust governance key required');
  }
  return ok(true);
}

export class ProtocolTreasuryEngine {
  private readonly accounts = new Map<string, ProtocolTreasuryAccount>();
  private readonly funding: TreasuryFundingSource[] = [];
  private readonly returns: TreasuryFundingSource[] = [];
  private readonly budgets = new Map<string, TreasuryBudget>();
  private readonly allocations = new Map<string, TreasuryAllocation>();
  private readonly intents = new Map<string, TreasuryDisbursementIntent>();
  private readonly reservations = new Map<string, TreasuryReservation>();
  private readonly receipts: TreasuryReceipt[] = [];
  private readonly seenFundingIds = new Set<string>();
  private readonly seenIntentHashes = new Map<string, string>();
  private policy: ProtocolTreasuryPolicy;
  private budgetPolicy: TreasuryBudgetPolicy;
  private epoch = 0n;
  private height = 0n;
  private nativeSupplyCreated = 0n;

  constructor(
    policy: ProtocolTreasuryPolicy = developmentTreasuryPolicy(),
    budgetPolicy: TreasuryBudgetPolicy = developmentBudgetPolicy(),
  ) {
    this.policy = policy;
    this.budgetPolicy = budgetPolicy;
  }

  currentPolicy(): ProtocolTreasuryPolicy {
    return this.policy;
  }

  currentBudgetPolicy(): TreasuryBudgetPolicy {
    return this.budgetPolicy;
  }

  currentEpoch(): bigint {
    return this.epoch;
  }

  advance(toEpoch: bigint, toHeight: bigint): void {
    this.epoch = toEpoch;
    this.height = toHeight;
    this.expireReservations();
  }

  getAccount(asset: NativeMonetaryAssetId, reserveClass: ProtocolReserveClass): ProtocolTreasuryAccount {
    const id = accountIdOf(asset, reserveClass);
    return this.accounts.get(id) ?? emptyAccount(asset, reserveClass, this.policy.policyVersion);
  }

  listAccounts(): readonly ProtocolTreasuryAccount[] {
    return [...this.accounts.values()];
  }

  listBudgets(): readonly TreasuryBudget[] {
    return [...this.budgets.values()];
  }

  listDisbursements(): readonly TreasuryDisbursementIntent[] {
    return [...this.intents.values()];
  }

  listReservations(): readonly TreasuryReservation[] {
    return [...this.reservations.values()];
  }

  listReceipts(): readonly TreasuryReceipt[] {
    return this.receipts;
  }

  nativeSupplyCreatedByTreasury(): bigint {
    return this.nativeSupplyCreated;
  }

  attemptMint(_asset: NativeMonetaryAssetId, _quantity: bigint): TreasuryResult<never> {
    return err('TREASURY_MINT_UNAVAILABLE', 'treasury cannot mint SunRey or MoonRey to fund a budget');
  }

  attemptCustomerClaim(domain: CustomerAssetDomain): TreasuryResult<never> {
    if ((CUSTOMER_ASSET_DOMAINS as readonly string[]).includes(domain)) {
      return err('CUSTOMER_ASSETS_UNREACHABLE', `protocol treasury cannot claim ${domain}`);
    }
    return err('CUSTOMER_ASSETS_UNREACHABLE', 'customer assets are unreachable');
  }

  attemptFiatLabel(label: string): TreasuryResult<never> {
    const normalized = label.toUpperCase();
    if ((FIAT_LABELS as readonly string[]).includes(normalized) || /dollar|riyal|euro/i.test(label)) {
      return err('FIAT_REPRESENTATION_FORBIDDEN', 'native treasury cannot represent fiat by relabeling quantity');
    }
    return err('FIAT_REPRESENTATION_FORBIDDEN', 'fiat representation forbidden');
  }

  attemptPricePeg(): TreasuryResult<never> {
    return err('PRICE_PEG_FORBIDDEN', 'protocol reserves do not imply a price peg, guaranteed value, liquidity, or redemption');
  }

  attemptEmergencyRewriteSupply(actor: TreasuryActor): TreasuryResult<never> {
    if (actor.kind === 'AI' || actor.kind === 'AGENT') {
      return err('AI_APPROVAL_REJECTED', 'AI cannot exercise emergency treasury authority');
    }
    return err('EMERGENCY_CANNOT_REWRITE_SUPPLY', 'emergency authority cannot rewrite native supply');
  }

  attemptEmergencyMint(actor: TreasuryActor): TreasuryResult<never> {
    if (actor.kind !== 'HUMAN') {
      return err('AI_APPROVAL_REJECTED', 'AI cannot mint emergency funds');
    }
    return err('EMERGENCY_CANNOT_MINT', 'emergency authority cannot mint treasury funds');
  }

  attemptEmergencyConfiscate(): TreasuryResult<never> {
    return err('EMERGENCY_CANNOT_CONFISCATE_CUSTOMER_ASSETS', 'emergency authority cannot confiscate customer assets');
  }

  attemptEmergencyRollback(): TreasuryResult<never> {
    return err('EMERGENCY_CANNOT_ROLLBACK_FINALITY', 'emergency authority cannot rollback finalized chain state');
  }

  attemptEmergencyMonetaryChange(): TreasuryResult<never> {
    return err('EMERGENCY_CANNOT_CHANGE_MONETARY_POLICY', 'emergency authority cannot change monetary policy without governance');
  }

  attemptMoonReyFromHolding(): TreasuryResult<never> {
    return err('MOONREY_HOLDING_IS_NOT_PRODUCTIVE', 'treasury MoonRey ownership is not a productive contribution');
  }

  attemptPrivilegedExchangeTrade(): TreasuryResult<never> {
    return err('EXCHANGE_PRIVILEGED_TRADING_FORBIDDEN', 'treasury has no privileged hidden trading');
  }

  activatePolicy(next: ProtocolTreasuryPolicy, actor: TreasuryActor): TreasuryResult<ProtocolTreasuryPolicy> {
    const gate = requireHuman(actor, 'activate reserve policy');
    if (!gate.ok) {
      return gate;
    }
    this.policy = next;
    return ok(next);
  }

  fund(input: FundInput): TreasuryResult<TreasuryFundingSource> {
    if (input.quantity <= 0n) {
      return err('OVERSPEND_REJECTED', 'funding quantity must be positive');
    }
    if (!(this.policy.allowedAssets as readonly string[]).includes(input.asset)) {
      return err('WRONG_ASSET_REJECTED', `asset ${input.asset} is not a protocol treasury asset`);
    }
    if (!(this.policy.allowedReserveClasses as readonly string[]).includes(input.reserveClass)) {
      return err('UNAUTHORIZED_RESERVE_REJECTED', `reserve class ${input.reserveClass} is not governed`);
    }
    if (!(this.policy.allowedFundingSources as readonly string[]).includes(input.source)) {
      return err('UNAUTHORIZED_FUNDING_SOURCE_REJECTED', `funding source ${input.source} is not permitted`);
    }
    if (this.seenFundingIds.has(input.fundingId)) {
      const existing = this.funding.find((row) => row.fundingId === input.fundingId);
      return existing ? ok(existing) : err('DUPLICATE_DISBURSEMENT_REJECTED', 'duplicate funding identity');
    }
    const record: TreasuryFundingSource = Object.freeze({
      fundingId: input.fundingId,
      source: input.source,
      asset: input.asset,
      reserveClass: input.reserveClass,
      quantity: input.quantity,
      epoch: input.epoch,
      height: input.height,
      evidenceRef: input.evidenceRef,
      monetaryPolicyVersion: input.monetaryPolicyVersion,
      createsSupply: false,
    });
    const account = this.mutableAccount(input.asset, input.reserveClass);
    this.accounts.set(account.accountId, {
      ...account,
      authorizedFunding: account.authorizedFunding + input.quantity,
      availableQuantity: account.availableQuantity + input.quantity,
    });
    this.seenFundingIds.add(input.fundingId);
    this.funding.push(record);
    return ok(record);
  }

  applyFeeDispositionV2(disposition: FeeDispositionV2, fundingId: string, epoch: bigint, height: bigint): TreasuryResult<TreasuryFundingSource> {
    if (disposition.treasury <= 0n) {
      return err('OVERSPEND_REJECTED', 'fee treasury quantity must be positive');
    }
    if (disposition.validatorReward + disposition.burned + disposition.treasury !== disposition.charged) {
      return err('UNAUTHORIZED_FUNDING_SOURCE_REJECTED', 'FeePolicyV2 disposition does not conserve');
    }
    return this.fund({
      fundingId,
      source: 'FEE_POLICY_V2_TREASURY_DISPOSITION',
      asset: disposition.asset === 'SUNREY_COIN' ? 'SUNREY_COIN' : 'SUNREY_COIN',
      reserveClass: 'FEE_TREASURY_RESERVE',
      quantity: disposition.treasury,
      epoch,
      height,
      evidenceRef: `fee-disposition:${fundingId}`,
      monetaryPolicyVersion: PROTOCOL_TREASURY_POLICY_VERSION_ID,
    });
  }

  proposeBudget(draft: BudgetDraft, actor: TreasuryActor): TreasuryResult<TreasuryBudget> {
    if (actor.kind === 'AI' || actor.kind === 'AGENT') {
      return err('AI_APPROVAL_REJECTED', 'AI cannot approve or activate a budget');
    }
    if (!(this.policy.allowedAssets as readonly string[]).includes(draft.asset)) {
      return err('WRONG_ASSET_REJECTED', `budget asset ${draft.asset} is not permitted`);
    }
    if (!(this.budgetPolicy.allowedReserveClasses as readonly string[]).includes(draft.reserveClass)) {
      return err('UNAUTHORIZED_RESERVE_REJECTED', `budget reserve ${draft.reserveClass} is not permitted`);
    }
    if (!(this.budgetPolicy.purposeRules as readonly string[]).includes(draft.purpose)) {
      return err('UNAUTHORIZED_PURPOSE_REJECTED', `purpose ${draft.purpose} is not governed`);
    }
    if (!(this.budgetPolicy.recipientRules as readonly string[]).includes(draft.recipientClass)) {
      return err('UNAUTHORIZED_RECIPIENT_REJECTED', `recipient class ${draft.recipientClass} is not governed`);
    }
    if (draft.maximumAuthorizedQuantity <= 0n) {
      return err('OVERSPEND_REJECTED', 'budget quantity must be positive');
    }
    if (this.budgets.has(draft.budgetId)) {
      return err('DUPLICATE_DISBURSEMENT_REJECTED', 'budget identity already exists');
    }
    const budget: TreasuryBudget = Object.freeze({
      budgetId: draft.budgetId,
      policyVersion: this.policy.policyVersion,
      asset: draft.asset,
      reserveClass: draft.reserveClass,
      purpose: draft.purpose,
      maximumAuthorizedQuantity: draft.maximumAuthorizedQuantity,
      reservedQuantity: 0n,
      disbursedQuantity: 0n,
      remainingQuantity: draft.maximumAuthorizedQuantity,
      cycle: draft.cycle,
      recipientClass: draft.recipientClass,
      evidenceRefs: draft.evidenceRefs,
      governanceProposalRef: draft.governanceProposalRef,
      approvalState: 'PROPOSED',
    });
    this.budgets.set(draft.budgetId, budget);
    return ok(budget);
  }

  approveBudget(budgetId: string, actor: TreasuryActor): TreasuryResult<TreasuryBudget> {
    const budget = this.budgets.get(budgetId);
    if (!budget) {
      return err('UNKNOWN_BUDGET', `unknown budget ${budgetId}`);
    }
    const gate = requireHuman(actor, 'approve budget');
    if (!gate.ok) {
      return gate;
    }
    if (budget.reserveClass === 'EMERGENCY_PROTOCOL_RESERVE' && !actor.emergencyHeightened) {
      return err('HEIGHTENED_APPROVAL_REQUIRED', 'emergency reserve requires heightened human approval');
    }
    const next: TreasuryBudget = Object.freeze({ ...budget, approvalState: 'APPROVED' as BudgetApprovalState });
    this.budgets.set(budgetId, next);
    return ok(next);
  }

  createIntent(draft: IntentDraft, actor: TreasuryActor): TreasuryResult<TreasuryDisbursementIntent> {
    if (actor.kind === 'AI' || actor.kind === 'AGENT') {
      return err('AI_APPROVAL_REJECTED', 'AI cannot authorize a treasury transfer');
    }
    const budget = this.budgets.get(draft.budgetId);
    if (!budget) {
      return err('UNKNOWN_BUDGET', `unknown budget ${draft.budgetId}`);
    }
    if (budget.approvalState !== 'APPROVED' && budget.approvalState !== 'ACTIVE') {
      return err('BUDGET_NOT_APPROVED', 'budget must be approved before disbursement');
    }
    if (draft.asset !== budget.asset) {
      return err('WRONG_ASSET_REJECTED', 'disbursement asset must match the authorized budget asset');
    }
    if (draft.purpose !== budget.purpose) {
      return err('UNAUTHORIZED_PURPOSE_REJECTED', 'disbursement purpose must match the authorized budget purpose');
    }
    if (draft.recipientClass !== budget.recipientClass) {
      return err('UNAUTHORIZED_RECIPIENT_REJECTED', 'recipient class must match the authorized budget');
    }
    if (draft.quantity <= 0n) {
      return err('OVERSPEND_REJECTED', 'disbursement quantity must be positive');
    }
    if (draft.quantity > budget.remainingQuantity) {
      return err('OVERSPEND_REJECTED', 'disbursement exceeds remaining authorized budget quantity');
    }
    const hash = contentHashOf({
      intentId: draft.intentId,
      budgetId: draft.budgetId,
      recipient: draft.recipient,
      asset: draft.asset,
      quantity: draft.quantity,
      purpose: draft.purpose,
      policyVersion: budget.policyVersion,
    });
    const prior = this.seenIntentHashes.get(draft.intentId);
    if (prior && prior === hash) {
      const existing = this.intents.get(draft.intentId);
      return existing ? ok(existing) : err('DUPLICATE_DISBURSEMENT_REJECTED', 'duplicate intent identity');
    }
    if (prior && prior !== hash) {
      return err('DUPLICATE_DISBURSEMENT_REJECTED', 'intent identity already bound to different content');
    }
    if (this.intents.has(draft.intentId)) {
      return err('DUPLICATE_DISBURSEMENT_REJECTED', 'disbursement intent already exists');
    }
    const intent: TreasuryDisbursementIntent = Object.freeze({
      intentId: draft.intentId,
      budgetId: draft.budgetId,
      recipient: draft.recipient,
      recipientClass: draft.recipientClass,
      asset: draft.asset,
      quantity: draft.quantity,
      purpose: draft.purpose,
      policyVersion: budget.policyVersion,
      expirationEpoch: draft.expirationEpoch,
      approval: 'PROPOSED',
      transactionContentHash: hash,
      state: 'DRAFTED',
      reservationId: null,
      chainFinalityRef: null,
    });
    this.intents.set(draft.intentId, intent);
    this.seenIntentHashes.set(draft.intentId, hash);
    return ok(intent);
  }

  approveIntent(intentId: string, actor: TreasuryActor): TreasuryResult<TreasuryDisbursementIntent> {
    const intent = this.intents.get(intentId);
    if (!intent) {
      return err('UNKNOWN_INTENT', `unknown intent ${intentId}`);
    }
    const gate = requireHuman(actor, 'authorize transfer');
    if (!gate.ok) {
      return gate;
    }
    const budget = this.budgets.get(intent.budgetId);
    if (budget?.reserveClass === 'EMERGENCY_PROTOCOL_RESERVE' && !actor.emergencyHeightened) {
      return err('HEIGHTENED_APPROVAL_REQUIRED', 'emergency disbursement requires heightened approval');
    }
    const next: TreasuryDisbursementIntent = Object.freeze({
      ...intent,
      approval: 'APPROVED',
      state: 'APPROVED',
    });
    this.intents.set(intentId, next);
    return ok(next);
  }

  assertIntentBinding(intentId: string, recipient: string, quantity: bigint): TreasuryResult<true> {
    const intent = this.intents.get(intentId);
    if (!intent) {
      return err('UNKNOWN_INTENT', `unknown intent ${intentId}`);
    }
    if (intent.recipient !== recipient) {
      return err('TAMPERED_RECIPIENT_REJECTED', 'changing the recipient invalidates the authorization');
    }
    if (intent.quantity !== quantity) {
      return err('TAMPERED_QUANTITY_REJECTED', 'changing the quantity invalidates the authorization');
    }
    return ok(true);
  }

  reserve(intentId: string, actor: TreasuryActor): TreasuryResult<TreasuryReservation> {
    const intent = this.intents.get(intentId);
    if (!intent) {
      return err('UNKNOWN_INTENT', `unknown intent ${intentId}`);
    }
    const gate = requireHuman(actor, 'reserve treasury quantity');
    if (!gate.ok) {
      return gate;
    }
    if (intent.state !== 'APPROVED') {
      return err('INTENT_NOT_APPROVED', 'only an approved intent may reserve quantity');
    }
    if (this.epoch > intent.expirationEpoch) {
      return err('INTENT_EXPIRED', 'disbursement intent has expired');
    }
    if (intent.reservationId) {
      const existing = this.reservations.get(intent.reservationId);
      return existing ? ok(existing) : err('DUPLICATE_DISBURSEMENT_REJECTED', 'intent already reserved');
    }
    const budget = this.budgets.get(intent.budgetId);
    if (!budget) {
      return err('UNKNOWN_BUDGET', `unknown budget ${intent.budgetId}`);
    }
    if (intent.quantity > budget.remainingQuantity) {
      return err('OVERSPEND_REJECTED', 'budget remaining quantity cannot cover this reservation');
    }
    const account = this.mutableAccount(intent.asset, budget.reserveClass);
    if (intent.quantity > account.availableQuantity) {
      return err('RESERVATION_RACE_REJECTED', 'the same treasury quantity cannot be reserved twice');
    }
    const reservationId = `rsv:${intent.intentId}`;
    const reservation: TreasuryReservation = Object.freeze({
      reservationId,
      intentId: intent.intentId,
      budgetId: intent.budgetId,
      accountId: account.accountId,
      asset: intent.asset,
      quantity: intent.quantity,
      state: 'ACTIVE',
      createdEpoch: this.epoch,
      expirationEpoch: intent.expirationEpoch,
    });
    this.accounts.set(account.accountId, {
      ...account,
      availableQuantity: account.availableQuantity - intent.quantity,
      reservedQuantity: account.reservedQuantity + intent.quantity,
    });
    this.budgets.set(budget.budgetId, {
      ...budget,
      reservedQuantity: budget.reservedQuantity + intent.quantity,
      remainingQuantity: budget.remainingQuantity - intent.quantity,
      approvalState: budget.remainingQuantity - intent.quantity === 0n ? 'EXHAUSTED' : 'ACTIVE',
    });
    this.reservations.set(reservationId, reservation);
    this.intents.set(intentId, { ...intent, state: 'RESERVED', reservationId });
    this.allocations.set(`alloc:${intent.intentId}`, {
      allocationId: `alloc:${intent.intentId}`,
      budgetId: budget.budgetId,
      asset: intent.asset,
      reserveClass: budget.reserveClass,
      quantity: intent.quantity,
      purpose: intent.purpose,
      recipientClass: intent.recipientClass,
      policyVersion: intent.policyVersion,
    });
    return ok(reservation);
  }

  finalize(intentId: string, chainFinalityRef: string, actor: TreasuryActor): TreasuryResult<TreasuryReceipt> {
    const intent = this.intents.get(intentId);
    if (!intent) {
      return err('UNKNOWN_INTENT', `unknown intent ${intentId}`);
    }
    const gate = requireHuman(actor, 'finalize treasury disbursement');
    if (!gate.ok) {
      return gate;
    }
    if (!chainFinalityRef) {
      return err('OFF_CHAIN_APPROVAL_DOES_NOT_MOVE_ASSETS', 'treasury spending finalizes only through chain state transition');
    }
    if (intent.state !== 'RESERVED' || !intent.reservationId) {
      return err('INTENT_NOT_APPROVED', 'quantity must be reserved before finality');
    }
    const reservation = this.reservations.get(intent.reservationId);
    if (!reservation || reservation.state !== 'ACTIVE') {
      return err('UNKNOWN_RESERVATION', 'reservation is not active');
    }
    if (intent.policyVersion !== this.intents.get(intentId)?.policyVersion) {
      return err('POLICY_VERSION_MISMATCH', 'historical policy must govern the authorized lifecycle');
    }
    const budget = this.budgets.get(intent.budgetId);
    if (!budget) {
      return err('UNKNOWN_BUDGET', `unknown budget ${intent.budgetId}`);
    }
    const account = this.mutableAccount(intent.asset, budget.reserveClass);
    if (reservation.quantity > account.reservedQuantity) {
      return err('RESERVATION_RACE_REJECTED', 'reserved quantity is no longer available');
    }
    this.accounts.set(account.accountId, {
      ...account,
      reservedQuantity: account.reservedQuantity - reservation.quantity,
      finalizedDisbursements: account.finalizedDisbursements + reservation.quantity,
    });
    this.budgets.set(budget.budgetId, {
      ...budget,
      reservedQuantity: budget.reservedQuantity - reservation.quantity,
      disbursedQuantity: budget.disbursedQuantity + reservation.quantity,
    });
    this.reservations.set(reservation.reservationId, { ...reservation, state: 'FINALIZED' });
    const receipt: TreasuryReceipt = Object.freeze({
      receiptId: `rcpt:${intent.intentId}:${chainFinalityRef}`,
      intentId: intent.intentId,
      reservationId: reservation.reservationId,
      budgetId: intent.budgetId,
      asset: intent.asset,
      quantity: intent.quantity,
      recipient: intent.recipient,
      purpose: intent.purpose,
      policyVersion: intent.policyVersion,
      chainFinalityRef,
      height: this.height,
      epoch: this.epoch,
    });
    this.intents.set(intentId, {
      ...intent,
      state: 'FINALIZED',
      approval: 'APPROVED',
      chainFinalityRef,
    });
    this.receipts.push(receipt);
    return ok(receipt);
  }

  cancelReservation(reservationId: string, actor: TreasuryActor): TreasuryResult<TreasuryReservation> {
    const reservation = this.reservations.get(reservationId);
    if (!reservation) {
      return err('UNKNOWN_RESERVATION', `unknown reservation ${reservationId}`);
    }
    const gate = requireHuman(actor, 'cancel reservation');
    if (!gate.ok) {
      return gate;
    }
    if (reservation.state !== 'ACTIVE') {
      return err('UNKNOWN_RESERVATION', 'reservation is not active');
    }
    return this.releaseReservation(reservation, 'CANCELLED');
  }

  returnUnused(input: FundInput): TreasuryResult<TreasuryFundingSource> {
    if (input.source !== 'AUTHORIZED_RETURN_REFUND_UNUSED') {
      return err('UNAUTHORIZED_FUNDING_SOURCE_REJECTED', 'returns must use AUTHORIZED_RETURN_REFUND_UNUSED');
    }
    const funded = this.fund(input);
    if (!funded.ok) {
      return funded;
    }
    this.returns.push(funded.value);
    const account = this.mutableAccount(input.asset, input.reserveClass);
    this.accounts.set(account.accountId, {
      ...account,
      authorizedFunding: account.authorizedFunding - input.quantity,
      returnedFunds: account.returnedFunds + input.quantity,
    });
    return funded;
  }

  exportValidatorRewardReserve(): bigint {
    return this.getAccount('SUNREY_COIN', 'VALIDATOR_REWARD_RESERVE').availableQuantity;
  }

  treasuryOwnedExchangeAccount(): {
    readonly accountId: string;
    readonly owner: 'PROTOCOL_TREASURY';
    readonly privilegedTrading: false;
    readonly productionMarketOps: 'UNAVAILABLE';
    readonly usesNormalSettlementRules: true;
  } {
    return Object.freeze({
      accountId: `${PROTOCOL_TREASURY_ACCOUNT_PREFIX}.exchange`,
      owner: 'PROTOCOL_TREASURY',
      privilegedTrading: false,
      productionMarketOps: 'UNAVAILABLE',
      usesNormalSettlementRules: true,
    });
  }

  governancePackage(input: {
    readonly packageId: string;
    readonly proposalRef: string;
    readonly upgradeKind: TreasuryGovernancePackage['upgradeKind'];
    readonly aiPrepared?: boolean;
    readonly emergencyHeightened?: boolean;
    readonly keyRefs?: readonly string[];
  }): TreasuryGovernancePackage {
    return Object.freeze({
      packageId: input.packageId,
      proposalRef: input.proposalRef,
      policyVersion: this.policy.policyVersion,
      upgradeKind: input.upgradeKind,
      aiPrepared: input.aiPrepared === true,
      aiVoted: false,
      aiApproved: false,
      humanGovernanceRequired: true,
      rootOfTrustKeyRefs: input.keyRefs ?? Object.freeze(['rot.governance.treasury.1']),
      emergencyHeightened: input.emergencyHeightened === true,
    });
  }

  reconcile(): TreasuryReconciliation {
    const accounts = this.listAccounts().map((account) =>
      Object.freeze({ ...account, equation: treasuryEquationOf(account) }),
    );
    const okFlag = accounts.every((row) => row.equation.balanced) && this.nativeSupplyCreated === 0n;
    return Object.freeze({
      schemaVersion: 1,
      classification: 'ENGINEERING_SIMULATION',
      policyVersion: this.policy.policyVersion,
      accounts,
      budgets: this.listBudgets(),
      funding: [...this.funding],
      reservations: this.listReservations(),
      disbursements: this.listDisbursements(),
      returns: [...this.returns],
      receipts: [...this.receipts],
      customerAssetsUnreachable: true,
      treasuryMintUnavailable: true,
      ok: okFlag,
    });
  }

  transparency(): TreasuryTransparencyReport {
    return Object.freeze({
      classification: 'PUBLIC_PROTOCOL_TREASURY',
      distinctFromCustomerCustody: true,
      distinctFromFiatLedger: true,
      distinctFromExchangeCustomerBalances: true,
      policyVersion: this.policy.policyVersion,
      reserves: this.listAccounts().map((row) =>
        Object.freeze({
          reserveClass: row.reserveClass,
          asset: row.asset,
          available: row.availableQuantity.toString(),
          reserved: row.reservedQuantity.toString(),
          encumbered: row.encumberedQuantity.toString(),
        }),
      ),
      budgets: this.listBudgets().map((row) =>
        Object.freeze({
          budgetId: row.budgetId,
          asset: row.asset,
          reserveClass: row.reserveClass,
          purpose: row.purpose,
          maximumAuthorizedQuantity: row.maximumAuthorizedQuantity.toString(),
          remainingQuantity: row.remainingQuantity.toString(),
          approvalState: row.approvalState,
          cycleId: row.cycle.cycleId,
        }),
      ),
      approvedDisbursements: this.listDisbursements()
        .filter((row) => row.state === 'APPROVED' || row.state === 'RESERVED')
        .map((row) =>
          Object.freeze({
            intentId: row.intentId,
            quantity: row.quantity.toString(),
            purpose: row.purpose,
            state: row.state,
          }),
        ),
      finalizedDisbursements: this.receipts.map((row) =>
        Object.freeze({
          receiptId: row.receiptId,
          quantity: row.quantity.toString(),
          purpose: row.purpose,
          chainFinalityRef: row.chainFinalityRef,
        }),
      ),
      credentialsExposed: false,
      confidentialVendorDataExposed: false,
    });
  }

  solvencyMetrics(): TreasurySolvencyMetrics {
    const accounts = this.listAccounts();
    const available = accounts.reduce((sum, row) => sum + row.availableQuantity, 0n);
    const reserved = accounts.reduce((sum, row) => sum + row.reservedQuantity, 0n);
    const obligations = this.listBudgets().reduce((sum, row) => sum + row.remainingQuantity + row.reservedQuantity, 0n);
    const inflow = this.funding.reduce((sum, row) => sum + row.quantity, 0n);
    const outflow = this.receipts.reduce((sum, row) => sum + row.quantity, 0n);
    const total = available + reserved;
    return Object.freeze({
      classification: 'ENGINEERING_SIMULATION',
      bankSolvencyClaim: false,
      depositInsuranceClaim: false,
      availableReserve: available,
      reservedReserve: reserved,
      budgetObligations: obligations,
      fundingInflow: inflow,
      outflow,
      coverageRatioNumerator: available,
      coverageRatioDenominator: obligations === 0n ? 1n : obligations,
      reserveConcentration: accounts.map((row) =>
        Object.freeze({
          reserveClass: row.reserveClass,
          quantity: row.availableQuantity + row.reservedQuantity,
          shareNumerator: row.availableQuantity + row.reservedQuantity,
          shareDenominator: total === 0n ? 1n : total,
        }),
      ),
    });
  }

  publicView() {
    return Object.freeze({
      owner: 'packages/sunrey-chain',
      classification: 'PROTOCOL TREASURY',
      distinctFrom: Object.freeze(['customer custody', 'fiat Ledger', 'Exchange customer balances']),
      policy: this.currentPolicy(),
      budgetPolicy: this.currentBudgetPolicy(),
      transparency: this.transparency(),
      solvency: this.solvencyMetrics(),
      productionTreasuryInactive: true,
    });
  }

  private mutableAccount(asset: NativeMonetaryAssetId, reserveClass: ProtocolReserveClass): ProtocolTreasuryAccount {
    const id = accountIdOf(asset, reserveClass);
    const existing = this.accounts.get(id);
    if (existing) {
      return existing;
    }
    const created = emptyAccount(asset, reserveClass, this.policy.policyVersion);
    this.accounts.set(id, created);
    return created;
  }

  private expireReservations(): void {
    for (const reservation of this.reservations.values()) {
      if (reservation.state === 'ACTIVE' && this.epoch > reservation.expirationEpoch) {
        this.releaseReservation(reservation, 'EXPIRED');
      }
    }
  }

  private releaseReservation(
    reservation: TreasuryReservation,
    state: 'CANCELLED' | 'EXPIRED',
  ): TreasuryResult<TreasuryReservation> {
    const intent = this.intents.get(reservation.intentId);
    const budget = this.budgets.get(reservation.budgetId);
    const account = this.accounts.get(reservation.accountId);
    if (!account || !budget || !intent) {
      return err('UNKNOWN_RESERVATION', 'reservation release is missing bound state');
    }
    this.accounts.set(account.accountId, {
      ...account,
      reservedQuantity: account.reservedQuantity - reservation.quantity,
      availableQuantity: account.availableQuantity + reservation.quantity,
    });
    this.budgets.set(budget.budgetId, {
      ...budget,
      reservedQuantity: budget.reservedQuantity - reservation.quantity,
      remainingQuantity: budget.remainingQuantity + reservation.quantity,
      approvalState: budget.approvalState === 'EXHAUSTED' ? 'ACTIVE' : budget.approvalState,
    });
    const released: TreasuryReservation = Object.freeze({ ...reservation, state });
    this.reservations.set(reservation.reservationId, released);
    this.intents.set(intent.intentId, {
      ...intent,
      state,
      reservationId: reservation.reservationId,
    });
    return ok(released);
  }
}

export function developmentCycle(cycleId = 'cycle-dev-1', startEpoch = 0n): TreasuryBudgetCycle {
  return Object.freeze({
    cycleId,
    policyVersion: PROTOCOL_TREASURY_POLICY_VERSION_ID,
    startEpoch,
    endEpoch: startEpoch + 8n,
    startHeight: startEpoch * 10n,
    endHeight: (startEpoch + 8n) * 10n,
    historicalReproducible: true,
  });
}
