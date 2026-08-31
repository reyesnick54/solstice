/**
 * Synchronous BFF quote builders for crypto market reference.
 */

import { buildFixtureHistory, normalizeFixtureQuote } from './adapters/normalize.ts';
import { resolveCryptoAsset } from './assets.ts';
import type { CryptoHistoryInterval } from './types.ts';
import { defaultCryptoMarketNow } from './validation.ts';
import type { UtcInstant } from '../../../domain/src/time.ts';

export const DEFAULT_CRYPTO_PROVIDER_ID = 'coingecko';
export const DEFAULT_CRYPTO_NOW = defaultCryptoMarketNow();

export function buildBffCryptoQuote(assetId: string, providerId = DEFAULT_CRYPTO_PROVIDER_ID) {
  const result = normalizeFixtureQuote(providerId, assetId, DEFAULT_CRYPTO_NOW);
  if (!result.ok) {
    return null;
  }
  return result.quote;
}

export function buildBffCryptoHistory(
  assetId: string,
  interval: CryptoHistoryInterval,
  from: UtcInstant,
  to: UtcInstant,
  providerId = DEFAULT_CRYPTO_PROVIDER_ID,
) {
  const asset = resolveCryptoAsset(assetId);
  if (!asset) {
    return [];
  }
  return buildFixtureHistory(asset, providerId, interval, from, to, DEFAULT_CRYPTO_NOW);
}
