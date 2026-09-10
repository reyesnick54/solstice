/**
 * BFF quote builders for crypto market reference.
 */

import type { UtcInstant } from '../../../domain/src/time.ts';
import { createCryptoMarketReferenceService } from './service.ts';
import type { CryptoHistoryInterval } from './types.ts';
import { defaultCryptoMarketNow } from './validation.ts';
import { buildBffCryptoQuoteSync, buildBffCryptoHistorySync } from './bff-sync.ts';

export const DEFAULT_CRYPTO_PROVIDER_ID = 'coingecko';
export const DEFAULT_CRYPTO_NOW = defaultCryptoMarketNow();

const defaultService = createCryptoMarketReferenceService();

export function buildBffCryptoQuote(assetId: string, providerId = DEFAULT_CRYPTO_PROVIDER_ID) {
  return buildBffCryptoQuoteSync(assetId, providerId);
}

export function buildBffCryptoHistory(
  assetId: string,
  interval: CryptoHistoryInterval,
  from: UtcInstant,
  to: UtcInstant,
  providerId = DEFAULT_CRYPTO_PROVIDER_ID,
) {
  return buildBffCryptoHistorySync(assetId, interval, from, to, providerId);
}

export async function buildBffCryptoQuoteAsync(
  assetId: string,
  nowUtc: UtcInstant = DEFAULT_CRYPTO_NOW,
  service = defaultService,
) {
  const result = await service.getQuote(assetId, nowUtc);
  if (!result.ok) {
    return null;
  }
  return result.value;
}

export async function buildBffCryptoHistoryAsync(
  assetId: string,
  interval: CryptoHistoryInterval,
  from: UtcInstant,
  to: UtcInstant,
  nowUtc: UtcInstant = DEFAULT_CRYPTO_NOW,
  service = defaultService,
) {
  const result = await service.getHistory(assetId, interval, { from, to }, nowUtc);
  if (!result.ok) {
    return [];
  }
  return result.value;
}
