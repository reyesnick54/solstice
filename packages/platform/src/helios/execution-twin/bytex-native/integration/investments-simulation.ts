/**
 * Investments read-model bridge for native BYTEX portfolio simulation events.
 * Does not post ledger journals — simulation-only position tracking.
 */

import type { BytexPortfolioEvent } from '../types.ts';

export type SimulatedHoldingsSnapshot = {
  readonly cashMinor: bigint;
  readonly positions: Readonly<Record<string, bigint>>;
  readonly eventCount: number;
};

export function holdingsSnapshotFromPortfolioEvents(events: readonly BytexPortfolioEvent[]): SimulatedHoldingsSnapshot {
  let cashMinor = 0n;
  const positions: Record<string, bigint> = {};
  for (const event of events) {
    if (event.kind === 'ACCOUNT_BALANCE_CHANGED') {
      cashMinor += event.cashDeltaMinor;
    }
    if (event.kind === 'POSITION_OPENED' || event.kind === 'POSITION_CHANGED' || event.kind === 'POSITION_CLOSED') {
      positions[event.instrumentId] = event.quantityMinor;
    }
  }
  return Object.freeze({
    cashMinor,
    positions: Object.freeze({ ...positions }),
    eventCount: events.length,
  });
}
