/**
 * MD04 simulation fixtures — no hidden liquidity.
 */

import type { BookMutation, OrderBookSnapshotSeed } from './types.ts';

export const MD04_FIXTURE_INSTRUMENT_ID = 'md04.fixture.BTC-USD' as const;

export const MD04_L3_SNAPSHOT_SEED: OrderBookSnapshotSeed = Object.freeze({
  instrumentId: MD04_FIXTURE_INSTRUMENT_ID,
  depthMode: 'L3',
  marketState: 'OPEN',
  sequence: 100n,
  orders: Object.freeze([
    Object.freeze({
      orderId: 'bid-1',
      side: 'bid' as const,
      priceMinorUnits: 99_500_00n,
      quantityMinorUnits: 2_000_000n,
    }),
    Object.freeze({
      orderId: 'bid-2',
      side: 'bid' as const,
      priceMinorUnits: 99_500_00n,
      quantityMinorUnits: 1_000_000n,
    }),
    Object.freeze({
      orderId: 'ask-1',
      side: 'ask' as const,
      priceMinorUnits: 99_600_00n,
      quantityMinorUnits: 1_500_000n,
    }),
  ]),
});

export const MD04_L3_UPDATE_SEQUENCE: readonly BookMutation[] = Object.freeze([
  Object.freeze({
    kind: 'PARTIAL_EXECUTE',
    sequence: 101n,
    orderId: 'ask-1',
    executedQuantityMinorUnits: 500_000n,
  }),
  Object.freeze({
    kind: 'ADD',
    sequence: 102n,
    side: 'ask',
    orderId: 'ask-2',
    priceMinorUnits: 99_650_00n,
    quantityMinorUnits: 750_000n,
  }),
]);

export const MD04_L2_SNAPSHOT_SEED: OrderBookSnapshotSeed = Object.freeze({
  instrumentId: MD04_FIXTURE_INSTRUMENT_ID,
  depthMode: 'L2',
  marketState: 'OPEN',
  sequence: 1n,
  bidLevels: Object.freeze([
    Object.freeze({ priceMinorUnits: 100_00n, quantityMinorUnits: 50n }),
    Object.freeze({ priceMinorUnits: 99_50n, quantityMinorUnits: 30n }),
  ]),
  askLevels: Object.freeze([
    Object.freeze({ priceMinorUnits: 100_50n, quantityMinorUnits: 40n }),
    Object.freeze({ priceMinorUnits: 101_00n, quantityMinorUnits: 20n }),
  ]),
});
