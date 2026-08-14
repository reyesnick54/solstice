import type { Ledger } from '../../ledger/src/journal.ts';
import type { Journal } from '../../ledger/src/types.ts';
import type { ExecutionAuthority } from '../../permissions/src/execution-authority.ts';
import type { PaymentJournalPlan } from './accounting.ts';

/**
 * Authorized payment journal path. Every call verifies an Execution Authority
 * already issued by the Kernel and posts only through Ledger.postJournal.
 */
export function postPaymentJournal(
  ledger: Ledger,
  executionAuthority: ExecutionAuthority,
  actionType: string,
  plan: PaymentJournalPlan,
): Journal {
  return ledger.postJournal({
    idempotencyKey: `${executionAuthority.idempotencyKey}:${plan.suffix}`,
    executionAuthority,
    actionType,
    postings: plan.postings,
    memo: plan.memo,
    ...(plan.classBridge ? { classBridge: plan.classBridge } : {}),
  });
}
