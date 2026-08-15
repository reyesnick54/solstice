import type { UtcInstant } from '../../domain/src/time.ts';
import type { Money } from '../../money/src/money.ts';
import type { InvestmentAccountId, ReconciliationId } from './ids.ts';
import type { ReconciliationResult } from './types.ts';

export type InvestmentReconciliation = {
  readonly reconciliationId: ReconciliationId;
  readonly investmentAccountId: InvestmentAccountId;
  readonly result: ReconciliationResult;
  readonly findings: readonly string[];
  readonly cashLedger: Money | null;
  readonly cashInternal: Money | null;
  readonly autoAdjusted: false;
  readonly createdAt: UtcInstant;
};

export function freezeReconciliation(row: InvestmentReconciliation): InvestmentReconciliation {
  if (row.autoAdjusted !== false) {
    throw new Error('reconciliation must never auto-manufacture balancing adjustments');
  }
  return Object.freeze({ ...row, findings: Object.freeze([...row.findings]) });
}
