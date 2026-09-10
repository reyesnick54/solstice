/**
 * Crypto market adapter mode — distinct from ENVIRONMENT / LIVE_* monetary flags.
 */

import { DATA_MODE } from '../../../../config/src/data-mode.ts';

export const CRYPTO_MARKET_ADAPTER_MODES = ['auto', 'live', 'simulation'] as const;
export type CryptoMarketAdapterMode = (typeof CRYPTO_MARKET_ADAPTER_MODES)[number];

export function resolveCryptoMarketAdapterMode(
  explicit?: CryptoMarketAdapterMode,
  dataMode: typeof DATA_MODE = DATA_MODE,
): 'live' | 'simulation' {
  if (explicit === 'live') {
    return 'live';
  }
  if (explicit === 'simulation') {
    return 'simulation';
  }
  return dataMode === 'live' || dataMode === 'preview' ? 'live' : 'simulation';
}
