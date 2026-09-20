/**
 * Capital market provider port.
 *
 * Adapters implement this contract. They do not execute trades, post journals,
 * or issue Execution Authority. No hidden fixture fallback at runtime.
 */

import type { UtcInstant } from '@solstice/domain';
import type { CapitalMarketHistoricalRange, CapitalMarketTimeframe } from './timeframes.ts';
import type {
  CapitalMarketBar,
  CapitalMarketCapabilityReport,
  CapitalMarketObservation,
  CapitalMarketProviderHealth,
  CapitalMarketResult,
  CapitalMarketSessionObservation,
} from './types.ts';

export type CapitalMarketProvider = {
  readonly providerId: string;
  readonly productionAuthorized: false;
  readonly credentialEnvVar: string | null;

  credentialConfigured(): boolean;
  health(nowUtc: UtcInstant): CapitalMarketProviderHealth;
  getQuote(instrumentId: string, nowUtc: UtcInstant): Promise<CapitalMarketResult<CapitalMarketObservation>>;
  getHistoricalBars(
    instrumentId: string,
    timeframe: CapitalMarketTimeframe,
    range: CapitalMarketHistoricalRange,
    nowUtc: UtcInstant,
  ): Promise<CapitalMarketResult<readonly CapitalMarketBar[]>>;
  getMarketStatus(exchange: string, nowUtc: UtcInstant): Promise<CapitalMarketResult<CapitalMarketSessionObservation>>;
  getCapabilities(nowUtc: UtcInstant): readonly CapitalMarketCapabilityReport[];
};
