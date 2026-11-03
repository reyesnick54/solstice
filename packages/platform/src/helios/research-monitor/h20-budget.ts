import type { UtcInstant } from '@solstice/domain';
import { applyReservation, canReserveBudget, computeRemainingBudget, type ResearchBudgetSnapshot } from '../budget.ts';
import type { H20ResearchBudgetPort } from './types.ts';
import type { ResearchMonitorId } from './ids.ts';

export function createH20ResearchBudgetPort(initial: ResearchBudgetSnapshot): H20ResearchBudgetPort {
  let snapshot = Object.freeze({ ...initial, remainingBudget: computeRemainingBudget(initial) });

  return Object.freeze({
    get snapshot() {
      return snapshot;
    },
    reserveForResearch(input: {
      readonly monitorId: ResearchMonitorId;
      readonly amountMinor: string;
      readonly evaluatedAt: UtcInstant;
    }) {
      void input.monitorId;
      void input.evaluatedAt;
      const gate = canReserveBudget(snapshot, input.amountMinor);
      if ('code' in gate) {
        return {
          ok: false as const,
          code: gate.code === 'BUDGET_EXHAUSTED' ? ('BUDGET_EXHAUSTED' as const) : ('RESERVATION_FAILED' as const),
          message: gate.message,
        };
      }
      snapshot = applyReservation(snapshot, input.amountMinor);
      return { ok: true as const, snapshot };
    },
  });
}
