import type { ExecutionAuthority } from '../../platform/src/authority/ExecutionAuthority.ts';
import { Money, RoundingMode } from '../../contracts/src/money.ts';
import type { UtcInstant } from '../../contracts/src/time.ts';
import type {
  HarvestSharePercent,
  RealizedSettledProfit,
  RejectUnrealized,
  UnrealizedPnL,
} from '../../contracts/src/investment-types.ts';
import { isClassBridgeRefusal, resolveClassBridge } from '../../ledger/src/class-bridge.ts';
import type { InvestmentAccount } from './account.ts';
import {
  InvestmentLedger,
  type InvestmentJournal,
} from './ledger/InvestmentLedger.ts';
import { rejectUnrealizedSweep } from './pnl.ts';

export type HarvestResult =
  | { readonly ok: true; readonly journal: InvestmentJournal; readonly swept: Money }
  | {
      readonly ok: false;
      readonly code:
        | 'CLASS_BRIDGE_UNDEFINED'
        | 'UNBALANCED_JOURNAL'
        | 'MISSING_AUTHORITY'
        | 'UNREALIZED_IS_UNSWEEPABLE'
        | 'NOTHING_TO_HARVEST';
    };

/**
 * Weekly Harvest of REALIZED, SETTLED profit only.
 * The source parameter is RejectUnrealized<T> & RealizedSettledProfit —
 * passing UnrealizedPnL is a compile-time `never`.
 */
export function weeklyHarvest<T extends { readonly kind: string }>(
  ledger: InvestmentLedger,
  account: InvestmentAccount,
  depositAccountId: string,
  source: RejectUnrealized<T> & RealizedSettledProfit,
  share: HarvestSharePercent,
  postedAt: UtcInstant,
  executionAuthority: ExecutionAuthority,
): HarvestResult {
  if (source.kind !== 'REALIZED_SETTLED' || source.settled !== true) {
    return { ok: false, code: 'UNREALIZED_IS_UNSWEEPABLE' };
  }
  const bridge = resolveClassBridge('INVESTMENT_CASH', 'INSURED_DEPOSIT');
  if (isClassBridgeRefusal(bridge)) {
    return { ok: false, code: 'CLASS_BRIDGE_UNDEFINED' };
  }
  const swept = source.amount.share(
    { numerator: BigInt(share), denominator: 100n },
    RoundingMode.FLOOR,
  );
  if (swept.isZero()) {
    return { ok: false, code: 'NOTHING_TO_HARVEST' };
  }
  const posted = ledger.postJournal(
    {
      actionType: 'WEEKLY_HARVEST',
      fromClass: 'INVESTMENT_CASH',
      toClass: 'INSURED_DEPOSIT',
      fromAccountId: account.cashAccountId,
      toAccountId: depositAccountId,
      amount: swept,
      memo: `weekly harvest ${share}/100 realized settled via ${bridge.name}`,
      postedAt,
    },
    executionAuthority,
  );
  if ('code' in posted) {
    return { ok: false, code: posted.code };
  }
  return { ok: true, journal: posted, swept };
}

/**
 * Typed rejection for unrealized marks. Not a harvest path.
 */
export function harvestUnrealized(
  _mark: UnrealizedPnL,
): ReturnType<typeof rejectUnrealizedSweep> {
  return rejectUnrealizedSweep(_mark);
}
