import type { CustomerId } from '../../../../domain/src/customer.ts';
import type {
  CapitalReconciliationRun,
  CapitalReservation,
  CapitalLifecycleCheckpoint,
  HeliosExitRequest,
  HeliosWithdrawalRequest,
} from './types.ts';
import type { HeliosExitRequestId, HeliosWithdrawalRequestId } from './ids.ts';

export class InMemoryCapitalLifecycleStore {
  private readonly exits = new Map<HeliosExitRequestId, HeliosExitRequest>();
  private readonly exitIdempotency = new Map<string, HeliosExitRequestId>();
  private readonly withdrawals = new Map<HeliosWithdrawalRequestId, HeliosWithdrawalRequest>();
  private readonly withdrawalIdempotency = new Map<string, HeliosWithdrawalRequestId>();
  private readonly withdrawalOperationIds = new Map<string, HeliosWithdrawalRequestId>();
  private readonly reconciliations: CapitalReconciliationRun[] = [];
  private readonly reservations = new Map<string, CapitalReservation>();

  putExit(row: HeliosExitRequest): void {
    this.exits.set(row.exitRequestId, Object.freeze({ ...row }));
    this.exitIdempotency.set(`${row.customerId}:${row.idempotencyKey}`, row.exitRequestId);
  }

  getExit(id: HeliosExitRequestId): HeliosExitRequest | undefined {
    return this.exits.get(id);
  }

  getExitByIdempotency(customerId: CustomerId, idempotencyKey: string): HeliosExitRequest | undefined {
    const id = this.exitIdempotency.get(`${customerId}:${idempotencyKey}`);
    return id ? this.exits.get(id) : undefined;
  }

  listExitsForCustomer(customerId: CustomerId): readonly HeliosExitRequest[] {
    return Object.freeze([...this.exits.values()].filter((row) => row.customerId === customerId));
  }

  putWithdrawal(row: HeliosWithdrawalRequest): void {
    this.withdrawals.set(row.withdrawalRequestId, Object.freeze({ ...row }));
    this.withdrawalIdempotency.set(`${row.customerId}:${row.idempotencyKey}`, row.withdrawalRequestId);
    this.withdrawalOperationIds.set(`${row.customerId}:${row.operationId}`, row.withdrawalRequestId);
  }

  getWithdrawal(id: HeliosWithdrawalRequestId): HeliosWithdrawalRequest | undefined {
    return this.withdrawals.get(id);
  }

  getWithdrawalByIdempotency(customerId: CustomerId, idempotencyKey: string): HeliosWithdrawalRequest | undefined {
    const id = this.withdrawalIdempotency.get(`${customerId}:${idempotencyKey}`);
    return id ? this.withdrawals.get(id) : undefined;
  }

  getWithdrawalByOperationId(customerId: CustomerId, operationId: string): HeliosWithdrawalRequest | undefined {
    const id = this.withdrawalOperationIds.get(`${customerId}:${operationId}`);
    return id ? this.withdrawals.get(id) : undefined;
  }

  listWithdrawalsForCustomer(customerId: CustomerId): readonly HeliosWithdrawalRequest[] {
    return Object.freeze([...this.withdrawals.values()].filter((row) => row.customerId === customerId));
  }

  putReconciliation(row: CapitalReconciliationRun): void {
    this.reconciliations.push(Object.freeze({ ...row, findings: Object.freeze([...row.findings]), mismatchKinds: Object.freeze([...row.mismatchKinds]) }));
  }

  latestReconciliation(investmentAccountId: string): CapitalReconciliationRun | undefined {
    for (let i = this.reconciliations.length - 1; i >= 0; i -= 1) {
      const row = this.reconciliations[i];
      if (row && row.investmentAccountId === investmentAccountId) {
        return row;
      }
    }
    return undefined;
  }

  listReconciliations(investmentAccountId: string): readonly CapitalReconciliationRun[] {
    return Object.freeze(this.reconciliations.filter((row) => row.investmentAccountId === investmentAccountId));
  }

  putReservation(row: CapitalReservation): void {
    this.reservations.set(row.reservationId, Object.freeze({ ...row }));
  }

  listActiveReservations(customerId: CustomerId, accountId: string): readonly CapitalReservation[] {
    return Object.freeze(
      [...this.reservations.values()].filter(
        (row) => row.active && row.customerId === customerId && row.accountId === accountId,
      ),
    );
  }

  releaseReservation(reservationId: string): void {
    const row = this.reservations.get(reservationId);
    if (row) {
      this.reservations.set(reservationId, Object.freeze({ ...row, active: false }));
    }
  }

  snapshot(): CapitalLifecycleCheckpoint {
    return Object.freeze({
      exits: Object.freeze([...this.exits.values()]),
      withdrawals: Object.freeze([...this.withdrawals.values()]),
      reconciliations: Object.freeze([...this.reconciliations]),
      reservations: Object.freeze([...this.reservations.values()]),
    });
  }

  restore(checkpoint: CapitalLifecycleCheckpoint): void {
    this.exits.clear();
    this.exitIdempotency.clear();
    this.withdrawals.clear();
    this.withdrawalIdempotency.clear();
    this.withdrawalOperationIds.clear();
    this.reconciliations.length = 0;
    this.reservations.clear();
    for (const row of checkpoint.exits) {
      this.putExit(row);
    }
    for (const row of checkpoint.withdrawals) {
      this.putWithdrawal(row);
    }
    for (const row of checkpoint.reconciliations) {
      this.putReconciliation(row);
    }
    for (const row of checkpoint.reservations) {
      this.putReservation(row);
    }
  }
}
