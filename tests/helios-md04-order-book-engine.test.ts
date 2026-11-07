/**
 * HELIOS MARKET DATA MD04 — deterministic order-book reconstruction.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  applyBookMutation,
  applyBookMutations,
  createCanonicalOrderBookFromSnapshot,
  evaluateMd04OrderBookQualification,
  executableTopOfBook,
  HELIOS_MD04_ORDER_BOOK_RECONSTRUCTION_QUALIFIED,
  MD04_L2_SNAPSHOT_SEED,
  MD04_L3_SNAPSHOT_SEED,
  MD04_L3_UPDATE_SEQUENCE,
  projectL1,
  projectL2,
} from '../packages/platform/src/helios/market-data/md04-order-book/index.ts';
import { lintHeliosBoundary } from '../tools/architectural-linter/src/helios-guards.ts';

describe('HELIOS MD04 order-book engine', () => {
  it('respects helios package boundary imports', () => {
    const findings = lintHeliosBoundary(process.cwd()).filter((row) =>
      row.file.includes('market-data/md04-order-book'),
    );
    assert.deepEqual(findings, []);
  });

  it('produces identical state hash for same snapshot and update sequence', () => {
    const a = applyBookMutations(createCanonicalOrderBookFromSnapshot(MD04_L3_SNAPSHOT_SEED), MD04_L3_UPDATE_SEQUENCE);
    const b = applyBookMutations(createCanonicalOrderBookFromSnapshot(MD04_L3_SNAPSHOT_SEED), MD04_L3_UPDATE_SEQUENCE);
    assert.equal(a.stateHash.digest, b.stateHash.digest);
  });

  it('aggregates L3 orders into L2 levels with correct sort', () => {
    const book = createCanonicalOrderBookFromSnapshot(MD04_L3_SNAPSHOT_SEED);
    assert.equal(book.bids.length, 1);
    assert.equal(book.bids[0]!.quantityMinorUnits, 3_000_000n);
    assert.equal(book.bids[0]!.orderCount, 2);
    assert.ok(book.bids[0]!.priceMinorUnits < book.asks[0]!.priceMinorUnits);
  });

  it('supports L1 top-of-book projection', () => {
    const book = createCanonicalOrderBookFromSnapshot(MD04_L2_SNAPSHOT_SEED);
    const l1 = projectL1(book);
    assert.equal(l1.bestBid?.priceMinorUnits, 100_00n);
    assert.equal(l1.bestAsk?.priceMinorUnits, 100_50n);
  });

  it('projects full L2 depth', () => {
    const book = createCanonicalOrderBookFromSnapshot(MD04_L2_SNAPSHOT_SEED);
    const l2 = projectL2(book);
    assert.equal(l2.bids.length, 2);
    assert.equal(l2.asks.length, 2);
  });

  it('applies partial execute without phantom remainder', () => {
    let book = createCanonicalOrderBookFromSnapshot(MD04_L3_SNAPSHOT_SEED);
    const outcome = applyBookMutation(book, {
      kind: 'PARTIAL_EXECUTE',
      sequence: 101n,
      orderId: 'ask-1',
      executedQuantityMinorUnits: 500_000n,
    });
    assert.equal(outcome.ok, true);
    book = outcome.book;
    const ask = book.orders.find((row) => row.orderId === 'ask-1');
    assert.ok(ask);
    assert.equal(ask!.quantityMinorUnits, 1_000_000n);
  });

  it('detects phantom delete and duplicate add', () => {
    const book = createCanonicalOrderBookFromSnapshot(MD04_L3_SNAPSHOT_SEED);
    const phantom = applyBookMutation(book, { kind: 'DELETE', sequence: 200n, orderId: 'missing' });
    assert.equal(phantom.ok, false);
    assert.equal(phantom.code, 'PHANTOM_DELETE');

    const dup = applyBookMutation(book, {
      kind: 'ADD',
      sequence: 201n,
      side: 'bid',
      orderId: 'bid-1',
      priceMinorUnits: 99_400_00n,
      quantityMinorUnits: 1n,
    });
    assert.equal(dup.ok, false);
    assert.equal(dup.code, 'DUPLICATE_ADD');
  });

  it('blocks halted book from executable top-of-book', () => {
    const book = createCanonicalOrderBookFromSnapshot(MD04_L3_SNAPSHOT_SEED);
    assert.ok(book.integrity.executableBook);
    const halted = applyBookMutation(book, {
      kind: 'PARTIAL_EXECUTE',
      sequence: 300n,
      orderId: 'ask-1',
      executedQuantityMinorUnits: 1n,
      marketState: 'HALTED',
    });
    assert.equal(halted.book.marketState, 'HALTED');
    assert.equal(halted.book.integrity.executableBook, false);
    const exec = executableTopOfBook(halted.book);
    assert.equal(exec.bestBid, null);
    assert.equal(exec.bestAsk, null);
    assert.ok(halted.book.metrics.bestBid != null);
  });

  it('tracks spread, microprice, depth, and imbalance metrics', () => {
    const book = createCanonicalOrderBookFromSnapshot(MD04_L3_SNAPSHOT_SEED);
    assert.ok(book.metrics.spreadMinorUnits != null && book.metrics.spreadMinorUnits > 0n);
    assert.ok(book.metrics.micropriceMinorUnits != null);
    assert.ok(book.metrics.bidDepthMinorUnits > 0n);
    assert.ok(book.metrics.askDepthMinorUnits > 0n);
    assert.ok(book.metrics.imbalancePpm != null);
  });

  it('qualifies MD04 reconstruction harness', () => {
    const book = applyBookMutations(createCanonicalOrderBookFromSnapshot(MD04_L3_SNAPSHOT_SEED), MD04_L3_UPDATE_SEQUENCE);
    const halted = applyBookMutation(book, {
      kind: 'PARTIAL_EXECUTE',
      sequence: 400n,
      orderId: 'ask-1',
      executedQuantityMinorUnits: 1n,
      marketState: 'HALTED',
    });
    const phantom = applyBookMutation(book, { kind: 'DELETE', sequence: 401n, orderId: 'nope' });
    const dup = applyBookMutation(book, {
      kind: 'ADD',
      sequence: 402n,
      side: 'bid',
      orderId: 'bid-1',
      priceMinorUnits: 1n,
      quantityMinorUnits: 1n,
    });
    const result = evaluateMd04OrderBookQualification({
      deterministicHash: true,
      l1Projection: projectL1(createCanonicalOrderBookFromSnapshot(MD04_L2_SNAPSHOT_SEED)).bestBid != null,
      l2Aggregation: book.bids[0]!.orderCount === 2,
      l3OrderTracking: book.orders.some((row) => row.orderId === 'ask-2'),
      partialExecute: book.orders.find((row) => row.orderId === 'ask-1')?.quantityMinorUnits === 1_000_000n,
      phantomDeleteDetected: phantom.ok === false && phantom.code === 'PHANTOM_DELETE',
      duplicateOrderRejected: dup.ok === false && dup.code === 'DUPLICATE_ADD',
      sortInvariants: book.integrity.ok,
      haltBlocksExecutable: halted.book.integrity.executableBook === false,
      metricsTracked: book.metrics.spreadMinorUnits != null,
    });
    assert.equal(result.marker, HELIOS_MD04_ORDER_BOOK_RECONSTRUCTION_QUALIFIED);
    assert.equal(result.qualified, true);
  });
});
