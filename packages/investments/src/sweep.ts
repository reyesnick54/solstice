import type { ExecutionAuthority } from '../../platform/src/authority/ExecutionAuthority.ts';
import { Money } from '../../contracts/src/money.ts';
import type { UtcInstant } from '../../contracts/src/time.ts';
import { resolveClassBridge, isClassBridgeRefusal } from '../../ledger/src/class-bridge.ts';
import type { InvestmentAccount } from './account.ts';
import {
  InvestmentLedger,
  type InvestmentJournal,
} from './ledger/InvestmentLedger.ts';

export type SweepResult =
  | { readonly ok: true; readonly journal: InvestmentJournal }
  | {
      readonly ok: false;
      readonly code:
        | 'CLASS_BRIDGE_UNDEFINED'
        | 'UNBALANCED_JOURNAL'
        | 'MISSING_AUTHORITY'
        | 'INSUFFICIENT_DEPOSIT'
        | 'MISSING_TRANSFER_AUTHORIZATION';
    };

/**
 * Sweep Bridge: insured deposit → investment cash.
 * Routes only through DEPOSIT_TO_INVESTMENT_CASH_SWEEP. Refused entirely
 * if that bridge is undefined for the class pair.
 */
export function sweepDepositToInvestmentCash(
  ledger: InvestmentLedger,
  account: InvestmentAccount,
  depositAccountId: string,
  amount: Money,
  postedAt: UtcInstant,
  executionAuthority: ExecutionAuthority,
): SweepResult {
  if (account.preconditions.transferAuthorization.authorized !== true) {
    return { ok: false, code: 'MISSING_TRANSFER_AUTHORIZATION' };
  }
  const bridge = resolveClassBridge('INSURED_DEPOSIT', 'INVESTMENT_CASH');
  if (isClassBridgeRefusal(bridge)) {
    return { ok: false, code: 'CLASS_BRIDGE_UNDEFINED' };
  }
  if (ledger.balanceOf(depositAccountId) < amount.minorUnits) {
    return { ok: false, code: 'INSUFFICIENT_DEPOSIT' };
  }
  const posted = ledger.postJournal(
    {
      actionType: 'SWEEP_DEPOSIT_TO_INVESTMENT',
      fromClass: 'INSURED_DEPOSIT',
      toClass: 'INVESTMENT_CASH',
      fromAccountId: depositAccountId,
      toAccountId: account.cashAccountId,
      amount,
      memo: `sweep via ${bridge.name}`,
      postedAt,
    },
    executionAuthority,
  );
  if ('code' in posted) {
    return { ok: false, code: posted.code };
  }
  return { ok: true, journal: posted };
}

export function sweepUndefinedPair(
  ledger: InvestmentLedger,
  fromAccountId: string,
  toAccountId: string,
  amount: Money,
  postedAt: UtcInstant,
  executionAuthority: ExecutionAuthority,
): SweepResult {
  const posted = ledger.postJournal(
    {
      actionType: 'SWEEP_DEPOSIT_TO_INVESTMENT',
      fromClass: 'INSURED_DEPOSIT',
      toClass: 'INVESTMENT_SECURITY',
      fromAccountId,
      toAccountId,
      amount,
      memo: 'undefined pair must refuse',
      postedAt,
    },
    executionAuthority,
  );
  if ('code' in posted) {
    return { ok: false, code: posted.code };
  }
  return { ok: true, journal: posted };
}
