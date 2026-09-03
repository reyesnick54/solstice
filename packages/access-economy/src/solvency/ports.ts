/**
 * ACCESS-16 — Reference/aggregation ports toward canonical financial owners.
 *
 * These ports read and reference canonical owners. They do not create a second
 * Ledger, Treasury, Custody system, or Exchange.
 */

import type { SettlementReservePosition } from './types.ts';

export const CANONICAL_RESERVE_OWNERS = [
  'packages/ledger',
  'packages/treasury',
  'packages/custody',
  'packages/payments',
  'packages/sunrey-exchange',
] as const;
export type CanonicalReserveOwner = (typeof CANONICAL_RESERVE_OWNERS)[number];

/** Read-only port to aggregate settlement reserve references from canonical owners. */
export type SettlementReserveReadPort = {
  listPositions(filter?: {
    readonly currency?: string;
    readonly jurisdiction?: string;
    readonly providerRef?: string;
    readonly epoch?: string;
  }): readonly SettlementReservePosition[];
};

/** Read-only port to reference canonical Ledger positions. */
export type LedgerReservePort = SettlementReserveReadPort & {
  readonly owner: 'packages/ledger';
};

/** Read-only port to reference Protocol Treasury positions. */
export type TreasuryReservePort = SettlementReserveReadPort & {
  readonly owner: 'packages/treasury';
};

/** Read-only port to reference Custody settlement positions. */
export type CustodyReservePort = SettlementReserveReadPort & {
  readonly owner: 'packages/custody';
};

/** Read-only port to reference Payments rail settlement positions. */
export type PaymentsReservePort = SettlementReserveReadPort & {
  readonly owner: 'packages/payments';
};

/** Read-only port to reference Exchange settlement positions. */
export type ExchangeReservePort = SettlementReserveReadPort & {
  readonly owner: 'packages/sunrey-exchange';
};

export type SolvencyPorts = {
  readonly ledger: LedgerReservePort;
  readonly treasury: TreasuryReservePort;
  readonly custody: CustodyReservePort;
  readonly payments: PaymentsReservePort;
  readonly exchange: ExchangeReservePort;
};

export function aggregateReservePositions(ports: SolvencyPorts): readonly SettlementReservePosition[] {
  return Object.freeze([
    ...ports.ledger.listPositions(),
    ...ports.treasury.listPositions(),
    ...ports.custody.listPositions(),
    ...ports.payments.listPositions(),
    ...ports.exchange.listPositions(),
  ]);
}

/** In-memory simulation port for tests and sandbox. */
export class InMemorySettlementReservePort implements SettlementReserveReadPort {
  private readonly positions: SettlementReservePosition[] = [];
  readonly owner: CanonicalReserveOwner;

  constructor(owner: CanonicalReserveOwner) {
    this.owner = owner;
  }

  seed(position: SettlementReservePosition): void {
    this.positions.push(Object.freeze({ ...position }));
  }

  listPositions(filter?: {
    readonly currency?: string;
    readonly jurisdiction?: string;
    readonly providerRef?: string;
    readonly epoch?: string;
  }): readonly SettlementReservePosition[] {
    return Object.freeze(
      this.positions.filter((row) => {
        if (filter?.currency && row.currency !== filter.currency) {
          return false;
        }
        if (filter?.jurisdiction && row.jurisdiction !== filter.jurisdiction) {
          return false;
        }
        if (filter?.providerRef && row.providerRef !== filter.providerRef) {
          return false;
        }
        if (filter?.epoch && row.epoch !== filter.epoch) {
          return false;
        }
        return true;
      }),
    );
  }
}

export function createSimulationSolvencyPorts(): SolvencyPorts {
  return Object.freeze({
    ledger: new InMemorySettlementReservePort('packages/ledger') as LedgerReservePort,
    treasury: new InMemorySettlementReservePort('packages/treasury') as TreasuryReservePort,
    custody: new InMemorySettlementReservePort('packages/custody') as CustodyReservePort,
    payments: new InMemorySettlementReservePort('packages/payments') as PaymentsReservePort &
      Pick<InMemorySettlementReservePort, 'seed'>,
    exchange: new InMemorySettlementReservePort('packages/sunrey-exchange') as ExchangeReservePort,
  });
}
