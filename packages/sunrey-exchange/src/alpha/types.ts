import type { ExchangeAccountId, ExchangeMarketId } from '../ids.ts';
import type { MarketMakerSession } from '../ops/types.ts';

export type AlphaAllocationRecord = {
  readonly allocationId: string;
  readonly participantId: string;
  readonly assetKind: 'SANDBOX_USD' | 'SUNREY_COIN' | 'MOONREY_COIN';
  readonly quantity: bigint;
  readonly authority: string;
  readonly source: string;
  readonly provenance: 'GENESIS' | 'REPLENISHMENT';
};

export type AlphaLiquidityStatus = 'OK' | 'LOW_LIQUIDITY';

export type AlphaQuoteBand = {
  readonly pair: 'SRC/USD' | 'MRC/USD' | 'SRC/MRC';
  readonly side: 'BID' | 'ASK';
  readonly priceUnits: bigint;
  readonly quantity: bigint;
  readonly spreadBps: bigint;
  readonly source: string;
};

export type AlphaPostedQuote = {
  readonly pair: 'SRC/USD' | 'MRC/USD' | 'SRC/MRC';
  readonly bidPriceUnits: bigint;
  readonly askPriceUnits: bigint;
  readonly spreadUnits: bigint;
  readonly spreadBps: bigint;
  readonly bidQuantity: bigint;
  readonly askQuantity: bigint;
  readonly source: string;
  readonly depthBands: readonly AlphaQuoteBand[];
};

export type AlphaMarketMakerSnapshot = {
  readonly participantId: string;
  readonly accountId: ExchangeAccountId;
  readonly marketId: ExchangeMarketId;
  readonly allocations: readonly AlphaAllocationRecord[];
  readonly sandboxUsdMinor: bigint;
  readonly totalIssuedSunrey: bigint;
  readonly totalIssuedMoonrey: bigint;
  readonly activeQuoteOrderIds: readonly string[];
  readonly liquidityStatus: AlphaLiquidityStatus;
};

export type InternalAlphaMarketMakerView = {
  readonly session: MarketMakerSession;
  readonly accountId: ExchangeAccountId;
  readonly liquidityStatus: AlphaLiquidityStatus;
  readonly quotes: readonly AlphaPostedQuote[];
  readonly allocations: readonly AlphaAllocationRecord[];
};
