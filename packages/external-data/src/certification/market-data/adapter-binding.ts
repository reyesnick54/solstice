/**
 * Bind HELIOS overlay adapter_binding values to Exchange capital-market adapters.
 */

import { createFinnhubCapitalMarketAdapter } from '@solstice/sunrey-exchange/capital-market';
import type { CapitalMarketProvider } from '@solstice/sunrey-exchange/capital-market';
import { CoingeckoCryptoSpotAdapter } from '@solstice/sunrey-exchange/crypto-market/coingecko-adapter';
import type { HeliosMarketDataCatalogOverlayEntry } from '@solstice/provider-sdk';

export type MarketDataAdapterBindingOptions = {
  readonly fetchFn?: typeof fetch;
};

export function createMarketDataCertificationProvider(
  overlay: HeliosMarketDataCatalogOverlayEntry,
  options: MarketDataAdapterBindingOptions = {},
): CapitalMarketProvider {
  switch (overlay.adapter_binding) {
    case 'finnhub_capital_market':
      return createFinnhubCapitalMarketAdapter(
        options.fetchFn ? { fetchFn: options.fetchFn } : undefined,
      );
    case 'coingecko_crypto_spot':
      return new CoingeckoCryptoSpotAdapter(options.fetchFn ? { fetchFn: options.fetchFn } : undefined);
    default:
      throw new Error(`unsupported market-data adapter_binding: ${overlay.adapter_binding}`);
  }
}
