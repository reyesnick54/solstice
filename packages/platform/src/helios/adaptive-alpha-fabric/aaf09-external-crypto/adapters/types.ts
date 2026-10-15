import type { UtcInstant } from '../../../../../../domain/src/time.ts';
import type { NormalizedCryptoMarketObservation } from '../types.ts';

export type CryptoVenueAdapterFetchContext = {
  readonly instrumentId: string;
  readonly nowUtc: UtcInstant;
};

export type CryptoVenueAdapterResult =
  | { readonly ok: true; readonly observations: readonly NormalizedCryptoMarketObservation[] }
  | { readonly ok: false; readonly code: string; readonly message: string };

export type CryptoVenueMarketDataAdapter = {
  readonly providerId: string;
  readonly aaf07Certified: boolean;
  fetchBestBidOffer(ctx: CryptoVenueAdapterFetchContext): Promise<CryptoVenueAdapterResult>;
  fetchRecentTrades(ctx: CryptoVenueAdapterFetchContext): Promise<CryptoVenueAdapterResult>;
  fetchOhlcvBar(
    ctx: CryptoVenueAdapterFetchContext & { readonly timeframe: '1h' },
  ): Promise<CryptoVenueAdapterResult>;
};

export type CryptoReferenceAdapter = {
  readonly providerId: string;
  readonly aaf07Certified: boolean;
  fetchReferenceQuote(ctx: CryptoVenueAdapterFetchContext): Promise<CryptoVenueAdapterResult>;
};
