import type { UtcInstant } from '@solstice/domain';
import { POLYMARKET_CLOB_RESEARCH_PROVIDER_ID } from './taxonomy.ts';

export type PolymarketResearchMarketRow = {
  readonly providerId: typeof POLYMARKET_CLOB_RESEARCH_PROVIDER_ID;
  readonly conditionId: string;
  readonly question: string;
  readonly category: string | null;
  readonly expiresAt: UtcInstant | null;
  readonly yesTokenId: string;
  readonly noTokenId: string;
};

export type PolymarketResearchBookRow = {
  readonly providerId: typeof POLYMARKET_CLOB_RESEARCH_PROVIDER_ID;
  readonly tokenId: string;
  readonly conditionId: string;
  readonly bids: readonly { readonly price: string; readonly size: string }[];
  readonly asks: readonly { readonly price: string; readonly size: string }[];
  readonly volume24h: string;
  readonly observedAt: UtcInstant;
};

export type PolymarketResearchSnapshot = {
  readonly markets: readonly PolymarketResearchMarketRow[];
  readonly books: readonly PolymarketResearchBookRow[];
};
