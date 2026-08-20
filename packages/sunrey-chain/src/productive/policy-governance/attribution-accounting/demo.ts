#!/usr/bin/env node
/**
 * Chunk 122 demo — MoonRey attribution reconciliation.
 *
 * Simulated manufacturing supply chain. Attempts 100% manufacturing,
 * 100% machine output, and 100% goods against one production hour.
 * Independently evidenced logistics and storage receive their own share.
 *
 * Does not calculate Productive Value and does not change MoonRey supply.
 */

import { PRODUCTION_ACTIVE } from '../../../units/constitution.ts';
import { ProductiveAttributionBook, simulationAttributionDecision } from './book.ts';
import {
  ATTRIBUTION_BOOK_IS_MONETARY_LEDGER,
  ATTRIBUTION_SHARE_SCALE,
} from './types.ts';
import {
  goodsObservation,
  logisticsObservation,
  machineObservation,
  manufacturingObservation,
  storageObservation,
} from './fixtures.ts';

function reserve(
  book: ProductiveAttributionBook,
  observation: ReturnType<typeof manufacturingObservation>,
  decisionId: string,
  allocatedShare = ATTRIBUTION_SHARE_SCALE,
) {
  const decision = simulationAttributionDecision(observation, {
    attributionDecisionId: decisionId,
    allocatedShare,
  });
  return book.reserve({
    observation,
    decision,
    expectedPolicyVersion: 1,
  });
}

export function runMoonReyAttributionReconciliationDemo(): {
  readonly overAllocatedEvents: number;
  readonly replayIncreasedAttribution: boolean;
  readonly categoryRelabelIncreasedAttribution: boolean;
  readonly attributionBookIsMonetaryLedger: false;
  readonly productionActive: false;
} {
  const book = new ProductiveAttributionBook();
  const manufacturing = manufacturingObservation();
  const first = reserve(book, manufacturing, 'decision.mfg.full');
  if (!first.ok) {
    throw new Error(`manufacturing reservation failed: ${first.code}`);
  }
  book.finalize(first.value.entryId);

  const machine = reserve(book, machineObservation(), 'decision.machine.full');
  const goods = reserve(book, goodsObservation(), 'decision.goods.full');
  console.log('MANUFACTURING_100=RESERVED');
  console.log(`MACHINE_100=${machine.ok ? 'UNEXPECTED_ALLOW' : machine.code}`);
  console.log(`GOODS_100=${goods.ok ? 'UNEXPECTED_ALLOW' : goods.code}`);

  const logistics = reserve(book, logisticsObservation(), 'decision.logistics.full');
  const storage = reserve(book, storageObservation(), 'decision.storage.full');
  if (logistics.ok) {
    book.finalize(logistics.value.entryId);
  }
  if (storage.ok) {
    book.finalize(storage.value.entryId);
  }
  console.log(`LOGISTICS_INDEPENDENT=${logistics.ok ? 'RESERVED' : logistics.code}`);
  console.log(`STORAGE_INDEPENDENT=${storage.ok ? 'RESERVED' : storage.code}`);

  const replay = reserve(
    book,
    manufacturingObservation({
      claimId: 'claim.mfg.retry',
      contributionId: 'contrib.mfg.retry',
      economicEventId: 'event.factory.hour-1-replay',
    }),
    'decision.mfg.replay',
  );
  const beforeReplay = book.allocatedShareForEvent(manufacturing.economicEventId);
  const relabel = reserve(
    book,
    manufacturingObservation({
      category: 'GOODS',
      claimId: 'claim.relabel.goods',
      contributionId: 'contrib.relabel.goods',
      economicEventId: 'event.relabel.goods',
    }),
    'decision.relabel',
  );
  const afterRelabel = book.allocatedShareForEvent(manufacturing.economicEventId);
  const report = book.reconcile();

  console.log(`EVENT_OVERALLOCATIONS=${report.overAllocatedEvents}`);
  console.log(`REPLAY_INCREASED_ATTRIBUTION=${replay.ok || beforeReplay !== book.allocatedShareForEvent(manufacturing.economicEventId)}`);
  console.log(`CATEGORY_RELABEL_INCREASED_ATTRIBUTION=${relabel.ok && afterRelabel > beforeReplay}`);
  console.log(`ATTRIBUTION_BOOK_IS_MONETARY_LEDGER=${book.isMonetaryLedger || ATTRIBUTION_BOOK_IS_MONETARY_LEDGER}`);
  console.log(`PRODUCTION_ACTIVE=${PRODUCTION_ACTIVE}`);

  return {
    overAllocatedEvents: report.overAllocatedEvents,
    replayIncreasedAttribution: replay.ok,
    categoryRelabelIncreasedAttribution: relabel.ok,
    attributionBookIsMonetaryLedger: false,
    productionActive: false,
  };
}

const invoked = process.argv[1]?.includes('attribution-accounting/demo');
if (invoked) {
  runMoonReyAttributionReconciliationDemo();
}
