import type { Money } from "../money/Money.ts";

export type DebitCredit = "DEBIT" | "CREDIT";

/**
 * Account classes. Crossing classes requires a named disclosed ClassBridge.
 * CUSTOMER and CORPORATE must never appear on the same journal (no commingling).
 */
export type AccountClass = "CUSTOMER" | "CORPORATE" | "SIMULATION" | "SYSTEM";

export type AccountNormalBalance = "DEBIT" | "CREDIT";

export type CustomerClearance = "CLEARED" | "BLOCKED";

export interface Account {
  readonly id: string;
  readonly name: string;
  readonly class: AccountClass;
  readonly normalBalance: AccountNormalBalance;
  readonly asset: string;
  readonly customerId?: string;
  readonly clearance?: CustomerClearance;
}

export interface Posting {
  readonly id: string;
  readonly accountId: string;
  readonly direction: DebitCredit;
  readonly amount: Money;
}

export interface Journal {
  readonly id: string;
  readonly idempotencyKey: string;
  readonly executionAuthorityId: string;
  readonly actionType: string;
  readonly asset: string;
  readonly postings: readonly Posting[];
  readonly classBridgeName?: string;
  readonly memo?: string;
  readonly createdAt: string;
}

/**
 * A named, disclosed permission to post across two account classes.
 * A bridge cannot waive no-commingling (CUSTOMER + CORPORATE).
 */
export interface ClassBridge {
  readonly name: string;
  readonly fromClass: AccountClass;
  readonly toClass: AccountClass;
  readonly disclosed: true;
  readonly purpose: string;
}

export interface ProposedPosting {
  readonly accountId: string;
  readonly direction: DebitCredit;
  readonly amount: Money;
}

/**
 * Journal-posting API request.
 *
 * Ledger.postJournal(request: PostJournalRequest): Journal
 *   file: src/ledger/journal.ts
 *
 * Required:
 *   - idempotencyKey (repeat → exactly one journal)
 *   - executionAuthority when any posting touches a CUSTOMER account
 *   - postings that balance per asset (sum DEBIT == sum CREDIT)
 *   - classBridge when postings span more than one AccountClass
 *
 * Forbidden:
 *   - UPDATE / DELETE of any journal or posting
 *   - floating-point amounts
 *   - CUSTOMER and CORPORATE on the same journal
 *   - unlabelled plug / unnamed contra
 */
export interface PostJournalRequest {
  readonly idempotencyKey: string;
  readonly executionAuthority: ExecutionAuthorityView;
  readonly actionType: string;
  readonly postings: readonly ProposedPosting[];
  readonly classBridge?: ClassBridge;
  readonly memo?: string;
}

export interface ExecutionAuthorityView {
  readonly authorityId: string;
  readonly actionType: string;
  readonly accountId: string;
  readonly amount: Money;
  readonly idempotencyKey: string;
  readonly issuedAt: string;
  readonly expiresAt: string;
  readonly signature: string;
}

export const SIMULATION_FUNDING_SOURCE_ID = "SIMULATION.FUNDING_SOURCE";

export const SIMULATED_CUSTOMER_FUNDING_BRIDGE: ClassBridge = Object.freeze({
  name: "SIMULATED_CUSTOMER_FUNDING",
  fromClass: "SIMULATION",
  toClass: "CUSTOMER",
  disclosed: true,
  purpose:
    "Simulation-only inbound funding of customer deposit accounts. The contra is SIMULATION.FUNDING_SOURCE — never a corporate account and never an unlabelled plug.",
});

export type LedgerInvariantName =
  | "BALANCE"
  | "IMMUTABILITY"
  | "AUTHORITY"
  | "CLASS_BRIDGE"
  | "NO_COMMINGLING"
  | "IDEMPOTENCY";

export class LedgerInvariantError extends Error {
  readonly invariant: LedgerInvariantName;

  constructor(invariant: LedgerInvariantName, message: string) {
    super(`[${invariant}] ${message}`);
    this.name = "LedgerInvariantError";
    this.invariant = invariant;
  }
}
