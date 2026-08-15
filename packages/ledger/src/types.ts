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

export function simulationFundingSourceId(currency: string): AccountId {
  if (currency === 'USD') {
    return SIMULATION_FUNDING_SOURCE_ID;
  }
  return `SIMULATION.FUNDING_SOURCE.${currency}` as AccountId;
}

export function simulationFeeCollectorId(currency: string): AccountId {
  return `SIMULATION.FEE_COLLECTOR.${currency}` as AccountId;
}

export function simulationInterestSourceId(currency: string): AccountId {
  return `SIMULATION.INTEREST_SOURCE.${currency}` as AccountId;
}

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

export const DEMAND_DEPOSIT_TO_PENDING_SETTLEMENT: ClassBridge = Object.freeze({
  name: 'DEMAND_DEPOSIT_TO_PENDING_SETTLEMENT',
  fromClass: 'DEMAND_DEPOSIT',
  toClass: 'PENDING_SETTLEMENT',
  disclosed: true,
  purpose: 'Reserve customer demand-deposit funds into pending settlement for an authorized payment.',
});

export const PENDING_SETTLEMENT_TO_SIMULATED_FUNDING: ClassBridge = Object.freeze({
  name: 'PENDING_SETTLEMENT_TO_SIMULATED_FUNDING',
  fromClass: 'PENDING_SETTLEMENT',
  toClass: 'SIMULATED_FUNDING_SOURCE',
  disclosed: true,
  purpose: 'Capture reserved customer funds into simulation treasury or fee-clearing books.',
});

export const SIMULATED_FUNDING_TO_CORPORATE_OPERATING: ClassBridge = Object.freeze({
  name: 'SIMULATED_FUNDING_TO_CORPORATE_OPERATING',
  fromClass: 'SIMULATED_FUNDING_SOURCE',
  toClass: 'CORPORATE_OPERATING',
  disclosed: true,
  purpose: 'Move an explicit simulation fee from system fee-clearing into corporate operating income.',
});

export const DEMAND_DEPOSIT_TO_SIMULATED_FUNDING: ClassBridge = Object.freeze({
  name: 'DEMAND_DEPOSIT_TO_SIMULATED_FUNDING',
  fromClass: 'DEMAND_DEPOSIT',
  toClass: 'SIMULATED_FUNDING_SOURCE',
  disclosed: true,
  purpose: 'Return captured payment principal from simulation treasury to the customer demand-deposit.',
});

export const DEMAND_TO_PENDING_SETTLEMENT: ClassBridge = Object.freeze({
  name: 'DEMAND_TO_PENDING_SETTLEMENT',
  fromClass: 'DEMAND_DEPOSIT',
  toClass: 'PENDING_SETTLEMENT',
  disclosed: true,
  purpose:
    'Move customer funds into PENDING_SETTLEMENT. Pending is not mixed into settled deposit balance.',
});

export const SIMULATED_FUNDING_TO_PENDING_SETTLEMENT: ClassBridge = Object.freeze({
  name: 'SIMULATED_FUNDING_TO_PENDING_SETTLEMENT',
  fromClass: 'SIMULATED_FUNDING_SOURCE',
  toClass: 'PENDING_SETTLEMENT',
  disclosed: true,
  purpose: 'Simulation-only settlement or return of pending funds against the named funding source.',
});

export const DEMAND_DEPOSIT_TO_BROKERAGE_CASH: ClassBridge = Object.freeze({
  name: 'DEMAND_DEPOSIT_TO_BROKERAGE_CASH',
  fromClass: 'DEMAND_DEPOSIT',
  toClass: 'BROKERAGE_CASH',
  disclosed: true,
  purpose:
    'Authorized class bridge from a demand deposit into segregated brokerage cash. Brokerage cash is not treated as an insured deposit.',
});

export const SAVINGS_DEPOSIT_TO_BROKERAGE_CASH: ClassBridge = Object.freeze({
  name: 'SAVINGS_DEPOSIT_TO_BROKERAGE_CASH',
  fromClass: 'SAVINGS_DEPOSIT',
  toClass: 'BROKERAGE_CASH',
  disclosed: true,
  purpose: 'Authorized class bridge from a savings deposit into segregated brokerage cash.',
});

export const BROKERAGE_CASH_TO_PENDING_SETTLEMENT: ClassBridge = Object.freeze({
  name: 'BROKERAGE_CASH_TO_PENDING_SETTLEMENT',
  fromClass: 'BROKERAGE_CASH',
  toClass: 'PENDING_SETTLEMENT',
  disclosed: true,
  purpose: 'Move brokerage cash into pending investment settlement for a paper fill.',
});

export const BROKERAGE_CASH_TO_SIMULATED_FUNDING: ClassBridge = Object.freeze({
  name: 'BROKERAGE_CASH_TO_SIMULATED_FUNDING',
  fromClass: 'BROKERAGE_CASH',
  toClass: 'SIMULATED_FUNDING_SOURCE',
  disclosed: true,
  purpose: 'Consume or restore simulation clearing cash for paper securities acquisition, fees, or proceeds.',
});

export const DEFINED_CLASS_BRIDGES: readonly ClassBridge[] = [
  SIMULATED_FUNDING_TO_DEMAND_DEPOSIT,
  SIMULATED_FUNDING_TO_SAVINGS_DEPOSIT,
  DEPOSIT_INTERNAL_BRIDGE,
  DEMAND_DEPOSIT_TO_PENDING_SETTLEMENT,
  PENDING_SETTLEMENT_TO_SIMULATED_FUNDING,
  SIMULATED_FUNDING_TO_CORPORATE_OPERATING,
  DEMAND_DEPOSIT_TO_SIMULATED_FUNDING,
  DEMAND_TO_PENDING_SETTLEMENT,
  SIMULATED_FUNDING_TO_PENDING_SETTLEMENT,
  DEMAND_DEPOSIT_TO_BROKERAGE_CASH,
  SAVINGS_DEPOSIT_TO_BROKERAGE_CASH,
  BROKERAGE_CASH_TO_PENDING_SETTLEMENT,
  BROKERAGE_CASH_TO_SIMULATED_FUNDING,
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
