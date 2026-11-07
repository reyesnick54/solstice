import type { UtcInstant } from '@solstice/domain';

import type { Exec12ExecutionRestrictionReason, Exec12ExecutionRestrictionState } from './taxonomy.ts';
import type { Exec12ExecutionRestriction, Exec12ReconciliationBreak } from './types.ts';

export function deriveExec12ExecutionRestriction(input: {
  readonly customerId: Exec12ExecutionRestriction['customerId'];
  readonly accountId: string;
  readonly breaks: readonly Exec12ReconciliationBreak[];
  readonly now: UtcInstant;
  readonly evidenceRef: string;
}): Exec12ExecutionRestriction {
  const reasons = new Set<Exec12ExecutionRestrictionReason>();
  const activeBreakIds: Exec12ExecutionRestriction['activeBreakIds'][number][] = [];

  for (const row of input.breaks) {
    activeBreakIds.push(row.breakId);
    if (row.kind === 'UNKNOWN_EXTERNAL_ORDER' || row.ambiguousExternal) {
      reasons.add('UNKNOWN_EXTERNAL_ORDER');
      reasons.add('AMBIGUOUS_EXTERNAL_ORDER');
    } else {
      reasons.add('OPEN_RECONCILIATION_BREAK');
    }
  }

  const state: Exec12ExecutionRestrictionState = reasons.size > 0 ? 'RESTRICTED' : 'NONE';

  return Object.freeze({
    customerId: input.customerId,
    accountId: input.accountId,
    state,
    reasons: Object.freeze([...reasons]),
    activeBreakIds: Object.freeze(activeBreakIds),
    imposedAt: input.now,
    evidenceRef: input.evidenceRef,
  });
}

export function executionPermitted(restriction: Exec12ExecutionRestriction | null): boolean {
  return restriction === null || restriction.state === 'NONE';
}
