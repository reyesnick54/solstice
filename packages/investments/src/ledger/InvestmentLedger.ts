import type { ExecutionAuthority } from '../../../platform/src/authority/ExecutionAuthority.ts';
import { Money } from '../../../contracts/src/money.ts';
import type { UtcInstant } from '../../../contracts/src/time.ts';
import {
  isClassBridgeRefusal,
  resolveClassBridge,
  type NamedClassBridge,
  type ProductLedgerClass,
} from '../../../ledger/src/class-bridge.ts';

export type InvestmentJournalLine = {
  readonly accountId: string;
  readonly positionClass: ProductLedgerClass;
  readonly side: 'DEPOSIT_BOOK' | 'INVESTMENT_BOOK';
  readonly direction: 'DEBIT' | 'CREDIT';
  readonly amount: Money;
};

export type InvestmentJournal = {
  readonly id: string;
  readonly ledgerKind: 'CUSTOMER_INVESTMENT';
  readonly actionType: string;
  readonly authorityId: string;
  readonly classBridgeName: string;
  readonly lines: readonly InvestmentJournalLine[];
  readonly memo: string;
  readonly postedAt: UtcInstant;
};

/**
 * Customer investment ledger. Cash and securities are distinct positions.
 * Cross-class posts require a named disclosed bridge and a signed
 * Execution Authority. Paper fills must never call this class.
 */
export class InvestmentLedger {
  private readonly journals: InvestmentJournal[] = [];
  private readonly balances = new Map<string, bigint>();

  postJournal(
    request: {
      readonly actionType: string;
      readonly fromClass: ProductLedgerClass;
      readonly toClass: ProductLedgerClass;
      readonly fromAccountId: string;
      readonly toAccountId: string;
      readonly amount: Money;
      readonly memo: string;
      readonly postedAt: UtcInstant;
    },
    executionAuthority: ExecutionAuthority,
  ):
    | InvestmentJournal
    | { readonly code: 'CLASS_BRIDGE_UNDEFINED' | 'UNBALANCED_JOURNAL' | 'MISSING_AUTHORITY' } {
    if (!executionAuthority || typeof executionAuthority.signature !== 'string') {
      return { code: 'MISSING_AUTHORITY' };
    }
    const bridge = resolveClassBridge(request.fromClass, request.toClass);
    if (isClassBridgeRefusal(bridge)) {
      return { code: 'CLASS_BRIDGE_UNDEFINED' };
    }
    return this.commitBothSides(request, executionAuthority, bridge);
  }

  /**
   * Two balanced journals, one on each side of the disclosed bridge.
   *
   * Deposit book:
   *   CREDIT customer from-class account (asset decrease)
   *   DEBIT  bridge clearing (from side)
   *
   * Investment book:
   *   DEBIT  customer to-class account (asset increase)
   *   CREDIT bridge clearing (to side)
   */
  private commitBothSides(
    request: {
      readonly actionType: string;
      readonly fromClass: ProductLedgerClass;
      readonly toClass: ProductLedgerClass;
      readonly fromAccountId: string;
      readonly toAccountId: string;
      readonly amount: Money;
      readonly memo: string;
      readonly postedAt: UtcInstant;
    },
    executionAuthority: ExecutionAuthority,
    bridge: NamedClassBridge,
  ): InvestmentJournal | { readonly code: 'UNBALANCED_JOURNAL' } {
    const depositSide: readonly InvestmentJournalLine[] = Object.freeze([
      Object.freeze({
        accountId: request.fromAccountId,
        positionClass: request.fromClass,
        side: 'DEPOSIT_BOOK' as const,
        direction: 'CREDIT' as const,
        amount: request.amount,
      }),
      Object.freeze({
        accountId: `bridge.clearing.${bridge.name}.from`,
        positionClass: request.fromClass,
        side: 'DEPOSIT_BOOK' as const,
        direction: 'DEBIT' as const,
        amount: request.amount,
      }),
    ]);
    const investmentSide: readonly InvestmentJournalLine[] = Object.freeze([
      Object.freeze({
        accountId: request.toAccountId,
        positionClass: request.toClass,
        side: 'INVESTMENT_BOOK' as const,
        direction: 'DEBIT' as const,
        amount: request.amount,
      }),
      Object.freeze({
        accountId: `bridge.clearing.${bridge.name}.to`,
        positionClass: request.toClass,
        side: 'INVESTMENT_BOOK' as const,
        direction: 'CREDIT' as const,
        amount: request.amount,
      }),
    ]);
    const lines = Object.freeze([...depositSide, ...investmentSide]);
    if (!sideBalances(depositSide) || !sideBalances(investmentSide)) {
      return { code: 'UNBALANCED_JOURNAL' };
    }
    const journal: InvestmentJournal = Object.freeze({
      id: `inv_jnl_${this.journals.length + 1}`,
      ledgerKind: 'CUSTOMER_INVESTMENT',
      actionType: request.actionType,
      authorityId: executionAuthority.authorityId,
      classBridgeName: bridge.name,
      lines,
      memo: request.memo,
      postedAt: request.postedAt,
    });
    this.journals.push(journal);
    this.apply(request.fromAccountId, -request.amount.minorUnits);
    this.apply(request.toAccountId, request.amount.minorUnits);
    return journal;
  }

  private apply(accountId: string, delta: bigint): void {
    this.balances.set(accountId, (this.balances.get(accountId) ?? 0n) + delta);
  }

  seedInsuredDeposit(
    accountId: string,
    amount: Money,
    executionAuthority: ExecutionAuthority,
    postedAt: UtcInstant,
  ): void {
    this.apply(accountId, amount.minorUnits);
    this.journals.push(
      Object.freeze({
        id: `inv_jnl_${this.journals.length + 1}`,
        ledgerKind: 'CUSTOMER_INVESTMENT',
        actionType: 'SEED_INSURED_DEPOSIT',
        authorityId: executionAuthority.authorityId,
        classBridgeName: 'NONE_SAME_CLASS',
        lines: Object.freeze([
          Object.freeze({
            accountId,
            positionClass: 'INSURED_DEPOSIT' as const,
            side: 'DEPOSIT_BOOK' as const,
            direction: 'DEBIT' as const,
            amount,
          }),
          Object.freeze({
            accountId: 'SIMULATION.FUNDING_SOURCE',
            positionClass: 'INSURED_DEPOSIT' as const,
            side: 'DEPOSIT_BOOK' as const,
            direction: 'CREDIT' as const,
            amount,
          }),
        ]),
        memo: 'simulation seed of insured deposit',
        postedAt,
      }),
    );
  }

  creditInvestmentCash(
    accountId: string,
    amount: Money,
    executionAuthority: ExecutionAuthority,
  ): void {
    void executionAuthority;
    this.apply(accountId, amount.minorUnits);
  }

  debitInvestmentCash(
    accountId: string,
    amount: Money,
    executionAuthority: ExecutionAuthority,
  ): void {
    void executionAuthority;
    this.apply(accountId, -amount.minorUnits);
  }

  balanceOf(accountId: string): bigint {
    return this.balances.get(accountId) ?? 0n;
  }

  list(): readonly InvestmentJournal[] {
    return this.journals.slice();
  }

  count(): number {
    return this.journals.length;
  }
}

function sideBalances(lines: readonly InvestmentJournalLine[]): boolean {
  let debit = 0n;
  let credit = 0n;
  for (const line of lines) {
    if (line.direction === 'DEBIT') debit += line.amount.minorUnits;
    else credit += line.amount.minorUnits;
  }
  return debit === credit && debit > 0n;
}
