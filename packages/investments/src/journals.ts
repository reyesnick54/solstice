import type { ExecutionAuthority } from '../../permissions/src/execution-authority.ts';
import { Ledger } from '../../ledger/src/journal.ts';
import {
  findClassBridge,
  simulationFeeCollectorId,
  simulationFundingSourceId,
  type ClassBridge,
  type Journal,
} from '../../ledger/src/types.ts';
import type { AccountId } from '../../domain/src/account.ts';
import type { Money } from '../../money/src/money.ts';

export function demandToBrokerageBridge(): ClassBridge {
  const bridge = findClassBridge('DEMAND_DEPOSIT', 'BROKERAGE_CASH');
  if (!bridge) {
    throw new Error('DEMAND_DEPOSIT ↔ BROKERAGE_CASH class bridge is required');
  }
  return bridge;
}

export function savingsToBrokerageBridge(): ClassBridge {
  const bridge = findClassBridge('SAVINGS_DEPOSIT', 'BROKERAGE_CASH');
  if (!bridge) {
    throw new Error('SAVINGS_DEPOSIT ↔ BROKERAGE_CASH class bridge is required');
  }
  return bridge;
}

export function brokerageToPendingBridge(): ClassBridge {
  const bridge = findClassBridge('BROKERAGE_CASH', 'PENDING_SETTLEMENT');
  if (!bridge) {
    throw new Error('BROKERAGE_CASH ↔ PENDING_SETTLEMENT class bridge is required');
  }
  return bridge;
}

export function brokerageToFundingBridge(): ClassBridge {
  const bridge = findClassBridge('BROKERAGE_CASH', 'SIMULATED_FUNDING_SOURCE');
  if (!bridge) {
    throw new Error('BROKERAGE_CASH ↔ SIMULATED_FUNDING_SOURCE class bridge is required');
  }
  return bridge;
}

export function postInvestmentJournal(
  ledger: Ledger,
  input: {
    readonly idempotencyKey: string;
    readonly executionAuthority: ExecutionAuthority;
    readonly actionType: string;
    readonly memo: string;
    readonly debitAccountId: AccountId | string;
    readonly creditAccountId: AccountId | string;
    readonly amount: Money;
    readonly classBridge?: ClassBridge;
  },
): Journal {
  const debit = { accountId: String(input.debitAccountId), direction: 'DEBIT' as const, amount: input.amount };
  const credit = { accountId: String(input.creditAccountId), direction: 'CREDIT' as const, amount: input.amount };
  const bound = String(input.executionAuthority.accountId);
  const postings = bound === credit.accountId ? [credit, debit] : [debit, credit];
  return ledger.postJournal({
    idempotencyKey: input.idempotencyKey,
    executionAuthority: input.executionAuthority,
    actionType: input.actionType,
    memo: input.memo,
    classBridge: input.classBridge,
    postings,
  });
}

export function investmentClearingId(currency: string): string {
  return simulationFundingSourceId(currency);
}

export function investmentFeeCollectorId(currency: string): string {
  return simulationFeeCollectorId(currency);
}
