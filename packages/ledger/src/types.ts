import type { AccountClass } from '../../domain/src/account-class.ts';
import type { AccountId } from '../../domain/src/account.ts';
import type { Money } from '../../money/src/money.ts';
import type { ExecutionAuthority } from '../../permissions/src/execution-authority.ts';

export type DebitCredit = 'DEBIT' | 'CREDIT';

export type LedgerAccount = {
  readonly id: string;
  readonly name: string;
  readonly accountClass: AccountClass;
  readonly currency: string;
  readonly ownerId?: string;
};

export type Posting = {
  readonly id: string;
  readonly accountId: string;
  readonly direction: DebitCredit;
  readonly amount: Money;
};

export type Journal = {
  readonly id: string;
  readonly idempotencyKey: string;
  readonly executionAuthorityId: string;
  readonly actionType: string;
  readonly asset: string;
  readonly postings: readonly Posting[];
  readonly classBridgeName?: string;
  readonly memo?: string;
  readonly createdAt: string;
};

/**
 * A named, disclosed permission to post across two account classes.
 * A bridge cannot waive no-commingling (CUSTOMER + CORPORATE ownership).
 */
export type ClassBridge = {
  readonly name: string;
  readonly fromClass: AccountClass;
  readonly toClass: AccountClass;
  readonly disclosed: true;
  readonly purpose: string;
};

export type ProposedPosting = {
  readonly accountId: string;
  readonly direction: DebitCredit;
  readonly amount: Money;
};

/**
 * Journal-posting API request.
 * Ledger.postJournal(request) is the only write path.
 * executionAuthority is required on every journal.
 */
export type PostJournalRequest = {
  readonly idempotencyKey: string;
  readonly executionAuthority: ExecutionAuthority;
  readonly actionType: string;
  readonly postings: readonly ProposedPosting[];
  readonly classBridge?: ClassBridge;
  readonly memo?: string;
};

export const SIMULATION_FUNDING_SOURCE_ID = 'SIMULATION.FUNDING_SOURCE' as AccountId;

export const SIMULATED_FUNDING_TO_DEMAND_DEPOSIT: ClassBridge = Object.freeze({
  name: 'SIMULATED_FUNDING_TO_DEMAND_DEPOSIT',
  fromClass: 'SIMULATED_FUNDING_SOURCE',
  toClass: 'DEMAND_DEPOSIT',
  disclosed: true,
  purpose:
    'Simulation-only inbound funding of demand-deposit accounts. The contra is SIMULATION.FUNDING_SOURCE — never a corporate account and never an unlabelled plug.',
});

export const SIMULATED_FUNDING_TO_SAVINGS_DEPOSIT: ClassBridge = Object.freeze({
  name: 'SIMULATED_FUNDING_TO_SAVINGS_DEPOSIT',
  fromClass: 'SIMULATED_FUNDING_SOURCE',
  toClass: 'SAVINGS_DEPOSIT',
  disclosed: true,
  purpose: 'Simulation-only inbound funding of savings-deposit accounts.',
});

export const DEPOSIT_INTERNAL_BRIDGE: ClassBridge = Object.freeze({
  name: 'DEPOSIT_INTERNAL',
  fromClass: 'DEMAND_DEPOSIT',
  toClass: 'SAVINGS_DEPOSIT',
  disclosed: true,
  purpose: 'Internal transfer between a customer demand-deposit and savings-deposit account.',
});

export const DEFINED_CLASS_BRIDGES: readonly ClassBridge[] = [
  SIMULATED_FUNDING_TO_DEMAND_DEPOSIT,
  SIMULATED_FUNDING_TO_SAVINGS_DEPOSIT,
  DEPOSIT_INTERNAL_BRIDGE,
];

export function findClassBridge(
  fromClass: AccountClass,
  toClass: AccountClass,
): ClassBridge | undefined {
  if (fromClass === toClass) {
    return undefined;
  }
  return DEFINED_CLASS_BRIDGES.find(
    (bridge) =>
      (bridge.fromClass === fromClass && bridge.toClass === toClass) ||
      (bridge.fromClass === toClass && bridge.toClass === fromClass),
  );
}

export type LedgerInvariantName =
  | 'BALANCE'
  | 'IMMUTABILITY'
  | 'AUTHORITY'
  | 'CLASS_BRIDGE'
  | 'NO_COMMINGLING'
  | 'IDEMPOTENCY';

export class LedgerInvariantError extends Error {
  readonly invariant: LedgerInvariantName;

  constructor(invariant: LedgerInvariantName, message: string) {
    super(`[${invariant}] ${message}`);
    this.name = 'LedgerInvariantError';
    this.invariant = invariant;
  }
}
