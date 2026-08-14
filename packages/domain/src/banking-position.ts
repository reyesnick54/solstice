/**
 * Banking position states. These are derived views, not stored Account fields.
 *
 * LEDGER_BALANCE  — credits − debits on the account from posted journals.
 * SETTLED         — ledger balance of realized customer classes
 *                   (not PENDING_SETTLEMENT).
 * PENDING         — ledger balance of PENDING_SETTLEMENT class accounts.
 * HELD            — sum of ACTIVE funds reservations against the account.
 * AVAILABLE       — SETTLED − HELD − other explicit reservations.
 *
 * A hold reduces AVAILABLE. It does not change LEDGER_BALANCE and does not
 * pretend settlement occurred. No overdraft: AVAILABLE must cover the next
 * reservation or outgoing movement.
 */
export const BANKING_POSITION_STATES = [
  'LEDGER_BALANCE',
  'AVAILABLE',
  'PENDING',
  'HELD',
  'SETTLED',
] as const;

export type BankingPositionState = (typeof BANKING_POSITION_STATES)[number];

export const BANKING_POSITION_SEMANTICS: {
  readonly [S in BankingPositionState]: string;
} = Object.freeze({
  LEDGER_BALANCE:
    'Authoritative posted position: customer-funded credits minus debits on this account.',
  SETTLED:
    'Ledger balance of realized classes. PENDING_SETTLEMENT is excluded.',
  PENDING:
    'Funds sitting in PENDING_SETTLEMENT. Not mixed into settled deposit balance.',
  HELD: 'Sum of ACTIVE holds and explicit reservations. Not settled.',
  AVAILABLE:
    'Settled ledger position minus ACTIVE holds and other explicit reservations. No overdraft.',
});
