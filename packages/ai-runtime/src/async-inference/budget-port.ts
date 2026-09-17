import type { InferenceCostStatus } from './taxonomy.ts';

export type ResearchBudgetReservationRequest = {
  readonly workOrderId: string;
  readonly taskId: string | null;
  readonly customerId: string;
  readonly reservationRef: string;
  readonly amountMicros: string;
  readonly unitKind: 'MONETARY_MINOR' | 'INPUT_TOKENS' | 'OUTPUT_TOKENS' | 'INFERENCE_CALLS';
};

export type ResearchBudgetReconciliation = {
  readonly reservationRef: string;
  readonly actualMicros: string;
  readonly estimatedMicros: string | null;
  readonly costStatus: InferenceCostStatus;
  readonly succeeded: boolean;
  readonly cancelled: boolean;
};

export type ResearchBudgetPort = {
  readonly reserve: (request: ResearchBudgetReservationRequest) => { readonly ok: true } | { readonly ok: false; readonly code: string; readonly message: string };
  readonly reconcile: (input: ResearchBudgetReconciliation) => { readonly ok: true } | { readonly ok: false; readonly code: string; readonly message: string };
};

export class InMemoryResearchBudgetPort implements ResearchBudgetPort {
  private readonly reserved = new Map<string, bigint>();
  private readonly spent = new Map<string, bigint>();
  private readonly ceilings = new Map<string, bigint>();

  setCeiling(workOrderId: string, micros: string): void {
    this.ceilings.set(workOrderId, BigInt(micros));
  }

  reserve(request: ResearchBudgetReservationRequest): { readonly ok: true } | { readonly ok: false; readonly code: string; readonly message: string } {
    const ceiling = this.ceilings.get(request.workOrderId) ?? 0n;
    const used = (this.spent.get(request.workOrderId) ?? 0n)
      + [...this.reserved.entries()]
        .filter(([key]) => key.startsWith(`${request.workOrderId}:`))
        .reduce((sum, [, value]) => sum + value, 0n);
    const amount = BigInt(request.amountMicros);
    if (used + amount > ceiling) {
      return { ok: false, code: 'BUDGET_EXHAUSTED', message: 'insufficient research budget' };
    }
    this.reserved.set(`${request.workOrderId}:${request.reservationRef}`, amount);
    return { ok: true };
  }

  reconcile(input: ResearchBudgetReconciliation): { readonly ok: true } | { readonly ok: false; readonly code: string; readonly message: string } {
    let reservedEntry: [string, bigint] | undefined;
    for (const entry of this.reserved.entries()) {
      if (entry[0].endsWith(`:${input.reservationRef}`)) {
        reservedEntry = entry;
        break;
      }
    }
    if (!reservedEntry) {
      return { ok: false, code: 'RESERVATION_NOT_FOUND', message: 'reservation missing' };
    }
    const [key, reservedAmount] = reservedEntry;
    const workOrderId = key.split(':')[0] ?? '';
    const actual = BigInt(input.actualMicros || '0');
    this.reserved.delete(key);
    this.spent.set(workOrderId, (this.spent.get(workOrderId) ?? 0n) + actual);
    return { ok: true };
  }
}
