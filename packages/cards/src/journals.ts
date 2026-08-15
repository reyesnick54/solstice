import type { Ledger } from '../../ledger/src/journal.ts';
import type { Journal } from '../../ledger/src/types.ts';
import type { ExecutionAuthority } from '../../permissions/src/execution-authority.ts';
import type { CardJournalPlan } from './accounting.ts';

/**
 * Authorized card journal path. Every call verifies an Execution Authority
 * already issued by the Kernel and posts only through Ledger.postJournal.
 * Card adapters and the processor must not call this.
 */
export function postCardJournal(
  ledger: Ledger,
  executionAuthority: ExecutionAuthority,
  actionType: string,
  plan: CardJournalPlan,
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
