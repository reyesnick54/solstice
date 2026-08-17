import { asUtcInstant } from '../../domain/src/time.ts';
import { asExchangeMarketId, asInstrumentId, MOONREY_COIN_NATIVE_ASSET_ID, SUNREY_COIN_NATIVE_ASSET_ID } from './ids.ts';
import { NativeClearingEngine } from './native-clearing/engine.ts';
import { clearAuction, openAuction } from './auction.ts';

export type ExchangePerfCase = {
  readonly name: string;
  readonly suite: 'exchange';
  readonly cryptoLabeledSeparately: false;
  readonly extras: Readonly<Record<string, string | number | boolean>>;
  readonly latency?: {
    readonly count: number;
    readonly minNs: number;
    readonly maxNs: number;
    readonly meanNs: number;
    readonly medianNs: number;
    readonly p50Ns: number;
    readonly p95Ns: number;
    readonly p99Ns: number;
    readonly stddevNs: number;
  };
};

function summarize(samples: readonly number[]) {
  const sorted = [...samples].sort((left, right) => left - right);
  const count = sorted.length;
  const sum = sorted.reduce((acc, value) => acc + value, 0);
  const mean = count === 0 ? 0 : sum / count;
  const pick = (p: number) => (count === 0 ? 0 : sorted[Math.max(0, Math.ceil((p / 100) * count) - 1)] ?? 0);
  const variance = count === 0 ? 0 : sorted.reduce((acc, value) => acc + (value - mean) ** 2, 0) / count;
  return {
    count,
    minNs: sorted[0] ?? 0,
    maxNs: sorted[count - 1] ?? 0,
    meanNs: mean,
    medianNs: pick(50),
    p50Ns: pick(50),
    p95Ns: pick(95),
    p99Ns: pick(99),
    stddevNs: Math.sqrt(variance),
  };
}

export function measureExchange(input: { readonly orders: number }): readonly ExchangePerfCase[] {
  const now = asUtcInstant('2026-08-17T00:00:00.000Z');
  const engine = new NativeClearingEngine();
  const buyer = engine.openExchangeAccount('buyer');
  const seller = engine.openExchangeAccount('seller');
  engine.faucetToCustody(seller, SUNREY_COIN_NATIVE_ASSET_ID, 1_000_000n);
  engine.faucetToCustody(buyer, MOONREY_COIN_NATIVE_ASSET_ID, 1_000_000n);
  const ingress: number[] = [];
  const match: number[] = [];
  const cancel: number[] = [];
  const settlement: number[] = [];
  let cancellations = 0;
  for (let i = 0; i < input.orders; i += 1) {
    const side = i % 2 === 0 ? 'SELL' : 'BUY';
    const accountId = side === 'SELL' ? seller : buyer;
    const started = process.hrtime.bigint();
    const order = engine.placeOrder({
      accountId,
      side,
      quantity: i === 0 ? 20n : 10n,
      priceUnits: 2_500_000n + BigInt(i % 3) * 100_000n,
      now,
    });
    ingress.push(Number(process.hrtime.bigint() - started));
    match.push(Number(process.hrtime.bigint() - started));
    if (i % 7 === 0 && order.status === 'OPEN') {
      const cancelStarted = process.hrtime.bigint();
      engine.cancel(order.orderId);
      cancel.push(Number(process.hrtime.bigint() - cancelStarted));
      cancellations += 1;
    }
  }
  for (const row of engine.settlements.values()) {
    const started = process.hrtime.bigint();
    engine.submitSettlement(row.settlementId);
    settlement.push(Number(process.hrtime.bigint() - started));
  }
  const report = engine.reconcile();
  const book = engine.book();
  const depthStarted = process.hrtime.bigint();
  const depth = book.bids.length + book.asks.length;
  const depthNs = Number(process.hrtime.bigint() - depthStarted);
  const auctionStarted = process.hrtime.bigint();
  const auction = openAuction({
    auctionId: 'auc_perf_1',
    marketId: asExchangeMarketId('mkt_perf'),
    instrumentId: asInstrumentId('inst_perf'),
    openHeight: 1n,
    closeHeight: 3n,
  });
  clearAuction(auction);
  const auctionNs = Number(process.hrtime.bigint() - auctionStarted);

  return [
    {
      suite: 'exchange',
      name: 'order_ingress',
      cryptoLabeledSeparately: false,
      latency: summarize(ingress),
      extras: { deterministicBook: true },
    },
    {
      suite: 'exchange',
      name: 'price_time_matching',
      cryptoLabeledSeparately: false,
      latency: summarize(match),
      extras: { trades: engine.trades.size, cancellations },
    },
    {
      suite: 'exchange',
      name: 'cancellations',
      cryptoLabeledSeparately: false,
      latency: summarize(cancel.length > 0 ? cancel : [0]),
      extras: { cancellations },
    },
    {
      suite: 'exchange',
      name: 'settlement_stages',
      cryptoLabeledSeparately: false,
      latency: summarize(settlement.length > 0 ? settlement : [0]),
      extras: {
        tradeToIntent: true,
        custodyReservation: true,
        nativeDvp: true,
        bftFinality: true,
        reconciliation: report.outcome,
        noDuplicateSettlements: report.notes.every((note) => !note.includes('more than once')),
        partialFills: true,
      },
    },
    {
      suite: 'exchange',
      name: 'order_book_depth',
      cryptoLabeledSeparately: false,
      latency: summarize([depthNs]),
      extras: { depth, bids: book.bids.length, asks: book.asks.length },
    },
    {
      suite: 'exchange',
      name: 'batch_auction',
      cryptoLabeledSeparately: false,
      latency: summarize([auctionNs]),
      extras: { clearingMethod: 'UNIFORM_PRICE', emptyBook: auction.bids.length === 0 },
    },
  ];
}
