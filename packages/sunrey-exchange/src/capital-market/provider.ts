/**
 * Capital market provider port.
 *
 * Adapters implement this contract. They do not execute trades, post journals,
 * or issue Execution Authority. No hidden fixture fallback at runtime.
 */

import type { UtcInstant } from '../../../domain/src/time.ts';
import type { CapitalMarketObservation, CapitalMarketProviderHealth, CapitalMarketResult } from './types.ts';

export type CapitalMarketProvider = {
  readonly providerId: string;
  readonly productionAuthorized: false;
  readonly credentialEnvVar: string | null;

  credentialConfigured(): boolean;
  health(nowUtc: UtcInstant): CapitalMarketProviderHealth;
  getQuote(instrumentId: string, nowUtc: UtcInstant): Promise<CapitalMarketResult<CapitalMarketObservation>>;
};
