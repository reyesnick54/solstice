/**
 * Capital market adapter factory.
 */

import type { CapitalMarketProvider } from '../provider.ts';
import { createFinnhubCapitalMarketAdapter, type FinnhubCapitalMarketAdapterOptions } from './finnhub-adapter.ts';

export { createFinnhubCapitalMarketAdapter, FinnhubCapitalMarketAdapter, FINNHUB_CREDENTIAL_ENV_VAR } from './finnhub-adapter.ts';
export {
  decimalToMinorUnits,
  filterBarsToRange,
  finnhubCandleHasData,
  finnhubSourceTimestamp,
  parseFinnhubCandles,
  parseFinnhubMarketStatus,
  unixSeconds,
  validateFinnhubCandlePayload,
  validateFinnhubMarketStatusPayload,
  validateFinnhubQuotePayload,
  volumeToUnits,
  type FinnhubCandlePayload,
  type FinnhubMarketStatusPayload,
  type FinnhubQuotePayload,
} from './parsers.ts';

export const CAPITAL_MARKET_PROVIDER_ID = 'finnhub' as const;

export type CapitalMarketAdapterFactoryOptions = FinnhubCapitalMarketAdapterOptions;

export function createCapitalMarketProvider(
  providerId: string = CAPITAL_MARKET_PROVIDER_ID,
  options?: CapitalMarketAdapterFactoryOptions,
): CapitalMarketProvider {
  if (providerId !== CAPITAL_MARKET_PROVIDER_ID) {
    throw new Error(`unsupported capital market provider: ${providerId}`);
  }
  return createFinnhubCapitalMarketAdapter(options);
}
