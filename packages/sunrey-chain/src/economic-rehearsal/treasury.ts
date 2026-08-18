/**
 * Protocol-treasury rehearsal over the SunRey fee treasury sink.
 *
 * Not packages/treasury (fiat). Cannot reach customer wallets, custody
 * customer accounts, Exchange customer obligations, or the fiat Ledger.
 */

import { rehearseProtocolTreasury as rehearseCanonicalTreasury } from '../economics/treasury/rehearsal.ts';
import { REHEARSAL_ONLY, type TreasuryRehearsalResult } from './types.ts';

const TREASURY_ACCOUNT = 'sunrey.fees.treasury';
const CUSTOMER_WALLET = 'wallet.customer.synthetic';
const CUSTODY_CUSTOMER = 'custody.customer.account';
const EXCHANGE_OBLIGATION = 'exchange.customer.obligation';
const FIAT_LEDGER = 'ledger.fiat.customer';

export type TreasuryReservation = {
  readonly reservationId: string;
  readonly quantity: bigint;
  readonly cancelled: boolean;
  readonly disbursed: boolean;
};

export class ProtocolTreasuryRehearsal {
  private funded = 0n;
  private budget = 0n;
  private reserved = 0n;
  private disbursed = 0n;
  private cancelled = 0n;
  private returned = 0n;
  private readonly reservations = new Map<string, TreasuryReservation>();
  private readonly disbursementIds = new Set<string>();

  fundFromFees(quantity: bigint): void {
    this.funded += quantity;
  }

  setBudget(quantity: bigint): void {
    this.budget = quantity;
  }

  reserve(reservationId: string, quantity: bigint): boolean {
    if (this.available() < quantity) {
      return false;
    }
    if (this.reservations.has(reservationId)) {
      return false;
    }
    this.reserved += quantity;
    this.reservations.set(reservationId, {
      reservationId,
      quantity,
      cancelled: false,
      disbursed: false,
    });
    return true;
  }

  cancel(reservationId: string): boolean {
    const row = this.reservations.get(reservationId);
    if (!row || row.cancelled || row.disbursed) {
      return false;
    }
    this.reservations.set(reservationId, { ...row, cancelled: true });
    this.reserved -= row.quantity;
    this.cancelled += row.quantity;
    this.returned += row.quantity;
    return true;
  }

  disburse(reservationId: string, disbursementId: string, destination: string): boolean {
    if (this.disbursementIds.has(disbursementId)) {
      return false;
    }
    if (!this.destinationPermitted(destination)) {
      return false;
    }
    const row = this.reservations.get(reservationId);
    if (!row || row.cancelled || row.disbursed) {
      return false;
    }
    this.reservations.set(reservationId, { ...row, disbursed: true });
    this.reserved -= row.quantity;
    this.disbursed += row.quantity;
    this.disbursementIds.add(disbursementId);
    return true;
  }

  available(): bigint {
    return this.funded - this.reserved - this.disbursed;
  }

  remaining(): bigint {
    return this.funded - this.disbursed;
  }

  destinationPermitted(destination: string): boolean {
    return destination === TREASURY_ACCOUNT || destination.startsWith('rehearsal.treasury.');
  }

  isolation(): {
    readonly customerWalletIsolated: boolean;
    readonly custodyIsolated: boolean;
    readonly exchangeObligationsIsolated: boolean;
    readonly fiatLedgerIsolated: boolean;
  } {
    return Object.freeze({
      customerWalletIsolated: !this.destinationPermitted(CUSTOMER_WALLET),
      custodyIsolated: !this.destinationPermitted(CUSTODY_CUSTOMER),
      exchangeObligationsIsolated: !this.destinationPermitted(EXCHANGE_OBLIGATION),
      fiatLedgerIsolated: !this.destinationPermitted(FIAT_LEDGER),
    });
  }

  reconcile(): boolean {
    return this.funded === this.available() + this.reserved + this.disbursed && this.cancelled === this.returned;
  }

  snapshot(): {
    readonly funded: bigint;
    readonly budget: bigint;
    readonly reserved: bigint;
    readonly disbursed: bigint;
    readonly cancelled: bigint;
    readonly returned: bigint;
    readonly remaining: bigint;
  } {
    return Object.freeze({
      funded: this.funded,
      budget: this.budget,
      reserved: this.reserved,
      disbursed: this.disbursed,
      cancelled: this.cancelled,
      returned: this.returned,
      remaining: this.remaining(),
    });
  }
}

export function rehearseProtocolTreasury(feeTreasuryAllocation: bigint): TreasuryRehearsalResult {
  const canonical = rehearseCanonicalTreasury();
  const engine = new ProtocolTreasuryRehearsal();
  engine.fundFromFees(feeTreasuryAllocation);
  engine.setBudget(feeTreasuryAllocation);
  const reservedOk = engine.reserve('res.budget.1', feeTreasuryAllocation / 2n);
  const disbursedOk = engine.disburse('res.budget.1', 'disb.1', 'rehearsal.treasury.ops');
  const reserved2 = engine.reserve('res.budget.2', feeTreasuryAllocation / 4n);
  const cancelledOk = engine.cancel('res.budget.2');
  const duplicate = engine.disburse('res.budget.1', 'disb.1', 'rehearsal.treasury.ops');
  const isolation = engine.isolation();
  const customerAttempt = engine.disburse('missing', 'disb.customer', CUSTOMER_WALLET);
  const custodyAttempt = engine.disburse('missing', 'disb.custody', CUSTODY_CUSTOMER);
  const exchangeAttempt = engine.disburse('missing', 'disb.exchange', EXCHANGE_OBLIGATION);
  const fiatAttempt = engine.disburse('missing', 'disb.fiat', FIAT_LEDGER);
  const snap = engine.snapshot();
  void reservedOk;
  void reserved2;
  void REHEARSAL_ONLY;
  return Object.freeze({
    feeFunding: snap.funded,
    budget: snap.budget,
    reserved: snap.reserved,
    disbursed: snap.disbursed,
    cancelled: snap.cancelled,
    returned: snap.returned,
    remaining: snap.remaining,
    duplicateDisbursementRejected: duplicate === false && disbursedOk && cancelledOk,
    customerWalletIsolated: isolation.customerWalletIsolated && customerAttempt === false,
    custodyIsolated: isolation.custodyIsolated && custodyAttempt === false,
    exchangeObligationsIsolated: isolation.exchangeObligationsIsolated && exchangeAttempt === false,
    fiatLedgerIsolated: isolation.fiatLedgerIsolated && fiatAttempt === false,
    reconciled: engine.reconcile() && canonical.reconciliation && canonical.productionTreasuryInactive,
    productionAuthorized: false,
  });
}
