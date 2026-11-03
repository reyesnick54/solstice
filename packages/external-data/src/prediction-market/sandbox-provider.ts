/**
 * Fixture-only Polymarket CLOB research adapter.
 * Does not perform authenticated trading, wallet signing, or private-key handling.
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { asUtcInstant } from '@solstice/domain';
import type { PolymarketResearchBookRow, PolymarketResearchMarketRow, PolymarketResearchSnapshot } from './models.ts';
import {
  POLYMARKET_CLOB_RESEARCH_PROVIDER_ID,
  POLYMARKET_LIVE_TRADING_ENABLED,
  POLYMARKET_PRIVATE_KEY_HANDLING,
} from './taxonomy.ts';

const here = dirname(fileURLToPath(import.meta.url));

type RawFixture = {
  readonly markets: readonly {
    readonly conditionId: string;
    readonly question: string;
    readonly category: string | null;
    readonly expiresAt: string | null;
    readonly yesTokenId: string;
    readonly noTokenId: string;
  }[];
  readonly books: readonly {
    readonly tokenId: string;
    readonly conditionId: string;
    readonly bids: readonly { readonly price: string; readonly size: string }[];
    readonly asks: readonly { readonly price: string; readonly size: string }[];
    readonly volume24h: string;
    readonly observedAt: string;
  }[];
};

function loadFixture(): RawFixture {
  const path = join(here, 'fixtures', 'polymarket-clob-sandbox.json');
  return JSON.parse(readFileSync(path, 'utf8')) as RawFixture;
}

export type PolymarketClobSandboxProvider = {
  readonly providerId: typeof POLYMARKET_CLOB_RESEARCH_PROVIDER_ID;
  readonly liveTradingEnabled: false;
  readonly privateKeyHandling: typeof POLYMARKET_PRIVATE_KEY_HANDLING;
  fetchSnapshot(): PolymarketResearchSnapshot;
};

export function createPolymarketClobSandboxProvider(): PolymarketClobSandboxProvider {
  if (POLYMARKET_LIVE_TRADING_ENABLED) {
    throw new Error('Polymarket live trading must remain disabled');
  }
  return Object.freeze({
    providerId: POLYMARKET_CLOB_RESEARCH_PROVIDER_ID,
    liveTradingEnabled: false as const,
    privateKeyHandling: POLYMARKET_PRIVATE_KEY_HANDLING,
    fetchSnapshot: () => {
      const raw = loadFixture();
      const markets: PolymarketResearchMarketRow[] = raw.markets.map((m) =>
        Object.freeze({
          providerId: POLYMARKET_CLOB_RESEARCH_PROVIDER_ID,
          conditionId: m.conditionId,
          question: m.question,
          category: m.category,
          expiresAt: m.expiresAt ? asUtcInstant(m.expiresAt) : null,
          yesTokenId: m.yesTokenId,
          noTokenId: m.noTokenId,
        }),
      );
      const books: PolymarketResearchBookRow[] = raw.books.map((b) =>
        Object.freeze({
          providerId: POLYMARKET_CLOB_RESEARCH_PROVIDER_ID,
          tokenId: b.tokenId,
          conditionId: b.conditionId,
          bids: Object.freeze(b.bids.map((x) => Object.freeze({ ...x }))),
          asks: Object.freeze(b.asks.map((x) => Object.freeze({ ...x }))),
          volume24h: b.volume24h,
          observedAt: asUtcInstant(b.observedAt),
        }),
      );
      return Object.freeze({ markets: Object.freeze(markets), books: Object.freeze(books) });
    },
  });
}
