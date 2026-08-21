import { randomUUID } from 'node:crypto';

import type { Account } from '../../../packages/domain/src/account.ts';
import { asCurrencyCode } from '../../../packages/domain/src/currency.ts';
import { asFeeId, freezeFee, type FeeAssessment } from '../../../packages/domain/src/fee.ts';
import {
  asHoldId,
  freezeHold,
  type FundsHold,
  type HoldId,
} from '../../../packages/domain/src/hold.ts';
import {
  freezeAccrual,
  type InterestAccrual,
} from '../../../packages/domain/src/interest.ts';
import {
  asPendingSettlementId,
  freezePendingSettlement,
  type PendingSettlementRecord,
} from '../../../packages/domain/src/pending-settlement.ts';
import {
  asReconciliationItemId,
  freezeReconciliationItem,
  type ReconciliationItem,
} from '../../../packages/domain/src/reconciliation.ts';
import { asReversalId, freezeReversal, type ReversalRecord } from '../../../packages/domain/src/reversal.ts';
import { isErr, isOk } from '../../../packages/domain/src/result.ts';
import type { CustomerStatement } from '../../../packages/domain/src/statement.ts';
import type { Clock } from '../../../packages/config/src/clock.ts';
import type { EvidenceVault } from '../../../packages/evidence/src/vault.ts';
import type { DomainEventLog } from '../../../packages/events/src/events.ts';
import type { ComplianceKernel } from '../../../packages/kernel/src/kernel.ts';
import type { GrowthAttributionLedger } from '../../../packages/ledger/src/growth.ts';
import {
  existingJournalFingerprint,
  journalFingerprint,
} from '../../../packages/ledger/src/invariants.ts';
import type { Ledger } from '../../../packages/ledger/src/journal.ts';
import { planReversal } from '../../../packages/ledger/src/reversal.ts';
import {
  DEFINED_CLASS_BRIDGES,
  DEMAND_TO_PENDING_SETTLEMENT,
  LedgerInvariantError,
  SIMULATED_FUNDING_TO_DEMAND_DEPOSIT,
  SIMULATED_FUNDING_TO_PENDING_SETTLEMENT,
  simulationFeeCollectorId,
  simulationFundingSourceId,
  simulationInterestSourceId,
  type ClassBridge,
  type Journal,
  type ProposedPosting,
} from '../../../packages/ledger/src/types.ts';
import { asMoney } from '../../../packages/money/src/ledger-amount.ts';
import { Money, RoundingMode } from '../../../packages/money/src/money.ts';
import type {
  AdjustHoldIntent,
  CaptureHoldIntent,
  CancelHoldIntent,
  CreateHoldIntent,
  InitiatePendingSettlementIntent,
  PostFeeIntent,
  PostInterestIntent,
  PostReversalIntent,
  ReleaseHoldIntent,
  ReturnPendingIntent,
  SettlePendingIntent,
} from '../../../packages/permissions/src/action-types.ts';
import type { AuthorizationDecision } from '../../../packages/permissions/src/decision.ts';
import type { AuthorityIssuer } from '../../../packages/permissions/src/execution-authority.ts';
import type { IdentityAuthorityPort } from '../../../packages/identity/src/index.ts';
import { authorizeIntent, type AuthorizePorts } from './authorize.ts';
import {
  assertSufficientAvailable,
  projectBankingPosition,
} from './available-funds.ts';
import { HoldStore } from './hold-store.ts';
import { generateAccountStatement } from './statements.ts';
import type { AccountStore, CustomerStore, LegalEntityStore, ProductStore } from './stores.ts';

export type BankingOutcome<T> =
  | {
      readonly outcome: 'COMPLETED';
      readonly value: T;
      readonly decision: AuthorizationDecision;
      readonly replay: boolean;
    }
  | {
      readonly outcome: 'KERNEL_REFUSED';
      readonly decision: AuthorizationDecision;
    }
  | {
      readonly outcome: 'REJECTED';
      readonly code: string;
      readonly message: string;
      readonly decision: AuthorizationDecision | null;
      readonly evidenceId: string;
    };

/**
 * Kernel-gated banking operations: holds, fees, reversals, interest,
 * pending settlement, statements, and reconciliation.
 * Journals are posted only through Ledger.postJournal after verified authority.
 */
export class BankingOperationsService {
  private readonly ports: AuthorizePorts;
  private readonly ledger: Ledger;
  private readonly growth: GrowthAttributionLedger;
  readonly holds: HoldStore;
  private readonly pending = new Map<string, PendingSettlementRecord>();
  private readonly pendingByKey = new Map<string, PendingSettlementRecord>();
  private readonly fees = new Map<string, FeeAssessment>();
  private readonly feesByKey = new Map<string, FeeAssessment>();
  private readonly reversals = new Map<string, ReversalRecord>();
  private readonly reversalsByKey = new Map<string, ReversalRecord>();
  private readonly accruals = new Map<string, InterestAccrual>();
  private readonly accrualsByKey = new Map<string, InterestAccrual>();
  private readonly statements = new Map<string, CustomerStatement>();
  private readonly reconciliations = new Map<string, ReconciliationItem>();
  private readonly coordinates = new Map<string, readonly import('../../../packages/domain/src/coordinates.ts').ExternalAccountCoordinate[]>();

  constructor(
    kernel: ComplianceKernel,
    issuer: AuthorityIssuer,
    ledger: Ledger,
    evidence: EvidenceVault,
    events: DomainEventLog,
    growth: GrowthAttributionLedger,
    clock: Clock,
    customers: CustomerStore,
    accounts: AccountStore,
    products: ProductStore,
    legalEntities: LegalEntityStore,
    identity: IdentityAuthorityPort,
    holds = new HoldStore(),
  ) {
    this.ports = {
      kernel,
      issuer,
      evidence,
      events,
      clock,
      customers,
      accounts,
      products,
      legalEntities,
      identity,
    };
    this.ledger = ledger;
    this.growth = growth;
    this.holds = holds;
  }

  async createHold(intent: CreateHoldIntent): Promise<BankingOutcome<FundsHold>> {
    const replay = this.holds.getByIdempotencyKey(intent.idempotencyKey);
    if (replay) {
      this.ports.evidence.seal('CREATE_HOLD_IDEMPOTENT_REPLAY', {
        intentId: intent.id,
        holdId: replay.id,
      });
      return {
        outcome: 'COMPLETED',
        value: replay,
        decision: {
          status: 'ALLOW',
          intentId: intent.id,
          actionType: intent.actionType,
          proofs: [],
          executionAuthority: null,
          evidenceRecordId: '',
          decidedAt: this.ports.clock.now(),
        },
        replay: true,
      };
    }
    return this.holds.withAccountLock(intent.payload.accountId, () => {
      const authorized = authorizeIntent(this.ports, intent, { amount: intent.payload.amount });
      if (authorized.outcome !== 'ALLOWED') {
        return authorized;
      }
      const account = this.requireAccount(intent.payload.accountId);
      if (!account) {
        return this.reject(intent.actionType, intent.id, authorized.decision, 'ACCOUNT_NOT_FOUND', 'account does not exist');
      }
      if (account.status === 'FROZEN' || account.status === 'CLOSED') {
        return this.reject(
          intent.actionType,
          intent.id,
          authorized.decision,
          'ACCOUNT_NOT_OPEN',
          'FROZEN or CLOSED account cannot initiate outgoing movement',
        );
      }
      const now = this.ports.clock.now();
      const position = projectBankingPosition(this.ledger, account, this.holds, now);
      if (isErr(position)) {
        return this.reject(intent.actionType, intent.id, authorized.decision, position.error.code, position.error.message);
      }
      const enough = assertSufficientAvailable(position.value, intent.payload.amount);
      if (isErr(enough)) {
        return this.reject(intent.actionType, intent.id, authorized.decision, enough.error.code, enough.error.message);
      }
      const reserved = this.holds.reserve(
        freezeHold({
          id: intent.payload.holdId,
          accountId: account.id,
          currency: asCurrencyCode(intent.payload.amount.currency),
          amountMinorUnits: intent.payload.amount.minorUnits,
          purpose: intent.payload.holdPurpose,
          state: 'ACTIVE',
          idempotencyKey: intent.idempotencyKey,
          createdAt: now,
          updatedAt: now,
          expiresAt: intent.payload.expiresAt ?? null,
          captureJournalId: null,
          epoch: 0,
        }),
        this.holds.accountEpoch(account.id),
      );
      if (isErr(reserved)) {
        return this.reject(intent.actionType, intent.id, authorized.decision, reserved.error.code, reserved.error.message);
      }
      this.emit('HoldCreated', account.id, intent, authorized.decision, {
        holdId: reserved.value.id,
        amountMinorUnits: reserved.value.amountMinorUnits.toString(),
        currency: reserved.value.currency,
      });
      this.ports.evidence.seal('HOLD_CREATED', {
        intentId: intent.id,
        authorityId: authorized.verified.authorityId,
        holdId: reserved.value.id,
        accountId: account.id,
      });
      this.emitPositionChanged(account, intent, authorized.decision);
      return { outcome: 'COMPLETED', value: reserved.value, decision: authorized.decision, replay: false };
    });
  }

  async adjustHold(intent: AdjustHoldIntent): Promise<BankingOutcome<FundsHold>> {
    return this.holds.withAccountLock(intent.payload.accountId, () => {
      const existing = this.holds.get(intent.payload.holdId);
      if (
        existing &&
        existing.amountMinorUnits === intent.payload.amount.minorUnits &&
        existing.idempotencyKey === intent.idempotencyKey
      ) {
        this.ports.evidence.seal('ADJUST_HOLD_IDEMPOTENT_REPLAY', {
          intentId: intent.id,
          holdId: existing.id,
        });
        return this.replay(intent, existing);
      }
      const authorized = authorizeIntent(this.ports, intent, { amount: intent.payload.amount });
      if (authorized.outcome !== 'ALLOWED') {
        return authorized;
      }
      const hold = this.holds.get(intent.payload.holdId);
      if (!hold) {
        return this.reject(intent.actionType, intent.id, authorized.decision, 'HOLD_NOT_FOUND', 'hold does not exist');
      }
      const account = this.requireAccount(hold.accountId);
      if (!account) {
        return this.reject(intent.actionType, intent.id, authorized.decision, 'ACCOUNT_NOT_FOUND', 'account does not exist');
      }
      if (hold.currency !== intent.payload.amount.currency) {
        return this.reject(intent.actionType, intent.id, authorized.decision, 'CURRENCY_MISMATCH', 'adjust currency must match the hold');
      }
      const now = this.ports.clock.now();
      const position = projectBankingPosition(this.ledger, account, this.holds, now);
      if (isErr(position)) {
        return this.reject(intent.actionType, intent.id, authorized.decision, position.error.code, position.error.message);
      }
      const released = Money.fromMinorUnits(hold.amountMinorUnits, hold.currency);
      const availableIfReleased = position.value.available.plus(released);
      const enough = assertSufficientAvailable(
        { ...position.value, available: availableIfReleased },
        intent.payload.amount,
      );
      if (isErr(enough)) {
        return this.reject(intent.actionType, intent.id, authorized.decision, enough.error.code, enough.error.message);
      }
      const adjusted = this.holds.adjust(
        hold.id,
        intent.payload.amount.minorUnits,
        now,
        this.holds.accountEpoch(account.id),
      );
      if (isErr(adjusted)) {
        return this.reject(intent.actionType, intent.id, authorized.decision, adjusted.error.code, adjusted.error.message);
      }
      this.emit('HoldAdjusted', account.id, intent, authorized.decision, {
        holdId: adjusted.value.id,
        amountMinorUnits: adjusted.value.amountMinorUnits.toString(),
        currency: adjusted.value.currency,
      });
      this.ports.evidence.seal('HOLD_ADJUSTED', {
        intentId: intent.id,
        authorityId: authorized.verified.authorityId,
        holdId: adjusted.value.id,
        previousAmount: hold.amountMinorUnits.toString(),
        nextAmount: adjusted.value.amountMinorUnits.toString(),
      });
      this.emitPositionChanged(account, intent, authorized.decision);
      return { outcome: 'COMPLETED', value: adjusted.value, decision: authorized.decision, replay: false };
    });
  }

  expireHolds(): readonly FundsHold[] {
    const expired = this.holds.expireDue(this.ports.clock.now());
    for (const hold of expired) {
      this.ports.events.append({
        eventType: 'HoldExpired',
        schemaVersion: 1,
        occurredAt: hold.updatedAt,
        aggregateType: 'account',
        aggregateId: hold.accountId,
        payload: {
          accountId: hold.accountId,
          amountMinorUnits: hold.amountMinorUnits.toString(),
          currency: hold.currency,
          holdId: hold.id,
        },
      });
      this.ports.evidence.seal('HOLD_EXPIRED', {
        holdId: hold.id,
        accountId: hold.accountId,
        posted: false,
      });
    }
    return expired;
  }

  hydrateHolds(holds: readonly FundsHold[]): void {
    this.holds.hydrate(holds);
  }

  hydrateReversals(records: readonly ReversalRecord[]): void {
    this.reversals.clear();
    this.reversalsByKey.clear();
    for (const record of records) {
      this.reversals.set(record.id, record);
      this.reversalsByKey.set(record.idempotencyKey, record);
    }
  }

  hydrateFees(records: readonly FeeAssessment[]): void {
    this.fees.clear();
    this.feesByKey.clear();
    for (const fee of records) {
      this.fees.set(fee.id, fee);
      this.feesByKey.set(fee.idempotencyKey, fee);
    }
  }

  releaseHold(intent: ReleaseHoldIntent): BankingOutcome<FundsHold> {
    return this.finishHold(intent, 'RELEASED', 'HoldReleased', 'HOLD_RELEASED');
  }

  cancelHold(intent: CancelHoldIntent): BankingOutcome<FundsHold> {
    return this.finishHold(intent, 'CANCELLED', 'HoldCancelled', 'HOLD_CANCELLED');
  }

  captureHold(intent: CaptureHoldIntent): BankingOutcome<{ hold: FundsHold; journal: Journal }> {
    const existingHold = this.holds.get(intent.payload.holdId);
    if (existingHold?.state === 'CAPTURED' && existingHold.captureJournalId) {
      const journal = this.ledger.getJournal(existingHold.captureJournalId);
      if (journal) {
        this.ports.evidence.seal('CAPTURE_HOLD_IDEMPOTENT_REPLAY', {
          intentId: intent.id,
          holdId: existingHold.id,
          journalId: journal.id,
        });
        return {
          outcome: 'COMPLETED',
          value: { hold: existingHold, journal },
          decision: {
            status: 'ALLOW',
            intentId: intent.id,
            actionType: intent.actionType,
            proofs: [],
            executionAuthority: null,
            evidenceRecordId: '',
            decidedAt: this.ports.clock.now(),
          },
          replay: true,
        };
      }
    }
    const authorized = authorizeIntent(this.ports, intent);
    if (authorized.outcome !== 'ALLOWED') {
      return authorized;
    }
    const hold = this.holds.get(intent.payload.holdId);
    if (!hold) {
      return this.reject(intent.actionType, intent.id, authorized.decision, 'HOLD_NOT_FOUND', 'hold does not exist');
    }
    const account = this.requireAccount(hold.accountId);
    if (!account) {
      return this.reject(intent.actionType, intent.id, authorized.decision, 'ACCOUNT_NOT_FOUND', 'account does not exist');
    }
    const amount = Money.fromMinorUnits(hold.amountMinorUnits, hold.currency);
    const posted = this.postAuthorizedJournal({
      intentId: intent.id,
      idempotencyKey: intent.idempotencyKey,
      actionType: intent.actionType,
      authority: authorized.verified,
      postings: [
        { accountId: account.id, direction: 'DEBIT', amount },
        { accountId: simulationFundingSourceId(hold.currency), direction: 'CREDIT', amount },
      ],
      classBridge: SIMULATED_FUNDING_TO_DEMAND_DEPOSIT,
      memo: `capture hold ${hold.id}`,
    });
    const moved = this.holds.transition(hold.id, 'CAPTURED', this.ports.clock.now(), posted.id);
    if (isErr(moved)) {
      return this.reject(intent.actionType, intent.id, authorized.decision, moved.error.code, moved.error.message);
    }
    this.growth.skipPrincipalMovement('PRINCIPAL_WITHDRAWAL_IS_NOT_ECONOMIC_IMPROVEMENT');
    this.emit('HoldCaptured', account.id, intent, authorized.decision, {
      holdId: moved.value.id,
      journalId: posted.id,
      amountMinorUnits: amount.minorUnits.toString(),
      currency: amount.currency,
    });
    this.ports.evidence.seal('HOLD_CAPTURED', {
      intentId: intent.id,
      authorityId: authorized.verified.authorityId,
      holdId: moved.value.id,
      journalId: posted.id,
    });
    this.emitPositionChanged(account, intent, authorized.decision);
    return { outcome: 'COMPLETED', value: { hold: moved.value, journal: posted }, decision: authorized.decision, replay: false };
  }

  postFee(intent: PostFeeIntent): BankingOutcome<FeeAssessment> {
    const replay = this.feesByKey.get(intent.idempotencyKey);
    if (replay) {
      this.ports.evidence.seal('POST_FEE_IDEMPOTENT_REPLAY', { intentId: intent.id, feeId: replay.id });
      return this.replay(intent, replay);
    }
    const authorized = authorizeIntent(this.ports, intent, { amount: intent.payload.amount });
    if (authorized.outcome !== 'ALLOWED') {
      return authorized;
    }
    const account = this.requireAccount(intent.payload.accountId);
    if (!account) {
      return this.reject(intent.actionType, intent.id, authorized.decision, 'ACCOUNT_NOT_FOUND', 'account does not exist');
    }
    const now = this.ports.clock.now();
    const position = projectBankingPosition(this.ledger, account, this.holds, now);
    if (isErr(position)) {
      return this.reject(intent.actionType, intent.id, authorized.decision, position.error.code, position.error.message);
    }
    let assessed = intent.payload.amount;
    if (intent.payload.feeType === 'BASIS_POINTS') {
      const numerator = intent.payload.basisPointsNumerator;
      const denominator = intent.payload.basisPointsDenominator;
      if (typeof numerator !== 'bigint' || typeof denominator !== 'bigint') {
        return this.reject(intent.actionType, intent.id, authorized.decision, 'FEE_INVALID', 'basis-point factors must be bigint');
      }
      assessed = position.value.settled.allocate(numerator, denominator, RoundingMode.HALF_EVEN);
      if (!assessed.isPositive()) {
        return this.reject(intent.actionType, intent.id, authorized.decision, 'FEE_INVALID', 'assessed fee must be positive');
      }
    }
    const enough = assertSufficientAvailable(position.value, assessed);
    if (isErr(enough)) {
      return this.reject(intent.actionType, intent.id, authorized.decision, enough.error.code, enough.error.message);
    }
    const journal = this.postAuthorizedJournal({
      intentId: intent.id,
      idempotencyKey: intent.idempotencyKey,
      actionType: intent.actionType,
      authority: authorized.verified,
      postings: [
        { accountId: account.id, direction: 'DEBIT', amount: assessed },
        { accountId: simulationFeeCollectorId(assessed.currency), direction: 'CREDIT', amount: assessed },
      ],
      classBridge: SIMULATED_FUNDING_TO_DEMAND_DEPOSIT,
      memo: `explicit fee ${intent.payload.feeType}`,
    });
    const fee = freezeFee({
      id: asFeeId(`fee_${intent.id}`),
      accountId: account.id,
      feeType: intent.payload.feeType,
      currency: asCurrencyCode(assessed.currency),
      assessedMinorUnits: assessed.minorUnits,
      fixedMinorUnits: intent.payload.feeType === 'FIXED' ? assessed.minorUnits : null,
      basisPointsNumerator: intent.payload.basisPointsNumerator ?? null,
      basisPointsDenominator: intent.payload.basisPointsDenominator ?? null,
      journalId: journal.id,
      idempotencyKey: intent.idempotencyKey,
      createdAt: now,
    });
    this.fees.set(fee.id, fee);
    this.feesByKey.set(fee.idempotencyKey, fee);
    this.growth.skipPrincipalMovement('PRINCIPAL_WITHDRAWAL_IS_NOT_ECONOMIC_IMPROVEMENT');
    this.emit('FeePosted', account.id, intent, authorized.decision, {
      feeId: fee.id,
      journalId: journal.id,
      amountMinorUnits: assessed.minorUnits.toString(),
      currency: assessed.currency,
    });
    this.ports.evidence.seal('FEE_POSTED', {
      intentId: intent.id,
      authorityId: authorized.verified.authorityId,
      feeId: fee.id,
      journalId: journal.id,
    });
    this.emitPositionChanged(account, intent, authorized.decision);
    return { outcome: 'COMPLETED', value: fee, decision: authorized.decision, replay: false };
  }

  postReversal(intent: PostReversalIntent): BankingOutcome<ReversalRecord> {
    const replay = this.reversalsByKey.get(intent.idempotencyKey);
    if (replay) {
      this.ports.evidence.seal('POST_REVERSAL_IDEMPOTENT_REPLAY', {
        intentId: intent.id,
        reversalId: replay.id,
      });
      return this.replay(intent, replay);
    }
    const authorized = authorizeIntent(this.ports, intent);
    if (authorized.outcome !== 'ALLOWED') {
      return authorized;
    }
    const original = this.ledger.getJournal(intent.payload.originalJournalId);
    if (!original) {
      return this.reject(intent.actionType, intent.id, authorized.decision, 'JOURNAL_NOT_FOUND', 'original journal does not exist');
    }
    const already = [...this.reversals.values()].find(
      (item) => item.originalJournalId === original.id && item.kind === 'FULL',
    );
    if (already) {
      return this.reject(
        intent.actionType,
        intent.id,
        authorized.decision,
        'ALREADY_REVERSED',
        'original journal has already been fully reversed',
      );
    }
    const kind = intent.payload.reversalKind ?? 'FULL';
    let plan;
    try {
      plan = planReversal(original.id, original.postings, kind, intent.payload.amount);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'reversal plan rejected';
      return this.reject(intent.actionType, intent.id, authorized.decision, 'REVERSAL_INVALID', message);
    }
    const classBridge = original.classBridgeName
      ? DEFINED_CLASS_BRIDGES.find((bridge) => bridge.name === original.classBridgeName)
      : undefined;
    const journal = this.postAuthorizedJournal({
      intentId: intent.id,
      idempotencyKey: intent.idempotencyKey,
      actionType: intent.actionType,
      authority: authorized.verified,
      postings: plan.postings,
      ...(classBridge ? { classBridge } : {}),
      memo: `reversal of ${original.id}: ${intent.payload.reason}`,
      reversesJournalId: original.id,
      reversalKind: plan.kind,
      reference: `reversal:${original.id}:${plan.kind}`,
      correlationId: intent.id,
      causationId: authorized.decision.evidenceRecordId,
      sourceDomain: 'ledger',
      evidenceRecordId: authorized.decision.evidenceRecordId,
    });
    const record = freezeReversal({
      id: asReversalId(`rev_${intent.id}`),
      originalJournalId: original.id,
      compensatingJournalId: journal.id,
      reason: intent.payload.reason,
      idempotencyKey: intent.idempotencyKey,
      createdAt: this.ports.clock.now(),
      kind: plan.kind,
      originalScaledUnits: plan.originalTotalScaled,
      reversedScaledUnits: plan.reversedScaled,
    });
    this.reversals.set(record.id, record);
    this.reversalsByKey.set(record.idempotencyKey, record);
    this.emit('ReversalPosted', intent.payload.accountId, intent, authorized.decision, {
      reversalId: record.id,
      journalId: journal.id,
    });
    this.ports.evidence.seal('REVERSAL_POSTED', {
      intentId: intent.id,
      authorityId: authorized.verified.authorityId,
      originalJournalId: original.id,
      compensatingJournalId: journal.id,
      reversalId: record.id,
    });
    return { outcome: 'COMPLETED', value: record, decision: authorized.decision, replay: false };
  }

  postInterest(intent: PostInterestIntent): BankingOutcome<InterestAccrual> {
    const replay = this.accrualsByKey.get(intent.idempotencyKey);
    if (replay) {
      this.ports.evidence.seal('POST_INTEREST_IDEMPOTENT_REPLAY', {
        intentId: intent.id,
        accrualId: replay.id,
      });
      return this.replay(intent, replay);
    }
    const authorized = authorizeIntent(this.ports, intent, { amount: intent.payload.amount });
    if (authorized.outcome !== 'ALLOWED') {
      return authorized;
    }
    const account = this.requireAccount(intent.payload.accountId);
    if (!account) {
      return this.reject(intent.actionType, intent.id, authorized.decision, 'ACCOUNT_NOT_FOUND', 'account does not exist');
    }
    const amount = intent.payload.amount;
    const journal = this.postAuthorizedJournal({
      intentId: intent.id,
      idempotencyKey: intent.idempotencyKey,
      actionType: intent.actionType,
      authority: authorized.verified,
      postings: [
        { accountId: simulationInterestSourceId(amount.currency), direction: 'DEBIT', amount },
        { accountId: account.id, direction: 'CREDIT', amount },
      ],
      classBridge: SIMULATED_FUNDING_TO_DEMAND_DEPOSIT,
      memo: `interest posting rate ${intent.payload.rateVersionId}`,
    });
    const accrual = freezeAccrual({
      id: `acr_${intent.id}` as InterestAccrual['id'],
      accountId: account.id,
      rateVersionId: intent.payload.rateVersionId,
      currency: asCurrencyCode(amount.currency),
      periodStart: intent.payload.periodStart,
      periodEnd: intent.payload.periodEnd,
      principalMinorUnits: 0n,
      accruedMinorUnits: amount.minorUnits,
      rounding: 'HALF_EVEN',
      journalId: journal.id,
      idempotencyKey: intent.idempotencyKey,
      createdAt: this.ports.clock.now(),
    });
    this.accruals.set(accrual.id, accrual);
    this.accrualsByKey.set(accrual.idempotencyKey, accrual);
    this.emit('InterestPosted', account.id, intent, authorized.decision, {
      journalId: journal.id,
      amountMinorUnits: amount.minorUnits.toString(),
      currency: amount.currency,
    });
    this.ports.evidence.seal('INTEREST_POSTED', {
      intentId: intent.id,
      authorityId: authorized.verified.authorityId,
      journalId: journal.id,
      rateVersionId: intent.payload.rateVersionId,
    });
    this.emitPositionChanged(account, intent, authorized.decision);
    return { outcome: 'COMPLETED', value: accrual, decision: authorized.decision, replay: false };
  }

  initiatePending(intent: InitiatePendingSettlementIntent): BankingOutcome<PendingSettlementRecord> {
    const replay = this.pendingByKey.get(intent.idempotencyKey);
    if (replay) {
      this.ports.evidence.seal('INITIATE_PENDING_IDEMPOTENT_REPLAY', {
        intentId: intent.id,
        pendingId: replay.id,
      });
      return this.replay(intent, replay);
    }
    const authorized = authorizeIntent(this.ports, intent, { amount: intent.payload.amount });
    if (authorized.outcome !== 'ALLOWED') {
      return authorized;
    }
    const source = this.requireAccount(intent.payload.sourceAccountId);
    const pendingAccount = this.requireAccount(intent.payload.pendingAccountId);
    if (!source || !pendingAccount) {
      return this.reject(intent.actionType, intent.id, authorized.decision, 'ACCOUNT_NOT_FOUND', 'account does not exist');
    }
    const now = this.ports.clock.now();
    const position = projectBankingPosition(this.ledger, source, this.holds, now);
    if (isErr(position)) {
      return this.reject(intent.actionType, intent.id, authorized.decision, position.error.code, position.error.message);
    }
    const enough = assertSufficientAvailable(position.value, intent.payload.amount);
    if (isErr(enough)) {
      return this.reject(intent.actionType, intent.id, authorized.decision, enough.error.code, enough.error.message);
    }
    const journal = this.postAuthorizedJournal({
      intentId: intent.id,
      idempotencyKey: intent.idempotencyKey,
      actionType: intent.actionType,
      authority: authorized.verified,
      postings: [
        { accountId: pendingAccount.id, direction: 'CREDIT', amount: intent.payload.amount },
        { accountId: source.id, direction: 'DEBIT', amount: intent.payload.amount },
      ],
      classBridge: DEMAND_TO_PENDING_SETTLEMENT,
      memo: `initiate pending ${intent.payload.pendingId}`,
    });
    const record = freezePendingSettlement({
      id: intent.payload.pendingId,
      sourceAccountId: source.id,
      pendingAccountId: pendingAccount.id,
      currency: asCurrencyCode(intent.payload.amount.currency),
      amountMinorUnits: intent.payload.amount.minorUnits,
      state: 'PENDING',
      initiateJournalId: journal.id,
      settleJournalId: null,
      returnJournalId: null,
      idempotencyKey: intent.idempotencyKey,
      createdAt: now,
      updatedAt: now,
    });
    this.pending.set(record.id, record);
    this.pendingByKey.set(record.idempotencyKey, record);
    this.emit('PendingSettlementInitiated', source.id, intent, authorized.decision, {
      pendingId: record.id,
      journalId: journal.id,
      amountMinorUnits: record.amountMinorUnits.toString(),
      currency: record.currency,
    });
    this.ports.evidence.seal('PENDING_INITIATED', {
      intentId: intent.id,
      authorityId: authorized.verified.authorityId,
      pendingId: record.id,
      journalId: journal.id,
    });
    this.emitPositionChanged(source, intent, authorized.decision);
    return { outcome: 'COMPLETED', value: record, decision: authorized.decision, replay: false };
  }

  settlePending(intent: SettlePendingIntent): BankingOutcome<PendingSettlementRecord> {
    return this.finishPending(intent, 'SETTLED', simulationFundingSourceId, 'PendingSettlementSettled', 'PENDING_SETTLED');
  }

  returnPending(intent: ReturnPendingIntent): BankingOutcome<PendingSettlementRecord> {
    const authorized = authorizeIntent(this.ports, intent);
    if (authorized.outcome !== 'ALLOWED') {
      return authorized;
    }
    const current = this.pending.get(intent.payload.pendingId);
    if (!current) {
      return this.reject(intent.actionType, intent.id, authorized.decision, 'PENDING_NOT_FOUND', 'pending settlement does not exist');
    }
    if (current.state !== 'PENDING' && current.state !== 'INITIATED') {
      if (current.state === 'RETURNED') {
        return this.replay(intent, current);
      }
      return this.reject(intent.actionType, intent.id, authorized.decision, 'PENDING_ILLEGAL', `cannot return from ${current.state}`);
    }
    const amount = Money.fromMinorUnits(current.amountMinorUnits, current.currency);
    const journal = this.postAuthorizedJournal({
      intentId: intent.id,
      idempotencyKey: intent.idempotencyKey,
      actionType: intent.actionType,
      authority: authorized.verified,
      postings: [
        { accountId: current.pendingAccountId, direction: 'DEBIT', amount },
        { accountId: current.sourceAccountId, direction: 'CREDIT', amount },
      ],
      classBridge: DEMAND_TO_PENDING_SETTLEMENT,
      memo: `return pending ${current.id}`,
    });
    const next = freezePendingSettlement({
      ...current,
      state: 'RETURNED',
      returnJournalId: journal.id,
      updatedAt: this.ports.clock.now(),
    });
    this.pending.set(next.id, next);
    this.emit('PendingSettlementReturned', current.sourceAccountId, intent, authorized.decision, {
      pendingId: next.id,
      journalId: journal.id,
      amountMinorUnits: next.amountMinorUnits.toString(),
      currency: next.currency,
    });
    this.ports.evidence.seal('PENDING_RETURNED', {
      intentId: intent.id,
      authorityId: authorized.verified.authorityId,
      pendingId: next.id,
      journalId: journal.id,
    });
    return { outcome: 'COMPLETED', value: next, decision: authorized.decision, replay: false };
  }

  generateStatement(account: Account, periodStart: import('../../../packages/domain/src/time.ts').UtcInstant, periodEnd: import('../../../packages/domain/src/time.ts').UtcInstant): CustomerStatement {
    const statement = generateAccountStatement({
      ledger: this.ledger,
      account,
      periodStart,
      periodEnd,
      generatedAt: this.ports.clock.now(),
    });
    this.statements.set(statement.id, statement);
    this.ports.events.append({
      eventType: 'StatementGenerated',
      schemaVersion: 1,
      occurredAt: statement.generatedAt,
      aggregateType: 'account',
      aggregateId: account.id,
      payload: {
        accountId: account.id,
        statementId: statement.id,
        amountMinorUnits: statement.closingMinorUnits.toString(),
        currency: statement.currency,
      },
    });
    this.ports.evidence.seal('STATEMENT_GENERATED', {
      statementId: statement.id,
      accountId: account.id,
      currency: statement.currency,
      opening: statement.openingMinorUnits.toString(),
      closing: statement.closingMinorUnits.toString(),
    });
    return statement;
  }

  recordReconciliation(input: {
    readonly account: Account;
    readonly externalMinorUnits: bigint;
    readonly externalStatementRef: string;
    readonly note?: string;
  }): ReconciliationItem {
    const position = projectBankingPosition(
      this.ledger,
      input.account,
      this.holds,
      this.ports.clock.now(),
    );
    const internal = isOk(position) ? position.value.ledgerBalance.minorUnits : 0n;
    const difference = internal - input.externalMinorUnits;
    const status =
      difference === 0n ? 'MATCHED' : 'MISMATCH';
    const item = freezeReconciliationItem({
      id: asReconciliationItemId(`rec_${randomUUID()}`),
      accountId: input.account.id,
      currency: input.account.currency,
      internalMinorUnits: internal,
      externalMinorUnits: input.externalMinorUnits,
      differenceMinorUnits: difference,
      status,
      externalStatementRef: input.externalStatementRef,
      note: input.note ?? null,
      createdAt: this.ports.clock.now(),
      updatedAt: this.ports.clock.now(),
    });
    this.reconciliations.set(item.id, item);
    if (status === 'MISMATCH') {
      const investigated = freezeReconciliationItem({
        ...item,
        status: 'INVESTIGATION_REQUIRED',
        updatedAt: this.ports.clock.now(),
      });
      this.reconciliations.set(investigated.id, investigated);
      this.ports.events.append({
        eventType: 'ReconciliationMismatch',
        schemaVersion: 1,
        occurredAt: investigated.updatedAt,
        aggregateType: 'account',
        aggregateId: input.account.id,
        payload: {
          accountId: input.account.id,
          reconciliationId: investigated.id,
          amountMinorUnits: investigated.differenceMinorUnits.toString(),
          currency: investigated.currency,
        },
      });
      this.ports.evidence.seal('RECONCILIATION_MISMATCH', {
        reconciliationId: investigated.id,
        accountId: input.account.id,
        difference: investigated.differenceMinorUnits.toString(),
        autoCorrected: false,
      });
      return investigated;
    }
    this.ports.evidence.seal('RECONCILIATION_MATCHED', {
      reconciliationId: item.id,
      accountId: input.account.id,
    });
    return item;
  }

  listPending(): readonly PendingSettlementRecord[] {
    return [...this.pending.values()];
  }

  listFees(): readonly FeeAssessment[] {
    return [...this.fees.values()];
  }

  listReversals(): readonly ReversalRecord[] {
    return [...this.reversals.values()];
  }

  listStatements(): readonly CustomerStatement[] {
    return [...this.statements.values()];
  }

  listReconciliations(): readonly ReconciliationItem[] {
    return [...this.reconciliations.values()];
  }

  attachCoordinates(
    accountId: string,
    coordinates: readonly import('../../../packages/domain/src/coordinates.ts').ExternalAccountCoordinate[],
  ): void {
    this.coordinates.set(accountId, coordinates);
  }

  coordinatesFor(accountId: string) {
    return this.coordinates.get(accountId) ?? [];
  }

  private finishHold(
    intent: ReleaseHoldIntent | CancelHoldIntent,
    state: 'RELEASED' | 'CANCELLED',
    eventType: 'HoldReleased' | 'HoldCancelled',
    evidenceKind: string,
  ): BankingOutcome<FundsHold> {
    const existing = this.holds.get(intent.payload.holdId);
    if (existing && existing.state === state) {
      this.ports.evidence.seal(`${intent.actionType}_IDEMPOTENT_REPLAY`, {
        intentId: intent.id,
        holdId: existing.id,
      });
      return this.replay(intent, existing);
    }
    const authorized = authorizeIntent(this.ports, intent);
    if (authorized.outcome !== 'ALLOWED') {
      return authorized;
    }
    const moved = this.holds.transition(intent.payload.holdId as HoldId, state, this.ports.clock.now());
    if (isErr(moved)) {
      return this.reject(intent.actionType, intent.id, authorized.decision, moved.error.code, moved.error.message);
    }
    this.emit(eventType, moved.value.accountId, intent, authorized.decision, {
      holdId: moved.value.id,
      amountMinorUnits: moved.value.amountMinorUnits.toString(),
      currency: moved.value.currency,
    });
    this.ports.evidence.seal(evidenceKind, {
      intentId: intent.id,
      authorityId: authorized.verified.authorityId,
      holdId: moved.value.id,
    });
    const account = this.requireAccount(moved.value.accountId);
    if (account) {
      this.emitPositionChanged(account, intent, authorized.decision);
    }
    return { outcome: 'COMPLETED', value: moved.value, decision: authorized.decision, replay: false };
  }

  private finishPending(
    intent: SettlePendingIntent,
    state: 'SETTLED',
    contra: (currency: string) => string,
    eventType: 'PendingSettlementSettled',
    evidenceKind: string,
  ): BankingOutcome<PendingSettlementRecord> {
    const authorized = authorizeIntent(this.ports, intent);
    if (authorized.outcome !== 'ALLOWED') {
      return authorized;
    }
    const current = this.pending.get(intent.payload.pendingId);
    if (!current) {
      return this.reject(intent.actionType, intent.id, authorized.decision, 'PENDING_NOT_FOUND', 'pending settlement does not exist');
    }
    if (current.state === state) {
      return this.replay(intent, current);
    }
    if (current.state !== 'PENDING' && current.state !== 'INITIATED') {
      return this.reject(intent.actionType, intent.id, authorized.decision, 'PENDING_ILLEGAL', `cannot settle from ${current.state}`);
    }
    const amount = Money.fromMinorUnits(current.amountMinorUnits, current.currency);
    const journal = this.postAuthorizedJournal({
      intentId: intent.id,
      idempotencyKey: intent.idempotencyKey,
      actionType: intent.actionType,
      authority: authorized.verified,
      postings: [
        { accountId: current.pendingAccountId, direction: 'DEBIT', amount },
        { accountId: contra(current.currency), direction: 'CREDIT', amount },
      ],
      classBridge: SIMULATED_FUNDING_TO_PENDING_SETTLEMENT,
      memo: `settle pending ${current.id}`,
    });
    const next = freezePendingSettlement({
      ...current,
      state,
      settleJournalId: journal.id,
      updatedAt: this.ports.clock.now(),
    });
    this.pending.set(next.id, next);
    this.emit(eventType, current.sourceAccountId, intent, authorized.decision, {
      pendingId: next.id,
      journalId: journal.id,
      amountMinorUnits: next.amountMinorUnits.toString(),
      currency: next.currency,
    });
    this.ports.evidence.seal(evidenceKind, {
      intentId: intent.id,
      authorityId: authorized.verified.authorityId,
      pendingId: next.id,
      journalId: journal.id,
    });
    return { outcome: 'COMPLETED', value: next, decision: authorized.decision, replay: false };
  }

  private postAuthorizedJournal(input: {
    readonly intentId: string;
    readonly idempotencyKey: string;
    readonly actionType: string;
    readonly authority: import('../../../packages/permissions/src/execution-authority.ts').VerifiedExecutionAuthority;
    readonly postings: readonly ProposedPosting[];
    readonly classBridge?: import('../../../packages/ledger/src/types.ts').ClassBridge;
    readonly memo?: string;
    readonly reversesJournalId?: string;
    readonly reversalKind?: 'FULL' | 'PARTIAL';
    readonly reference?: string;
    readonly correlationId?: string;
    readonly causationId?: string;
    readonly sourceDomain?: import('../../../packages/ledger/src/types.ts').LedgerSourceDomain;
    readonly evidenceRecordId?: string;
  }): Journal {
    const existing = this.ledger.getJournalByIdempotencyKey(input.idempotencyKey);
    if (existing) {
      const next = journalFingerprint({ actionType: input.actionType, postings: input.postings });
      if (next !== existingJournalFingerprint(existing)) {
        throw new LedgerInvariantError(
          'IDEMPOTENCY',
          'idempotency key already bound to a different journal',
        );
      }
      return existing;
    }
    const journal = this.ledger.postJournal({
      idempotencyKey: input.idempotencyKey,
      executionAuthority: input.authority,
      actionType: input.actionType,
      postings: input.postings,
      ...(input.classBridge ? { classBridge: input.classBridge } : {}),
      ...(input.memo ? { memo: input.memo } : {}),
      ...(input.reversesJournalId ? { reversesJournalId: input.reversesJournalId } : {}),
      ...(input.reversalKind ? { reversalKind: input.reversalKind } : {}),
      ...(input.reference ? { reference: input.reference } : {}),
      ...(input.correlationId ? { correlationId: input.correlationId } : {}),
      ...(input.causationId ? { causationId: input.causationId } : {}),
      ...(input.sourceDomain ? { sourceDomain: input.sourceDomain } : {}),
      ...(input.evidenceRecordId ? { evidenceRecordId: input.evidenceRecordId } : {}),
    });
    this.ports.events.append({
      eventType: 'JournalPosted',
      schemaVersion: 1,
      occurredAt: this.ports.clock.now(),
      intentId: input.intentId,
      correlationId: input.correlationId ?? input.intentId,
      causationId: input.causationId,
      evidenceId: input.evidenceRecordId,
      aggregateType: 'journal',
      aggregateId: journal.id,
      payload: {
        journalId: journal.id,
        actionType: journal.actionType,
        asset: journal.asset,
        amountMinorUnits: asMoney(journal.postings[0]!.amount).minorUnits.toString(),
        currency: journal.asset,
        ...(journal.reference ? { reference: journal.reference } : {}),
        ...(journal.sourceDomain ? { sourceDomain: journal.sourceDomain } : {}),
        ...(journal.evidenceRecordId ? { evidenceRecordId: journal.evidenceRecordId } : {}),
        ...(journal.reversesJournalId ? { reversesJournalId: journal.reversesJournalId } : {}),
      },
    });
    return journal;
  }

  private requireAccount(accountId: string): Account | undefined {
    return this.ports.accounts.get(accountId as never) ?? this.ports.accounts.list().find((a) => a.id === accountId);
  }

  private reject(
    actionType: string,
    intentId: string,
    decision: AuthorizationDecision | null,
    code: string,
    message: string,
  ): BankingOutcome<never> {
    const evidence = this.ports.evidence.seal(`${actionType}_REJECTED`, {
      intentId,
      code,
      message,
      posted: false,
    });
    return { outcome: 'REJECTED', code, message, decision, evidenceId: evidence.evidenceId };
  }

  private replay<T>(
    intent: { readonly id: string; readonly actionType: string },
    value: T,
  ): BankingOutcome<T> {
    return {
      outcome: 'COMPLETED',
      value,
      decision: {
        status: 'ALLOW',
        intentId: intent.id,
        actionType: intent.actionType,
        proofs: [],
        executionAuthority: null,
        evidenceRecordId: '',
        decidedAt: this.ports.clock.now(),
      },
      replay: true,
    };
  }

  private emit(
    eventType:
      | 'HoldCreated'
      | 'HoldAdjusted'
      | 'HoldExpired'
      | 'HoldReleased'
      | 'HoldCaptured'
      | 'HoldCancelled'
      | 'FeePosted'
      | 'InterestPosted'
      | 'ReversalPosted'
      | 'PendingSettlementInitiated'
      | 'PendingSettlementSettled'
      | 'PendingSettlementReturned',
    accountId: string,
    intent: { readonly id: string; readonly requestedAt: import('../../../packages/domain/src/time.ts').UtcInstant },
    decision: AuthorizationDecision,
    payload: Record<string, string | undefined>,
  ): void {
    this.ports.events.append({
      eventType,
      schemaVersion: 1,
      occurredAt: this.ports.clock.now(),
      intentId: intent.id,
      correlationId: intent.id,
      causationId: decision.evidenceRecordId,
      evidenceId: decision.evidenceRecordId,
      aggregateType: 'account',
      aggregateId: accountId,
      payload: {
        accountId: accountId as Account['id'],
        amountMinorUnits: payload.amountMinorUnits ?? '0',
        currency: payload.currency ?? '',
        ...(payload.holdId ? { holdId: payload.holdId } : {}),
        ...(payload.journalId ? { journalId: payload.journalId } : {}),
        ...(payload.feeId ? { feeId: payload.feeId } : {}),
        ...(payload.reversalId ? { reversalId: payload.reversalId } : {}),
        ...(payload.pendingId ? { pendingId: payload.pendingId } : {}),
      },
    });
  }

  private emitPositionChanged(
    account: Account,
    intent: { readonly id: string },
    decision: AuthorizationDecision,
  ): void {
    const position = projectBankingPosition(this.ledger, account, this.holds, this.ports.clock.now());
    if (isErr(position)) {
      return;
    }
    this.ports.events.append({
      eventType: 'AccountPositionChanged',
      schemaVersion: 1,
      occurredAt: this.ports.clock.now(),
      intentId: intent.id,
      correlationId: intent.id,
      causationId: decision.evidenceRecordId,
      evidenceId: decision.evidenceRecordId,
      aggregateType: 'account',
      aggregateId: account.id,
      payload: {
        accountId: account.id,
        amountMinorUnits: position.value.available.minorUnits.toString(),
        currency: position.value.currency,
      },
    });
  }
}

export { asHoldId, asPendingSettlementId };
