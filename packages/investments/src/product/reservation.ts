import { Money } from '../../../money/src/money.ts';
import type { UtcInstant } from '../../../domain/src/time.ts';
import type { ExecutionAuthority } from '../../../permissions/src/execution-authority.ts';
import type { Ledger } from '../../../ledger/src/journal.ts';
import { brokerageToPendingBridge, postInvestmentJournal } from '../journals.ts';
import type { InvestmentAccountProfile } from '../profile.ts';
import { asCashReservationId, type CashReservationId, type PortfolioId } from './ids.ts';
import type { ReservationState } from './types.ts';

/**
 * Cash reserved for a pending buy. Overlay reservations reduce available
 * cash. Ledger-posted reservations use BROKERAGE_CASH → PENDING_SETTLEMENT.
 * Portfolio tables are not the financial authority.
 */
export type CashReservation = {
  readonly reservationId: CashReservationId;
  readonly portfolioId: PortfolioId;
  readonly proposalId: string;
  readonly brokerageCashAccountId: string;
  readonly pendingSettlementAccountId: string;
  readonly amount: Money;
  readonly state: ReservationState;
  readonly journalId: string | null;
  readonly createdAt: UtcInstant;
};

export function freezeReservation(row: CashReservation): CashReservation {
  if ('balance' in row) {
    throw new Error('reservation must not store an account balance');
  }
  return Object.freeze({ ...row });
}

export function overlayReservation(input: {
  readonly reservationId: string;
  readonly portfolioId: PortfolioId;
  readonly proposalId: string;
  readonly brokerageCashAccountId: string;
  readonly pendingSettlementAccountId: string;
  readonly amount: Money;
  readonly createdAt: UtcInstant;
}): CashReservation {
  return freezeReservation({
    reservationId: asCashReservationId(input.reservationId),
    portfolioId: input.portfolioId,
    proposalId: input.proposalId,
    brokerageCashAccountId: input.brokerageCashAccountId,
    pendingSettlementAccountId: input.pendingSettlementAccountId,
    amount: input.amount,
    state: 'OVERLAY',
    journalId: null,
    createdAt: input.createdAt,
  });
}

export function postReservationJournal(
  ledger: Ledger,
  profile: InvestmentAccountProfile,
  reservation: CashReservation,
  authority: ExecutionAuthority,
  actionType: string,
): CashReservation {
  const journal = postInvestmentJournal(ledger, {
    idempotencyKey: `${authority.idempotencyKey}:reserve`,
    executionAuthority: authority,
    actionType,
    memo: 'INVESTMENT_CASH_RESERVE',
    debitAccountId: profile.brokerageCashAccountId,
    creditAccountId: profile.pendingSettlementAccountId,
    amount: reservation.amount,
    classBridge: brokerageToPendingBridge(),
  });
  return freezeReservation({
    ...reservation,
    state: 'LEDGER_POSTED',
    journalId: journal.id,
  });
}

export function releaseReservationJournal(
  ledger: Ledger,
  profile: InvestmentAccountProfile,
  reservation: CashReservation,
  authority: ExecutionAuthority,
  actionType: string,
): CashReservation {
  if (reservation.state !== 'LEDGER_POSTED' || !reservation.journalId) {
    return freezeReservation({ ...reservation, state: 'RELEASED' });
  }
  const journal = postInvestmentJournal(ledger, {
    idempotencyKey: `${authority.idempotencyKey}:release`,
    executionAuthority: authority,
    actionType,
    memo: 'INVESTMENT_CASH_RELEASE',
    debitAccountId: profile.pendingSettlementAccountId,
    creditAccountId: profile.brokerageCashAccountId,
    amount: reservation.amount,
    classBridge: brokerageToPendingBridge(),
  });
  return freezeReservation({
    ...reservation,
    state: 'RELEASED',
    journalId: journal.id,
  });
}

export function reservedTotal(rows: readonly CashReservation[], currency: string): Money {
  return rows
    .filter((row) => row.state === 'OVERLAY' || row.state === 'LEDGER_POSTED')
    .reduce((sum, row) => sum.plus(row.amount), Money.zero(currency));
}
