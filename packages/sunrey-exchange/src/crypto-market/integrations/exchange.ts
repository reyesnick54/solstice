/**
 * Exchange integration — external crypto reference as context only.
 */

import type { UtcInstant } from '../../../../domain/src/time.ts';
import type { CryptoMarketReferenceService } from '../service.ts';

export type ExternalCryptoReferenceContext = {
  readonly schema: 'sunrey.exchange.external-crypto-context.v1';
  readonly referenceOnly: true;
  readonly orderBookAuthoritative: true;
  readonly externalPriceUsedForExecution: false;
  readonly assetId: string;
  readonly symbol: string;
  readonly referencePriceMinorUnits: string;
  readonly quoteCurrency: string;
  readonly providerId: string;
  readonly freshness: string;
  readonly priceSourceType: string;
  readonly generatedAt: UtcInstant;
};

export async function buildExternalCryptoReferenceContext(
  service: CryptoMarketReferenceService,
  assetId: string,
  nowUtc: UtcInstant,
): Promise<ExternalCryptoReferenceContext | null> {
  const result = await service.getQuote(assetId, nowUtc);
  if (!result.ok) {
    return null;
  }
  return Object.freeze({
    schema: 'sunrey.exchange.external-crypto-context.v1',
    referenceOnly: true,
    orderBookAuthoritative: true,
    externalPriceUsedForExecution: false,
    assetId: result.value.assetId,
    symbol: result.value.symbol,
    referencePriceMinorUnits: result.value.priceMinorUnits.toString(),
    quoteCurrency: result.value.quoteCurrency,
    providerId: result.value.providerId,
    freshness: result.value.freshness.status,
    priceSourceType: result.value.provenance.priceSourceType,
    generatedAt: nowUtc,
  });
}

export function exchangeSeparationProof(): Readonly<Record<string, boolean>> {
  return Object.freeze({
    externalCryptoReference: true,
    sunreyExchangeMarketState: true,
    externalDataPopulatesOrderBook: false,
    externalDataExecutesTrades: false,
    externalDataUpdatesBalances: false,
  });
}
