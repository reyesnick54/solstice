import { asUtcInstant } from '../../../domain/src/time.ts';
import { AssetQuantity } from '../../../money/src/asset-quantity.ts';
import { SUNREY_COIN_ASSET_ID } from '../../../sunrey-coin/src/ids.ts';
import { asExchangeAccountId, SUNREY_COIN_USD_MARKET_ID } from '../ids.ts';
import { matchIncoming, sortBook } from '../matching.ts';
import { exchangePrice } from '../price.ts';
import type { DigitalOrder } from '../types.ts';
import { canTransitionOrder } from './order-lifecycle.ts';
import { feeFromNotional, productizeFeeSchedule } from './fees.ts';
import { priceWithinBand } from './controls.ts';
import { replayAcceptedOrders } from './replay.ts';
import { resolveCancelFillRace } from './sequencer.ts';

export type ExchangeCorePerfCase = {
  readonly name: string;
  readonly suite: 'exchange-core';
  readonly productionSlaClaim: false;
  readonly extras: Readonly<Record<string, string | number | boolean>>;
  readonly latency: {
    readonly count: number;
    readonly minNs: number;
    readonly maxNs: number;
    readonly meanNs: number;
    readonly medianNs: number;
    readonly p95Ns: number;
  };
};

function summarize(samples: readonly number[]) {
  const sorted = [...samples].sort((left, right) => left - right);
  const count = sorted.length;
  const sum = sorted.reduce((acc, value) => acc + value, 0);
  const pick = (p: number) => (count === 0 ? 0 : sorted[Math.max(0, Math.ceil((p / 100) * count) - 1)] ?? 0);
  return {
    count,
    minNs: sorted[0] ?? 0,
    maxNs: sorted[count - 1] ?? 0,
    meanNs: count === 0 ? 0 : sum / count,
    medianNs: pick(50),
    p95Ns: pick(95),
  };
}

function order(input: { readonly id: string; readonly side: 'BUY' | 'SELL'; readonly qty: bigint; readonly price: bigint; readonly sequence: number }): DigitalOrder {
  const quantity = AssetQuantity.fromScaledUnits(input.qty * 1_000_000n, SUNREY_COIN_ASSET_ID);
  return Object.freeze({
    orderId: input.id as DigitalOrder['orderId'],
    version: 1 as DigitalOrder['version'],
    exchangeAccountId: asExchangeAccountId(`xacct_${input.id}`),
    beneficialParticipantId: `cust_${input.id}`,
    marketId: SUNREY_COIN_USD_MARKET_ID,
    family: 'DIGITAL_ASSET',
    side: input.side,
    orderType: 'LIMIT',
    quantity,
    remaining: quantity,
    limitPrice: exchangePrice({
      baseAssetId: SUNREY_COIN_ASSET_ID,
      quoteAssetId: 'USD',
      quoteKind: 'FIAT_MONEY',
      priceUnits: input.price,
      basePrecision: 6,
    }),
    createdAt: asUtcInstant('2026-08-23T00:00:00.000Z'),
    timeInForce: 'GTC',
    status: 'OPEN',
    clientIdempotencyKey: input.id,
    authorizationRef: 'bench',
    holdId: null,
    coinHoldId: null,
    sourceAccountId: `src_${input.id}`,
    sequence: input.sequence,
  });
}

/**
 * In-process observational timings. Not a production SLA.
 */
export function measureExchangeCore(input: { readonly orders: number }): readonly ExchangeCorePerfCase[] {
  const validation: number[] = [];
  const submission: number[] = [];
  const matching: number[] = [];
  const book: number[] = [];
  const cancel: number[] = [];
  const recovery: number[] = [];
  const accepted: DigitalOrder[] = [];
  for (let i = 0; i < input.orders; i += 1) {
    const started = process.hrtime.bigint();
    const ok = canTransitionOrder('CREATED', 'VALIDATING') && priceWithinBand(200n + BigInt(i % 3), {
      marketId: SUNREY_COIN_USD_MARKET_ID,
      referenceUnits: 200n,
      bandBps: 5_000n,
    });
    validation.push(Number(process.hrtime.bigint() - started));
    void ok;
    const submitStarted = process.hrtime.bigint();
    const row = order({
      id: `bench_${i}`,
      side: i % 2 === 0 ? 'SELL' : 'BUY',
      qty: 1n,
      price: 200n + BigInt(i % 5),
      sequence: i + 1,
    });
    accepted.push(row);
    submission.push(Number(process.hrtime.bigint() - submitStarted));
    const matchStarted = process.hrtime.bigint();
    matchIncoming(row, accepted.slice(0, -1), { selfTrade: 'CANCEL_INCOMING' });
    matching.push(Number(process.hrtime.bigint() - matchStarted));
    const bookStarted = process.hrtime.bigint();
    sortBook(accepted);
    book.push(Number(process.hrtime.bigint() - bookStarted));
    const cancelStarted = process.hrtime.bigint();
    resolveCancelFillRace({
      state: 'OPEN',
      remainingUnits: 1n,
      originalUnits: 1n,
      events: [{ kind: 'CANCEL', orderId: row.orderId, sequence: i + 1 }],
    });
    cancel.push(Number(process.hrtime.bigint() - cancelStarted));
  }
  const recoverStarted = process.hrtime.bigint();
  replayAcceptedOrders({
    accepted,
    feeSchedule: productizeFeeSchedule({
      scheduleId: 'fees:simulation-v1' as never,
      version: 1,
      makerFeeMinor: 0n,
      takerFeeMinor: 0n,
      listingFeeMinor: 0n,
      computeFeeMinor: 0n,
      commercialPermanence: 'SIMULATION_CONFIGURATION',
    }),
    quoteCurrency: 'USD',
  });
  recovery.push(Number(process.hrtime.bigint() - recoverStarted));
  void feeFromNotional(1_200n, 10n, 0n);
  const extras = { batchSize: input.orders, productionSlaClaim: false as const, environment: 'simulation' };
  return [
    { suite: 'exchange-core', name: 'order_validation', productionSlaClaim: false, latency: summarize(validation), extras },
    { suite: 'exchange-core', name: 'order_submission', productionSlaClaim: false, latency: summarize(submission), extras },
    { suite: 'exchange-core', name: 'matching_latency', productionSlaClaim: false, latency: summarize(matching), extras },
    { suite: 'exchange-core', name: 'book_update', productionSlaClaim: false, latency: summarize(book), extras },
    { suite: 'exchange-core', name: 'cancellation', productionSlaClaim: false, latency: summarize(cancel), extras },
    { suite: 'exchange-core', name: 'recovery', productionSlaClaim: false, latency: summarize(recovery), extras },
  ];
}
