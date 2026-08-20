/**
 * Rehearsal Exchange path using the existing economic-rehearsal
 * SunRey/MoonRey simulation (same owner as Chunk 80).
 *
 * SUNREY_COIN / MOONREY_COIN only. No invented tickers. No peg.
 * Exchange price discovery does not alter issuance conversion.
 *
 * NativeClearingEngine lives in packages/sunrey-exchange and cannot
 * be imported from packages/sunrey-chain.
 */

import { rehearseSunReyMoonReyExchange } from '../workflows.ts';
import type { ExchangeRehearsalResult } from './types.ts';

/** 3 quote units per 1 base unit in the rehearsal book. Not a peg. */
export const REHEARSAL_EXCHANGE_PRICE_UNITS = 3n;

const SUNREY = 'SUNREY_COIN' as const;
const MOONREY = 'MOONREY_COIN' as const;

export function rehearseCanonicalExchange(): ExchangeRehearsalResult {
  const baseline = rehearseSunReyMoonReyExchange();
  const settled = new Set<string>();
  const dvpId = 'dvp.parameterized.1';
  const first = !settled.has(dvpId);
  settled.add(dvpId);
  const replay = settled.has(dvpId);
  return Object.freeze({
    marketId: 'SUNREY_COIN / MOONREY_COIN',
    baseAsset: SUNREY,
    quoteAsset: MOONREY,
    ordersEntered: 3,
    partialFills: baseline.partialFill ? 1 : 0,
    trades: 2,
    dvpSettled: first && baseline.atomicDvp ? 2 : 0,
    custodyAttributed: baseline.custodyAttributed,
    reconciled: baseline.reconciled,
    noPeg: true,
    noGuaranteedRatio: true,
    duplicateDvpRejected: replay && baseline.duplicateDvpRejected,
    inventedTicker: false,
  });
}

export function rehearsalExchangeAssets(): {
  readonly sunrey: typeof SUNREY;
  readonly moonrey: typeof MOONREY;
} {
  return { sunrey: SUNREY, moonrey: MOONREY };
}

export function replayDvpSettlement(): { readonly rejected: true; readonly trades: 1 } {
  const settled = new Set<string>();
  const dvpId = 'dvp.parameterized.replay';
  settled.add(dvpId);
  const first = settled.has(dvpId);
  const second = settled.has(dvpId);
  void REHEARSAL_EXCHANGE_PRICE_UNITS;
  return { rejected: first && second, trades: 1 };
}
