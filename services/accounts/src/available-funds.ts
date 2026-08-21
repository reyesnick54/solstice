import type { Account } from '../../../packages/domain/src/account.ts';
import { ACCOUNT_CLASS_CATALOG } from '../../../packages/domain/src/account-class.ts';
import { isActiveHold, type FundsHold } from '../../../packages/domain/src/hold.ts';
import { err, isErr, ok, type Result } from '../../../packages/domain/src/result.ts';
import type { UtcInstant } from '../../../packages/domain/src/time.ts';
import type { Ledger } from '../../../packages/ledger/src/journal.ts';
import { Money } from '../../../packages/money/src/money.ts';
import { balanceOfAccount, type MixedCurrencyWithoutConversion } from './balances.ts';

export type BankingPosition = {
  readonly accountId: Account['id'];
  readonly currency: string;
  readonly ledgerBalance: Money;
  readonly posted: Money;
  readonly settled: Money;
  readonly pending: Money;
  readonly held: Money;
  readonly available: Money;
};

export type HoldView = {
  listByAccount(accountId: Account['id']): readonly FundsHold[];
};

export function activeHeldAmount(
  holds: HoldView,
  account: Account,
  now: UtcInstant,
): Money {
  let held = Money.zero(account.currency);
  for (const hold of holds.listByAccount(account.id)) {
    if (!isActiveHold(hold, now)) {
      continue;
    }
    if (hold.currency !== account.currency) {
      throw new TypeError('hold currency does not match account');
    }
    held = held.plus(Money.fromMinorUnits(hold.amountMinorUnits, hold.currency));
  }
  return held;
}

/**
 * Available = settled ledger position − ACTIVE holds.
 * PENDING_SETTLEMENT is not mixed into settled deposit balance.
 * No overdraft.
 */
export function projectBankingPosition(
  ledger: Ledger,
  account: Account,
  holds: HoldView,
  now: UtcInstant,
): Result<BankingPosition, MixedCurrencyWithoutConversion> {
  const ledgerBalance = balanceOfAccount(ledger, account);
  if (isErr(ledgerBalance)) {
    return ledgerBalance;
  }
  const record = ACCOUNT_CLASS_CATALOG[account.accountClass];
  const isPendingClass = record.positionBucket === 'pending';
  const settled = isPendingClass ? Money.zero(account.currency) : ledgerBalance.value;
  const pending = isPendingClass ? ledgerBalance.value : Money.zero(account.currency);
  const held = activeHeldAmount(holds, account, now);
  const available = settled.minus(held);
  return ok(
    Object.freeze({
      accountId: account.id,
      currency: account.currency,
      ledgerBalance: ledgerBalance.value,
      posted: ledgerBalance.value,
      settled,
      pending,
      held,
      available,
    }),
  );
}

export function assertSufficientAvailable(
  position: BankingPosition,
  amount: Money,
): Result<true, { readonly code: 'INSUFFICIENT_FUNDS'; readonly message: string }> {
  if (position.available.currency !== amount.currency) {
    return err({
      code: 'INSUFFICIENT_FUNDS',
      message: 'available-funds currency does not match requested amount',
    });
  }
  if (position.available.cmp(amount) < 0) {
    return err({
      code: 'INSUFFICIENT_FUNDS',
      message: 'request exceeds available funds; nothing reserved or posted',
    });
  }
  return ok(true);
}
