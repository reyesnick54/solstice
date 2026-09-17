import { err, ok, type Result } from '../imports.ts';
import type { ResearchMeshBudgetLimits, ResearchMeshBudgetSnapshot, ResearchMeshFailure } from './types.ts';

export const DEFAULT_MESH_BUDGET_LIMITS: ResearchMeshBudgetLimits = Object.freeze({
  workOrderCeilingMicros: 5_000_000n,
  taskCeilingMicros: 500_000n,
  specialistCeilingMicros: 250_000n,
  concurrencyLimit: 4,
  defaultTimeoutMs: 30_000,
  maxIterations: 3,
});

type BudgetLedger = {
  reservedMicros: bigint;
  spentMicros: bigint;
  activeTasks: number;
};

type ReservationRecord = {
  readonly workOrderId: string;
  readonly amountMicros: bigint;
};

export class ResearchMeshBudgetController {
  private readonly limits: ResearchMeshBudgetLimits;
  private readonly ledgers = new Map<string, BudgetLedger>();
  private readonly reservations = new Map<string, ReservationRecord>();

  constructor(limits: ResearchMeshBudgetLimits = DEFAULT_MESH_BUDGET_LIMITS) {
    this.limits = limits;
  }

  snapshot(workOrderId: string): ResearchMeshBudgetSnapshot {
    const ledger = this.ledger(workOrderId);
    const remaining = this.limits.workOrderCeilingMicros - ledger.reservedMicros - ledger.spentMicros;
    return Object.freeze({
      workOrderId,
      reservedMicros: ledger.reservedMicros,
      spentMicros: ledger.spentMicros,
      remainingMicros: remaining < 0n ? 0n : remaining,
      activeTasks: ledger.activeTasks,
    });
  }

  reserve(input: {
    readonly workOrderId: string;
    readonly taskId: string;
    readonly amountMicros: bigint;
  }): Result<{ readonly reservationRef: string }, ResearchMeshFailure> {
    const ledger = this.ledger(input.workOrderId);
    if (ledger.activeTasks >= this.limits.concurrencyLimit) {
      return err({ code: 'CONCURRENCY_LIMIT', message: 'research mesh concurrency limit reached' });
    }
    if (input.amountMicros > this.limits.taskCeilingMicros) {
      return err({ code: 'BUDGET_EXHAUSTED', message: 'task exceeds specialist task ceiling' });
    }
    if (input.amountMicros > this.limits.specialistCeilingMicros) {
      return err({ code: 'BUDGET_EXHAUSTED', message: 'task exceeds specialist ceiling' });
    }
    const remaining = this.limits.workOrderCeilingMicros - ledger.reservedMicros - ledger.spentMicros;
    if (input.amountMicros > remaining) {
      return err({ code: 'BUDGET_EXHAUSTED', message: 'insufficient work-order research budget' });
    }
    const reservationRef = `${input.workOrderId}:${input.taskId}`;
    ledger.reservedMicros += input.amountMicros;
    ledger.activeTasks += 1;
    this.reservations.set(reservationRef, {
      workOrderId: input.workOrderId,
      amountMicros: input.amountMicros,
    });
    return ok(Object.freeze({ reservationRef }));
  }

  reconcile(input: {
    readonly workOrderId: string;
    readonly reservationRef: string;
    readonly actualMicros: bigint;
    readonly cancelled?: boolean;
  }): Result<true, ResearchMeshFailure> {
    const reservation = this.reservations.get(input.reservationRef);
    const ledger = this.ledger(input.workOrderId);
    if (ledger.activeTasks <= 0 || !reservation) {
      return err({ code: 'VALIDATION_FAILED', message: 'no active task to reconcile' });
    }
    ledger.activeTasks -= 1;
    ledger.reservedMicros =
      ledger.reservedMicros > reservation.amountMicros
        ? ledger.reservedMicros - reservation.amountMicros
        : 0n;
    this.reservations.delete(input.reservationRef);
    if (!input.cancelled) {
      ledger.spentMicros += input.actualMicros;
    }
    return ok(true);
  }

  restore(workOrderId: string, snapshot: ResearchMeshBudgetSnapshot): void {
    this.ledgers.set(workOrderId, {
      reservedMicros: snapshot.reservedMicros,
      spentMicros: snapshot.spentMicros,
      activeTasks: snapshot.activeTasks,
    });
  }

  private ledger(workOrderId: string): BudgetLedger {
    const existing = this.ledgers.get(workOrderId);
    if (existing) {
      return existing;
    }
    const created: BudgetLedger = { reservedMicros: 0n, spentMicros: 0n, activeTasks: 0 };
    this.ledgers.set(workOrderId, created);
    return created;
  }
}
