/**
 * AAF08 provider port — strategies must not call vendor HTTP; adapters implement this port.
 */

import type { UtcInstant } from '../../../../../domain/src/time.ts';
import type { BarTimeframe } from '../../market-observation/types.ts';
import type {
  ExternalEquitiesBarPayload,
  ExternalEquitiesInstrumentMetadata,
  ExternalEquitiesProviderHealth,
  ExternalEquitiesQuotePayload,
  ExternalEquitiesSessionPayload,
} from './types.ts';

export type ExternalEquitiesProviderResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly code: string; readonly message: string };

export type ExternalEquitiesHistoricalRange = {
  readonly from: UtcInstant;
  readonly to: UtcInstant;
};

export type ExternalEquitiesProviderPort = {
  readonly providerId: string;
  readonly health: (nowUtc: UtcInstant) => ExternalEquitiesProviderHealth;
  readonly getInstrumentMetadata: (instrumentId: string) => ExternalEquitiesInstrumentMetadata | null;
  readonly fetchQuote: (
    instrumentId: string,
    nowUtc: UtcInstant,
  ) => Promise<ExternalEquitiesProviderResult<ExternalEquitiesQuotePayload>>;
  readonly fetchHistoricalBars: (
    instrumentId: string,
    timeframe: BarTimeframe,
    range: ExternalEquitiesHistoricalRange,
    nowUtc: UtcInstant,
  ) => Promise<ExternalEquitiesProviderResult<readonly ExternalEquitiesBarPayload[]>>;
  readonly fetchMarketSession: (
    exchange: string,
    nowUtc: UtcInstant,
  ) => Promise<ExternalEquitiesProviderResult<ExternalEquitiesSessionPayload>>;
};
