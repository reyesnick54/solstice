import { randomUUID } from 'node:crypto';

import type { Clock } from '../../../../config/src/clock.ts';
import type { EvidenceVault } from '../../../../evidence/src/vault.ts';
import type { CustomerId } from '../../../../domain/src/customer.ts';
import { err, ok, type Result } from '../../../../domain/src/result.ts';
import { exitRequestIdFor, asCapitalReservationId, withdrawalRequestIdFor } from './ids.ts';
import { runCapitalReconciliation } from './reconciliation.ts';
import { InMemoryCapitalLifecycleStore } from './store.ts';
import type {
  CapitalLifecycleFailure,
  CapitalReservation,
  DestinationVerificationPort,
  HeliosExitRequest,
  HeliosWithdrawalRequest,
  InvestmentLifecyclePort,
  MandateLifecycleContext,
  ReinvestmentEligibility,
  RequestExitInput,
  RequestWithdrawalInput,
  ReserveCapitalInput,
  WithdrawableCashSnapshot,
} from './types.ts';
import { computeWithdrawableCash, evaluateReinvestmentEligibility } from './withdrawable-cash.ts';

export type HeliosCapitalLifecycleServiceOptions = {
  readonly clock: Clock;
  readonly investments: InvestmentLifecyclePort;
  readonly destinations: DestinationVerificationPort;
  readonly mandate: () => MandateLifecycleContext;
  readonly evidence?: EvidenceVault;
  readonly store?: InMemoryCapitalLifecycleStore;
};

/**
 * H24 capital lifecycle orchestrator. Coordinates exit, settlement, reconciliation,
 * reinvestment eligibility, and withdrawal through canonical investment ports.
 * Does not issue Execution Authority or post journals directly.
 */
export class HeliosCapitalLifecycleService {
  private readonly clock: Clock;
  private readonly investments: InvestmentLifecyclePort;
  private readonly destinations: DestinationVerificationPort;
  private readonly mandate: () => MandateLifecycleContext;
  private readonly evidence?: EvidenceVault;
  readonly store: InMemoryCapitalLifecycleStore;

  constructor(options: HeliosCapitalLifecycleServiceOptions) {
    this.clock = options.clock;
    this.investments = options.investments;
    this.destinations = options.destinations;
    this.mandate = options.mandate;
    if (options.evidence) {
      this.evidence = options.evidence;
    }
    this.store = options.store ?? new InMemoryCapitalLifecycleStore();
  }

  requestExit(input: RequestExitInput): Result<HeliosExitRequest, CapitalLifecycleFailure> {
    const replay = this.store.getExitByIdempotency(input.customerId, input.idempotencyKey);
    if (replay) {
      return ok(replay);
    }

    const owner = this.investments.investmentCustomerId?.(input.investmentAccountId);
    if (owner && owner !== input.customerId) {
      return err({ code: 'CUSTOMER_MISMATCH', message: 'investment account does not belong to customer' });
    }

    const positions = this.investments.listPositions(input.investmentAccountId);
    const position = positions.find((row) => row.instrumentId === input.instrumentId);
    if (!position || BigInt(position.quantityUnits) <= 0n) {
      return err({ code: 'POSITION_NOT_FOUND', message: 'no open position to exit' });
    }

    const positionQty = BigInt(position.quantityUnits);
    const requestedQty = BigInt(input.quantityUnits);
    if (requestedQty <= 0n || requestedQty > positionQty) {
      return err({ code: 'INVALID_QUANTITY', message: 'exit quantity exceeds position' });
    }
    if (input.exitType === 'FULL_CLOSE' && requestedQty !== positionQty) {
      return err({ code: 'INVALID_QUANTITY', message: 'FULL_CLOSE requires entire position quantity' });
    }

    const submitted = this.investments.createPaperOrder(input.orderIntent);
    if (submitted.outcome === 'KERNEL_REFUSED') {
      return err({ code: 'KERNEL_REFUSED', message: submitted.message ?? 'Kernel refused exit order' });
    }
    if (submitted.outcome !== 'OK' || !submitted.value) {
      return err({ code: 'PROVIDER_UNAVAILABLE', message: submitted.message ?? 'exit order rejected' });
    }

    const now = this.clock.now();
    const remaining = positionQty - requestedQty;
    let stage: HeliosExitRequest['stage'] = submitted.value.fillId ? 'FILLED' : 'SUBMITTED';
    let settlementId: string | null = null;

    if (submitted.value.fillId) {
      const settlements = this.investments.listSettlements(input.investmentAccountId);
      const match = settlements.find((row) => row.fillId === submitted.value!.fillId);
      settlementId = match?.settlementId ?? null;
      if (match?.state === 'SETTLED') {
        stage = 'SETTLED';
      }
    }

    const exit: HeliosExitRequest = Object.freeze({
      exitRequestId: exitRequestIdFor(String(input.customerId), input.idempotencyKey),
      customerId: input.customerId,
      investmentAccountId: input.investmentAccountId,
      workOrderId: input.workOrderId,
      positionInstrumentId: input.instrumentId,
      exitType: input.exitType,
      reason: input.reason,
      requestedQuantityUnits: input.quantityUnits,
      remainingQuantityUnits: remaining.toString(),
      providerRoute: input.providerRoute,
      authorityEvidenceId: submitted.authorityId ?? null,
      orderId: submitted.value.orderId,
      fillId: submitted.value.fillId ?? null,
      settlementId,
      stage,
      idempotencyKey: input.idempotencyKey,
      createdAt: now,
      updatedAt: now,
    });
    this.store.putExit(exit);
    this.seal('HELIOS_EXIT_REQUESTED', exit);
    return ok(exit);
  }

  advanceExitSettlement(exitRequestId: HeliosExitRequest['exitRequestId']): Result<HeliosExitRequest, CapitalLifecycleFailure> {
    const existing = this.store.getExit(exitRequestId);
    if (!existing) {
      return err({ code: 'NOT_FOUND', message: 'exit request not found' });
    }
    if (existing.stage === 'SETTLED' || existing.stage === 'RECONCILED' || existing.stage === 'AVAILABLE') {
      return ok(existing);
    }
    if (!existing.settlementId) {
      return err({ code: 'INVALID_STATE', message: 'exit has no settlement record' });
    }
    const settled = this.investments.settleInvestment({
      settlementId: existing.settlementId,
      idempotencyKey: `settle:${existing.idempotencyKey}`,
      actorId: 'helios_capital_lifecycle',
      now: this.clock.now(),
    });
    if (settled.outcome === 'KERNEL_REFUSED') {
      return err({ code: 'KERNEL_REFUSED', message: settled.message ?? 'settlement refused' });
    }
    if (settled.outcome !== 'OK') {
      return err({ code: 'INVALID_STATE', message: settled.message ?? 'settlement failed' });
    }
    const updated = Object.freeze({
      ...existing,
      stage: 'SETTLED' as const,
      updatedAt: this.clock.now(),
    });
    this.store.putExit(updated);
    this.seal('HELIOS_EXIT_SETTLED', updated);
    return ok(updated);
  }

  reconcileAfterExit(
    exitRequestId: HeliosExitRequest['exitRequestId'],
  ): Result<{ readonly exit: HeliosExitRequest; readonly reconciliation: import('./types.ts').CapitalReconciliationRun }, CapitalLifecycleFailure> {
    const existing = this.store.getExit(exitRequestId);
    if (!existing) {
      return err({ code: 'NOT_FOUND', message: 'exit request not found' });
    }
    if (existing.stage !== 'SETTLED' && existing.stage !== 'FILLED') {
      return err({ code: 'INVALID_STATE', message: 'exit must be filled or settled before reconciliation' });
    }
    const reconciliation = runCapitalReconciliation({
      customerId: existing.customerId,
      investmentAccountId: existing.investmentAccountId,
      investments: this.investments,
      now: this.clock.now(),
    });
    this.store.putReconciliation(reconciliation);
    const stage: HeliosExitRequest['stage'] =
      reconciliation.outcome === 'MATCHED' ? 'AVAILABLE' : reconciliation.blocksAvailability ? 'ACTION_REQUIRED' : 'RECONCILED';
    const updated = Object.freeze({
      ...existing,
      stage,
      updatedAt: this.clock.now(),
    });
    this.store.putExit(updated);
    this.seal('HELIOS_EXIT_RECONCILED', { exit: updated, reconciliation });
    return ok({ exit: updated, reconciliation });
  }

  withdrawableCash(input: {
    readonly customerId: CustomerId;
    readonly investmentAccountId: string;
    readonly brokerageAccountId: string;
    readonly currency: string;
  }): WithdrawableCashSnapshot {
    const latest = this.store.latestReconciliation(input.investmentAccountId);
    const reserved = this.store
      .listActiveReservations(input.customerId, input.brokerageAccountId)
      .reduce((sum, row) => sum + BigInt(row.amountMinor), 0n);
    const mandate = this.mandate();
    return computeWithdrawableCash({
      customerId: input.customerId,
      investmentAccountId: input.investmentAccountId,
      brokerageAccountId: input.brokerageAccountId,
      currency: input.currency,
      investments: this.investments,
      reservedMinor: reserved.toString(),
      restrictedMinor: '0',
      latestReconciliationOutcome: latest?.outcome ?? null,
      reconciliationBlocksAvailability: latest?.blocksAvailability ?? false,
      asOf: this.clock.now(),
    });
  }

  evaluateReinvest(input: {
    readonly customerId: CustomerId;
    readonly investmentAccountId: string;
    readonly brokerageAccountId: string;
    readonly currency: string;
    readonly requestedMinor: string;
  }): ReinvestmentEligibility {
    const withdrawable = this.withdrawableCash({
      customerId: input.customerId,
      investmentAccountId: input.investmentAccountId,
      brokerageAccountId: input.brokerageAccountId,
      currency: input.currency,
    });
    const latest = this.store.latestReconciliation(input.investmentAccountId);
    const unsettled = this.investments
      .listSettlements(input.investmentAccountId)
      .some((row) => row.state === 'PENDING_SETTLEMENT');
    const pendingWithdrawal = this.store
      .listWithdrawalsForCustomer(input.customerId)
      .some((row) => row.state !== 'COMPLETED' && row.state !== 'FAILED' && row.state !== 'RETURNED');
    return evaluateReinvestmentEligibility({
      mandate: this.mandate(),
      withdrawable,
      requestedMinor: input.requestedMinor,
      hasPendingWithdrawal: pendingWithdrawal,
      latestReconciliationOutcome: latest?.outcome ?? null,
      hasUnsettledProceeds: unsettled,
    });
  }

  reserveCapital(input: ReserveCapitalInput): Result<CapitalReservation, CapitalLifecycleFailure> {
    const withdrawable = this.withdrawableCash({
      customerId: input.customerId,
      investmentAccountId: input.investmentAccountId,
      brokerageAccountId: input.accountId,
      currency: input.currency,
    });
    const available = BigInt(withdrawable.withdrawableMinor);
    const requested = BigInt(input.amountMinor);
    if (requested <= 0n) {
      return err({ code: 'INVALID_QUANTITY', message: 'reservation amount must be positive' });
    }
    const alreadyReserved = this.store
      .listActiveReservations(input.customerId, input.accountId)
      .reduce((sum, row) => sum + BigInt(row.amountMinor), 0n);
    if (alreadyReserved + requested > available) {
      return err({ code: 'INSUFFICIENT_WITHDRAWABLE', message: 'atomic reservation exceeds available capital' });
    }
    const reservation: CapitalReservation = Object.freeze({
      reservationId: asCapitalReservationId(`res_${randomUUID()}`),
      customerId: input.customerId,
      accountId: input.accountId,
      kind: input.kind,
      amountMinor: input.amountMinor,
      currency: input.currency,
      operationId: input.operationId,
      active: true,
      createdAt: this.clock.now(),
    });
    this.store.putReservation(reservation);
    this.seal('HELIOS_CAPITAL_RESERVED', reservation);
    return ok(reservation);
  }

  requestWithdrawal(input: RequestWithdrawalInput): Result<HeliosWithdrawalRequest, CapitalLifecycleFailure> {
    const replay = this.store.getWithdrawalByIdempotency(input.customerId, input.idempotencyKey);
    if (replay) {
      return ok(replay);
    }
    const duplicateOp = this.store.getWithdrawalByOperationId(input.customerId, input.operationId);
    if (duplicateOp && duplicateOp.state !== 'FAILED' && duplicateOp.state !== 'RETURNED') {
      return err({ code: 'DUPLICATE_WITHDRAWAL', message: 'withdrawal timeout does not authorize duplicate; reconcile first' });
    }

    const verified = this.destinations.verify({
      customerId: input.customerId,
      destinationId: input.destinationId,
      currency: input.currency,
    });
    if (!verified.ok) {
      return err({ code: 'DESTINATION_UNVERIFIED', message: verified.message });
    }

    const withdrawable = this.withdrawableCash({
      customerId: input.customerId,
      investmentAccountId: input.investmentAccountId,
      brokerageAccountId: input.sourceAccountId,
      currency: input.currency,
    });
    if (BigInt(input.amountMinor) > BigInt(withdrawable.withdrawableMinor)) {
      return err({ code: 'INSUFFICIENT_WITHDRAWABLE', message: 'requested amount exceeds server-calculated withdrawable cash' });
    }

    const reservation = this.reserveCapital({
      customerId: input.customerId,
      accountId: input.sourceAccountId,
      investmentAccountId: input.investmentAccountId,
      kind: 'WITHDRAWAL',
      amountMinor: input.amountMinor,
      currency: input.currency,
      operationId: input.operationId,
    });
    if (!reservation.ok) {
      return err(reservation.error);
    }

    const now = this.clock.now();
    let state: HeliosWithdrawalRequest['state'] = 'REQUESTED';
    const submitted = this.investments.withdrawBrokerageCash({
      idempotencyKey: input.idempotencyKey,
      actorId: input.actorId,
      now,
      brokerageAccountId: input.sourceAccountId,
      destinationAccountId: input.destinationId,
      amountMinor: input.amountMinor,
      currency: input.currency,
    });

    if (submitted.outcome === 'KERNEL_REFUSED') {
      this.store.releaseReservation(reservation.value.reservationId);
      return err({ code: 'KERNEL_REFUSED', message: submitted.message ?? 'withdrawal refused' });
    }
    if (submitted.outcome !== 'OK') {
      this.store.releaseReservation(reservation.value.reservationId);
      return err({ code: 'INSUFFICIENT_WITHDRAWABLE', message: submitted.message ?? 'withdrawal rejected' });
    }

    state = submitted.replay ? 'COMPLETED' : 'SUBMITTED';
    this.store.releaseReservation(reservation.value.reservationId);
    const withdrawal: HeliosWithdrawalRequest = Object.freeze({
      withdrawalRequestId: withdrawalRequestIdFor(String(input.customerId), input.operationId),
      customerId: input.customerId,
      sourceAccountId: input.sourceAccountId,
      destinationId: input.destinationId,
      destinationCoordinateRef: verified.destination.coordinateRef,
      amount: Object.freeze({ minorUnits: input.amountMinor, currency: input.currency }),
      operationId: input.operationId,
      fundingRail: input.fundingRail,
      mandateRef: input.mandateRef,
      environment: 'simulation',
      state,
      journalId: submitted.value?.journalId ?? null,
      idempotencyKey: input.idempotencyKey,
      timeoutAt: null,
      createdAt: now,
      updatedAt: now,
    });
    this.store.putWithdrawal(withdrawal);
    this.seal('HELIOS_WITHDRAWAL_REQUESTED', withdrawal);
    return ok(withdrawal);
  }

  completeWithdrawalAfterReconciliation(
    withdrawalRequestId: HeliosWithdrawalRequest['withdrawalRequestId'],
  ): Result<HeliosWithdrawalRequest, CapitalLifecycleFailure> {
    const existing = this.store.getWithdrawal(withdrawalRequestId);
    if (!existing) {
      return err({ code: 'NOT_FOUND', message: 'withdrawal not found' });
    }
    if (existing.state === 'COMPLETED') {
      return ok(existing);
    }
    for (const row of this.store.listActiveReservations(existing.customerId, existing.sourceAccountId)) {
      if (row.operationId === existing.operationId) {
        this.store.releaseReservation(row.reservationId);
      }
    }
    const updated = Object.freeze({
      ...existing,
      state: 'COMPLETED' as const,
      updatedAt: this.clock.now(),
    });
    this.store.putWithdrawal(updated);
    return ok(updated);
  }

  runPeriodicReconciliation(input: {
    readonly customerId: CustomerId;
    readonly investmentAccountId: string;
  }): import('./types.ts').CapitalReconciliationRun {
    const run = runCapitalReconciliation({
      customerId: input.customerId,
      investmentAccountId: input.investmentAccountId,
      investments: this.investments,
      now: this.clock.now(),
    });
    this.store.putReconciliation(run);
    this.seal('HELIOS_PERIODIC_RECONCILIATION', run);
    return run;
  }

  recoverFromCheckpoint(): { readonly recovered: true; readonly checkpoint: import('./types.ts').CapitalLifecycleCheckpoint } {
    const checkpoint = this.store.snapshot();
    this.store.restore(checkpoint);
    return Object.freeze({ recovered: true, checkpoint });
  }

  private seal(kind: string, payload: unknown): void {
    this.evidence?.seal(kind, payload as Record<string, unknown>);
  }
}
