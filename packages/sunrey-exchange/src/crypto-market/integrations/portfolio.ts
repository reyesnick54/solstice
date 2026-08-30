/**
 * Portfolio integration — estimated/reference valuation only.
 */

import type { UtcInstant } from '../../../../domain/src/time.ts';
import type { CryptoMarketReferenceService } from '../service.ts';

export type PortfolioEstimatedValuation = {
  readonly schema: 'sunrey.portfolio.estimated-valuation.v1';
  readonly assetId: string;
  readonly symbol: string;
  readonly quantityMinorUnits: string;
  readonly estimatedValueMinorUnits: string;
  readonly quoteCurrency: string;
  readonly valuationType: 'REFERENCE_ESTIMATE';
  readonly custodialBalance: false;
  readonly settledValue: false;
  readonly realizedPnl: false;
  readonly providerId: string;
  readonly freshness: string;
  readonly generatedAt: UtcInstant;
};

export async function estimatePortfolioValuation(
  service: CryptoMarketReferenceService,
  assetId: string,
  quantityMinorUnits: bigint,
  nowUtc: UtcInstant,
): Promise<PortfolioEstimatedValuation | null> {
  const result = await service.getQuote(assetId, nowUtc);
  if (!result.ok) {
    return null;
  }
  const estimatedValueMinorUnits = (result.value.priceMinorUnits * quantityMinorUnits) / 10n ** 8n;
  return Object.freeze({
    schema: 'sunrey.portfolio.estimated-valuation.v1',
    assetId,
    symbol: result.value.symbol,
    quantityMinorUnits: quantityMinorUnits.toString(),
    estimatedValueMinorUnits: estimatedValueMinorUnits.toString(),
    quoteCurrency: result.value.quoteCurrency,
    valuationType: 'REFERENCE_ESTIMATE',
    custodialBalance: false,
    settledValue: false,
    realizedPnl: false,
    providerId: result.value.providerId,
    freshness: result.value.freshness.status,
    generatedAt: nowUtc,
  });
}
