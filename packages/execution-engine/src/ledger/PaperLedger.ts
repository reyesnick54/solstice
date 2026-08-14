import type { ExecutionAuthority } from '../../../platform/src/authority/ExecutionAuthority.ts';
import { Money } from '../../../contracts/src/money.ts';
import type { UtcInstant } from '../../../contracts/src/time.ts';

export type PaperJournalLine = {
  readonly accountId: string;
  readonly direction: 'DEBIT' | 'CREDIT';
  readonly amount: Money;
  readonly label: 'PAPER';
};

export type PaperJournal = {
  readonly id: string;
  readonly ledgerKind: 'PAPER';
  readonly neverCustomerLedger: true;
  readonly actionType: string;
  readonly authorityId: string;
  readonly lines: readonly PaperJournalLine[];
  readonly memo: string;
  readonly postedAt: UtcInstant;
  readonly eventVersion: number;
};

/**
 * Paper ledger. Simulated fills only. Never the customer ledger.
 * postJournal requires a signed Execution Authority.
 */
export class PaperLedger {
  private readonly journals: PaperJournal[] = [];

  postJournal(
    request: {
      readonly actionType: string;
      readonly paperCashAccountId: string;
      readonly paperSecuritiesAccountId: string;
      readonly amount: Money;
      readonly side: 'BUY' | 'SELL';
      readonly memo: string;
      readonly postedAt: UtcInstant;
    },
    executionAuthority: ExecutionAuthority,
  ): PaperJournal {
    if (
      !executionAuthority ||
      typeof executionAuthority.signature !== 'string' ||
      executionAuthority.signature.length === 0
    ) {
      throw new Error('paper ledger requires a signed Execution Authority');
    }
    const cashDir = request.side === 'BUY' ? 'CREDIT' : 'DEBIT';
    const secDir = request.side === 'BUY' ? 'DEBIT' : 'CREDIT';
    const lines = Object.freeze([
      Object.freeze({
        accountId: request.paperCashAccountId,
        direction: cashDir as 'DEBIT' | 'CREDIT',
        amount: request.amount,
        label: 'PAPER' as const,
      }),
      Object.freeze({
        accountId: request.paperSecuritiesAccountId,
        direction: secDir as 'DEBIT' | 'CREDIT',
        amount: request.amount,
        label: 'PAPER' as const,
      }),
    ]);
    let debit = 0n;
    let credit = 0n;
    for (const line of lines) {
      if (line.direction === 'DEBIT') debit += line.amount.minorUnits;
      else credit += line.amount.minorUnits;
    }
    if (debit !== credit) {
      throw new Error('PAPER journal is unbalanced');
    }
    const journal: PaperJournal = Object.freeze({
      id: `paper_jnl_${this.journals.length + 1}`,
      ledgerKind: 'PAPER',
      neverCustomerLedger: true,
      actionType: request.actionType,
      authorityId: executionAuthority.authorityId,
      lines,
      memo: request.memo,
      postedAt: request.postedAt,
      eventVersion: 1,
    });
    this.journals.push(journal);
    return journal;
  }

  list(): readonly PaperJournal[] {
    return this.journals.slice();
  }

  count(): number {
    return this.journals.length;
  }
}
