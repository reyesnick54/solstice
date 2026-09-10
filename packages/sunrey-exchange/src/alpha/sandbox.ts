import { Money } from '../../../money/src/money.ts';
import { FrozenClock } from '../../../config/src/clock.ts';
import { asUtcInstant, type UtcInstant } from '../../../domain/src/time.ts';
import { InMemoryFiatPort } from '../adapters.ts';
import { NativeClearingEngine } from '../native-clearing/engine.ts';
import { ExchangeApplicationApi } from '../product/api.ts';
import { createExchangeProductSandbox } from '../product/sandbox.ts';
import { AlphaExchangeEngine } from './engine.ts';
import { canonicalAlphaMarkets, resolveAlphaMarketRef } from '../ids.ts';
import { InMemoryLedgerUsdAuthority, ledgerUsdAuthorityFromFiatPort, type LedgerUsdAuthority } from './usd-ledger.ts';
import type { DigitalOrder, ImmutableTrade, MarketDataSnapshot } from '../types.ts';

const NOW = asUtcInstant('2026-09-10T12:00:00.000Z');

export function createAlphaExchangeSandbox(input?: {
  readonly now?: UtcInstant;
  readonly usd?: LedgerUsdAuthority;
  readonly fiat?: InMemoryFiatPort;
  readonly clearing?: NativeClearingEngine;
}) {
  const now = input?.now ?? NOW;
  const clock = new FrozenClock(now);
  const fiat = input?.fiat ?? new InMemoryFiatPort();
  const usd = input?.usd ?? ledgerUsdAuthorityFromFiatPort(fiat);
  const clearing = input?.clearing ?? new NativeClearingEngine();
  const alpha = new AlphaExchangeEngine({ clearing, usd, now });
  const productWorld = createExchangeProductSandbox(now);
  const snapshots = new Map<string, MarketDataSnapshot>();

  const catalog = {
    listMarkets: () =>
      canonicalAlphaMarkets().map((market) =>
        Object.freeze({
          marketId: market.marketId,
          instrument: market.instrument,
          baseAssetId: market.baseAssetId,
          quoteAssetId: market.quoteAssetId,
          state: market.state,
        }),
      ),
    snapshot(marketId: string): MarketDataSnapshot | null {
      const resolved = resolveAlphaMarketRef(marketId);
      if (!resolved) {
        return null;
      }
      const snapshot = alpha.snapshot(resolved.instrument) ?? alpha.snapshot(resolved.marketId);
      if (snapshot) {
        snapshots.set(resolved.marketId, snapshot);
      }
      return snapshot;
    },
    trades(marketId: string): readonly ImmutableTrade[] {
      return alpha.tradesFor(marketId);
    },
    ordersFor(ownerId: string): readonly DigitalOrder[] {
      return alpha.ordersFor(ownerId);
    },
    holdingsFor(ownerId: string) {
      const participant = alpha.participants.get(ownerId);
      if (!participant) {
        return Object.freeze([
          { assetId: 'SUNREY_COIN', quantity: 0n, reserved: 0n, pendingSettlement: 0n },
          { assetId: 'MOONREY_COIN', quantity: 0n, reserved: 0n, pendingSettlement: 0n },
        ]);
      }
      const sun = clearing.position(participant.accountId, 'SUNREY_COIN');
      const moon = clearing.position(participant.accountId, 'MOONREY_COIN');
      return Object.freeze([
        { assetId: 'SUNREY_COIN', quantity: sun.available, reserved: sun.reserved, pendingSettlement: sun.pendingSettlement },
        { assetId: 'MOONREY_COIN', quantity: moon.available, reserved: moon.reserved, pendingSettlement: moon.pendingSettlement },
      ]);
    },
    now: () => clock.now(),
  };

  const api = new ExchangeApplicationApi(productWorld.platform, catalog);

  return Object.freeze({
    clock,
    fiat,
    usd,
    clearing,
    alpha,
    platform: productWorld.platform,
    api,
    snapshots,
    seedParticipant(input: { readonly participantId: string; readonly usdAccountId: string; readonly usdMinor?: bigint; readonly sunrey?: bigint; readonly moonrey?: bigint }) {
      if (input.usdMinor !== undefined) {
        if (usd instanceof InMemoryLedgerUsdAuthority) {
          usd.seed(input.usdAccountId, input.usdMinor);
        }
        fiat.seed(input.usdAccountId, Money.fromMinorUnits(input.usdMinor, 'USD'));
      }
      const participant = alpha.registerParticipant({ participantId: input.participantId, usdAccountId: input.usdAccountId });
      if (input.sunrey !== undefined) {
        alpha.creditNative(participant.accountId, 'SUNREY_COIN', input.sunrey);
      }
      if (input.moonrey !== undefined) {
        alpha.creditNative(participant.accountId, 'MOONREY_COIN', input.moonrey);
      }
      return participant;
    },
    putSnapshot(snapshot: MarketDataSnapshot) {
      snapshots.set(snapshot.marketId, snapshot);
    },
  });
}
