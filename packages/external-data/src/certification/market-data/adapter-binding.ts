/**
 * Bind HELIOS overlay adapter_binding values to Exchange capital-market adapters.
 */

import { createFinnhubCapitalMarketAdapter } from '../../../../sunrey-exchange/src/capital-market/adapters/finnhub-adapter.ts';
import type { CapitalMarketProvider } from '../../../../sunrey-exchange/src/capital-market/provider.ts';
import { CoingeckoCryptoSpotAdapter } from '../../../../sunrey-exchange/src/crypto-market/spot/adapters/coingecko-adapter.ts';
import type { HeliosMarketDataCatalogOverlayEntry } from '../../../../provider-sdk/src/market-data-capability/build-from-catalog.ts';

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
