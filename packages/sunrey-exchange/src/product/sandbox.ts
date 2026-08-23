import { FrozenClock } from '../../../config/src/clock.ts';
import { asUtcInstant, type UtcInstant } from '../../../domain/src/time.ts';
import { Ledger } from '../../../ledger/src/journal.ts';
import { addMs } from '../../../config/src/clock.ts';
import { AUTHORITY_TTL_MS, AuthorityIssuer } from '../../../permissions/src/execution-authority.ts';
import { ACTION_TYPES } from '../../../permissions/src/action-types.ts';
import { AssetQuantity } from '../../../money/src/asset-quantity.ts';
import { Money } from '../../../money/src/money.ts';
import { InMemoryCoinPort, InMemoryFiatPort } from '../adapters.ts';
import { SimulationNativeDvpAdapter } from '../native-settlement.ts';
import { SUNREY_COIN_USD_MARKET_ID } from '../ids.ts';
import { exchangePrice } from '../price.ts';
import { toTrade, type Match } from '../matching.ts';
import type { DigitalOrder, ImmutableTrade, MarketDataSnapshot } from '../types.ts';
import { ExchangeApplicationApi } from './api.ts';
import { ExchangeProductPlatform } from './platform.ts';
import type { CustodyRail } from './settlement.ts';
import type { SettlementFailureCode } from './types.ts';

const NOW = asUtcInstant('2026-08-23T12:00:00.000Z');

export class SimulationCustodyRail implements CustodyRail {
  readonly kind = 'CUSTODY_ASSET' as const;
  private readonly reservations = new Map<string, { vaultId: string; assetId: string; quantity: bigint }>();
  private readonly finality = new Map<string, 'CONFIRMED' | 'PENDING' | 'UNKNOWN' | 'UNAVAILABLE'>();
  nextFinality: 'CONFIRMED' | 'PENDING' | 'UNKNOWN' | 'UNAVAILABLE' = 'CONFIRMED';
  available = true;

  reserve(input: {
    readonly vaultId: string;
    readonly assetId: string;
    readonly quantity: bigint;
  }): { readonly ok: true; readonly reservationId: string } | { readonly ok: false; readonly code: SettlementFailureCode } {
    if (!this.available) {
      return { ok: false, code: 'CUSTODY_UNAVAILABLE' };
    }
    const reservationId = `cres_${this.reservations.size + 1}`;
    this.reservations.set(reservationId, { ...input });
    return { ok: true, reservationId };
  }

  debit(input: {
    readonly reservationId: string;
    readonly assetId: string;
    readonly quantity: bigint;
  }):
    | { readonly ok: true; readonly providerTxRef: string }
    | { readonly ok: false; readonly code: SettlementFailureCode } {
    if (!this.available) {
      return { ok: false, code: 'CUSTODY_UNAVAILABLE' };
    }
    const reserved = this.reservations.get(input.reservationId);
    if (!reserved || reserved.quantity < input.quantity) {
      return { ok: false, code: 'INSUFFICIENT_RESERVED_ASSET' };
    }
    const providerTxRef = `ctx_${input.reservationId}`;
    this.finality.set(providerTxRef, this.nextFinality);
    return { ok: true, providerTxRef };
  }

  queryFinality(providerTxRef: string): 'CONFIRMED' | 'PENDING' | 'UNKNOWN' | 'UNAVAILABLE' {
    return this.finality.get(providerTxRef) ?? 'UNKNOWN';
  }
}

export function createExchangeProductSandbox(now: UtcInstant = NOW) {
  const clock = new FrozenClock(now);
  const issuer = new AuthorityIssuer('sunrey-exchange-product');
  const ledger = new Ledger(issuer, clock);
  const coin = new InMemoryCoinPort();
  const fiat = new InMemoryFiatPort();
  const native = new SimulationNativeDvpAdapter();
  const custody = new SimulationCustodyRail();
  const finalized = new Set<string>(['always']);
  const platform = new ExchangeProductPlatform({
    ledger: {
      kind: 'LEDGER_FIAT',
      ledger,
      registerAccount: (account) => ledger.accounts.registerSystemAccount(account),
    },
    custody,
    native: {
      kind: 'NATIVE_CHAIN',
      port: native,
      queryFinality: (txId) => (finalized.has(txId) || finalized.has('always') ? 'BFT_FINALIZED' : 'PENDING_PROPOSAL'),
      recordTx: (_txId) => undefined,
    },
    application: { kind: 'APPLICATION_PORT', coin, fiat },
  });

  const markets = [
    {
      marketId: SUNREY_COIN_USD_MARKET_ID,
      instrument: 'SUNREY_COIN-USD',
      baseAssetId: 'SUNREY_COIN',
      quoteAssetId: 'USD',
      state: 'OPEN',
    },
  ];
  const snapshots = new Map<string, MarketDataSnapshot>();
  const trades: ImmutableTrade[] = [];
  const ordersByOwner = new Map<string, DigitalOrder[]>();

  const api = new ExchangeApplicationApi(platform, {
    listMarkets: () => markets,
    snapshot: (marketId) => snapshots.get(marketId) ?? null,
    trades: (marketId) => trades.filter((item) => item.marketId === marketId),
    ordersFor: (ownerId) => ordersByOwner.get(ownerId) ?? [],
    holdingsFor: (ownerId) => [
      { assetId: 'SUNREY_COIN', quantity: 10n, reserved: 0n, pendingSettlement: 0n },
    ],
    now: () => clock.now(),
  });

  function issueAuthority(accountId: string, idempotencyKey: string) {
    return issuer.issue({
      authorityId: `ea_${idempotencyKey}`,
      actionType: ACTION_TYPES.SETTLE_EXCHANGE_TRADE,
      accountId,
      intentId: idempotencyKey,
      idempotencyKey,
      amount: null,
      issuedAt: clock.now(),
      expiresAt: addMs(clock.now(), AUTHORITY_TTL_MS),
    });
  }

  function seedNative(owner: string, assetId: string, units: bigint) {
    native.seed(owner, AssetQuantity.fromScaledUnits(units, assetId));
  }

  function seedFiat(accountId: string, minor: bigint) {
    fiat.seed(accountId, Money.fromMinorUnits(minor, 'USD'));
  }

  function seedCoin(ownerId: string, units: bigint) {
    coin.seed(ownerId, AssetQuantity.fromScaledUnits(units, 'SUNREY_COIN'));
  }

  return {
    clock,
    issuer,
    ledger,
    coin,
    fiat,
    native,
    custody,
    finalized,
    platform,
    api,
    markets,
    snapshots,
    trades,
    ordersByOwner,
    issueAuthority,
    seedNative,
    seedFiat,
    seedCoin,
    putSnapshot(snapshot: MarketDataSnapshot) {
      snapshots.set(snapshot.marketId, snapshot);
    },
    putOrder(ownerId: string, order: DigitalOrder) {
      const list = ordersByOwner.get(ownerId) ?? [];
      list.push(order);
      ordersByOwner.set(ownerId, list);
    },
    recordTrade(trade: ImmutableTrade) {
      trades.push(trade);
    },
  };
}

export function syntheticTrade(input: {
  readonly tradeId?: string;
  readonly quantity?: bigint;
  readonly priceUnits?: bigint;
  readonly now?: UtcInstant;
}): ImmutableTrade {
  const quantity = AssetQuantity.fromScaledUnits(input.quantity ?? 1n, 'SUNREY_COIN');
  const price = exchangePrice({
    baseAssetId: 'SUNREY_COIN',
    quoteAssetId: 'USD',
    quoteKind: 'FIAT_MONEY',
    priceUnits: input.priceUnits ?? 100n,
    basePrecision: 6,
  });
  const match = {
    maker: { orderId: 'xord_maker', marketId: SUNREY_COIN_USD_MARKET_ID, side: 'SELL' },
    taker: { orderId: 'xord_taker', marketId: SUNREY_COIN_USD_MARKET_ID, side: 'BUY' },
    quantity,
    price,
  } as Match;
  const trade = toTrade(
    match,
    1,
    input.now ?? NOW,
    {
      scheduleId: 'fees:simulation-v1' as never,
      version: 1,
      makerFeeMinor: 0n,
      takerFeeMinor: 0n,
      listingFeeMinor: 0n,
      computeFeeMinor: 0n,
      commercialPermanence: 'SIMULATION_CONFIGURATION',
    },
    'USD',
  );
  return input.tradeId ? Object.freeze({ ...trade, tradeId: input.tradeId as ImmutableTrade['tradeId'] }) : trade;
}

export function emptySnapshot(now: UtcInstant = NOW): MarketDataSnapshot {
  return {
    marketId: SUNREY_COIN_USD_MARKET_ID,
    sequence: 1 as MarketDataSnapshot['sequence'],
    bestBid: null,
    bestAsk: null,
    lastTrade: null,
    lastPriceLabel: 'UNAVAILABLE',
    volume: AssetQuantity.fromScaledUnits(0n, 'SUNREY_COIN'),
    depth: { bids: [], asks: [] },
  };
}

void NOW;
