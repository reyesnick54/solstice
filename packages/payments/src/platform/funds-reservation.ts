/**
 * Funds reservation for external outbound payments.
 * Uses canonical ledger hold/pending mechanics. Duplicate capture is refused.
 */

import { LIVE_PAYMENTS_ENABLED } from '../../../config/src/flags.ts';
import type { UtcInstant } from '../../../domain/src/time.ts';
import type { Ledger } from '../../../ledger/src/journal.ts';
import type { Journal } from '../../../ledger/src/types.ts';
import type { Money } from '../../../money/src/money.ts';
import type { ExecutionAuthority } from '../../../permissions/src/execution-authority.ts';
import {
  captureFeePlan,
  capturePrincipalPlan,
  releasePlan,
  reservePlan,
  type PaymentJournalPlan,
} from '../accounting.ts';
import { postPaymentJournal } from '../journals.ts';

export const FUNDS_RESERVATION_STATES = ['RESERVED', 'CAPTURED', 'RELEASED'] as const;
export type FundsReservationState = (typeof FUNDS_RESERVATION_STATES)[number];

export type FundsReservation = {
  readonly reservationId: string;
  readonly paymentId: string;
  readonly accountId: string;
  readonly amount: Money;
  readonly state: FundsReservationState;
  readonly reserveJournalId: string;
  readonly captureJournalId: string | null;
  readonly releaseJournalId: string | null;
  readonly createdAt: UtcInstant;
  readonly updatedAt: UtcInstant;
};

export type FundsReservationPort = {
  reserve(input: {
    readonly reservationId: string;
    readonly paymentId: string;
    readonly accountId: string;
    readonly amount: Money;
    readonly authority: ExecutionAuthority;
    readonly actionType: string;
    readonly now: UtcInstant;
  }): FundsReservation;
  capture(input: {
    readonly reservationId: string;
    readonly principal: Money;
    readonly fee: Money;
    readonly authority: ExecutionAuthority;
    readonly actionType: string;
    readonly now: UtcInstant;
  }): FundsReservation;
  release(input: {
    readonly reservationId: string;
    readonly authority: ExecutionAuthority;
    readonly actionType: string;
    readonly now: UtcInstant;
  }): FundsReservation;
  get(reservationId: string): FundsReservation | undefined;
};

/**
 * Ledger pending-settlement reservation. Not a second hold engine —
 * posts through Ledger.postJournal only.
 */
export class LedgerFundsReservation implements FundsReservationPort {
  private readonly ledger: Ledger;
  private readonly rows = new Map<string, FundsReservation>();

  constructor(ledger: Ledger) {
    this.ledger = ledger;
    if (LIVE_PAYMENTS_ENABLED) {
      throw new Error('LedgerFundsReservation cannot run when LIVE_PAYMENTS_ENABLED is true');
    }
  }

  get(reservationId: string): FundsReservation | undefined {
    return this.rows.get(reservationId);
  }

  reserve(input: {
    readonly reservationId: string;
    readonly paymentId: string;
    readonly accountId: string;
    readonly amount: Money;
    readonly authority: ExecutionAuthority;
    readonly actionType: string;
    readonly now: UtcInstant;
  }): FundsReservation {
    const existing = this.rows.get(input.reservationId);
    if (existing) {
      return existing;
    }
    const journal = this.post(input.authority, input.actionType, reservePlan(input.accountId, input.amount));
    const reserved: FundsReservation = Object.freeze({
      reservationId: input.reservationId,
      paymentId: input.paymentId,
      accountId: input.accountId,
      amount: input.amount,
      state: 'RESERVED',
      reserveJournalId: journal.id,
      captureJournalId: null,
      releaseJournalId: null,
      createdAt: input.now,
      updatedAt: input.now,
    });
    this.rows.set(input.reservationId, reserved);
    return reserved;
  }

  capture(input: {
    readonly reservationId: string;
    readonly principal: Money;
    readonly fee: Money;
    readonly authority: ExecutionAuthority;
    readonly actionType: string;
    readonly now: UtcInstant;
  }): FundsReservation {
    const current = this.require(input.reservationId);
    if (current.state === 'CAPTURED') {
      return current;
    }
    if (current.state !== 'RESERVED') {
      throw new Error(`cannot capture reservation in state ${current.state}`);
    }
    const principal = this.post(input.authority, input.actionType, capturePrincipalPlan(input.principal));
    if (input.fee.minorUnits > 0n) {
      this.post(input.authority, input.actionType, captureFeePlan(input.fee));
    }
    const captured: FundsReservation = Object.freeze({
      ...current,
      state: 'CAPTURED',
      captureJournalId: principal.id,
      updatedAt: input.now,
    });
    this.rows.set(input.reservationId, captured);
    return captured;
  }

  release(input: {
    readonly reservationId: string;
    readonly authority: ExecutionAuthority;
    readonly actionType: string;
    readonly now: UtcInstant;
  }): FundsReservation {
    const current = this.require(input.reservationId);
    if (current.state === 'RELEASED') {
      return current;
    }
    if (current.state === 'CAPTURED') {
      throw new Error('cannot release a captured reservation');
    }
    const journal = this.post(
      input.authority,
      input.actionType,
      releasePlan(current.accountId, current.amount),
    );
    const released: FundsReservation = Object.freeze({
      ...current,
      state: 'RELEASED',
      releaseJournalId: journal.id,
      updatedAt: input.now,
    });
    this.rows.set(input.reservationId, released);
    return released;
  }

  private require(id: string): FundsReservation {
    const row = this.rows.get(id);
    if (!row) {
      throw new Error(`reservation ${id} not found`);
    }
    return row;
  }

  private post(authority: ExecutionAuthority, actionType: string, plan: PaymentJournalPlan): Journal {
    return postPaymentJournal(this.ledger, authority, actionType, plan);
  }
}
