/**
 * HELIOS observation integration for AAF07 market-data certification runtime.
 */

import type { UtcInstant } from '../../../../../domain/src/time.ts';
import {
  createExternalMarketDataCertificationRuntime,
  type ExternalMarketDataCertificationRecord,
  type ExternalMarketDataCertificationRuntime,
} from '../../../../../external-data/src/certification/market-data/runtime.ts';
import type { MarketDataFetchOutcome } from '../../../../../external-data/src/certification/market-data/fetch-guard.ts';
import { evaluateAaf07MarketDataQualification, type Aaf07MarketDataQualificationResult } from './qualification.ts';
import { MARKET_DATA_CERTIFICATION_STATES } from '../../../../../provider-sdk/src/market-data-capability/certification-states.ts';
import { MARKET_DATA_CAPABILITY_SCHEMA_VERSION } from '../../../../../provider-sdk/src/market-data-capability/types.ts';

export type HeliosExternalMarketDataCertificationServiceOptions = {
  readonly fetchFn?: typeof fetch;
  readonly runtime?: ExternalMarketDataCertificationRuntime;
};

export class HeliosExternalMarketDataCertificationService {
  readonly #runtime: ExternalMarketDataCertificationRuntime;

  constructor(options: HeliosExternalMarketDataCertificationServiceOptions = {}) {
    this.#runtime =
      options.runtime ??
      createExternalMarketDataCertificationRuntime(
        options.fetchFn ? { fetchFn: options.fetchFn } : undefined,
      );
  }

  runtime(): ExternalMarketDataCertificationRuntime {
    return this.#runtime;
  }

  async certifyProvider(providerId: string, nowUtc: UtcInstant): Promise<ExternalMarketDataCertificationRecord | null> {
    return this.#runtime.certifyProvider(providerId, nowUtc);
  }

  async fetchExternalObservation(
    providerId: string,
    instrumentId: string,
    nowUtc: UtcInstant,
  ): Promise<MarketDataFetchOutcome> {
    return this.#runtime.fetchExternalObservation(providerId, instrumentId, nowUtc);
  }

  evaluateProgramQualification(input: {
    readonly finnhubHarnessPassed: boolean;
    readonly coingeckoHarnessPassed: boolean;
    readonly silentFixtureGuardPassed: boolean;
    readonly healthEvidenceSealed: boolean;
    readonly metricsRecorded: boolean;
  }): Aaf07MarketDataQualificationResult {
    return evaluateAaf07MarketDataQualification({
      ...input,
      capabilityContractPresent: MARKET_DATA_CAPABILITY_SCHEMA_VERSION === 'sunrey.market-data-capability.v1',
      certificationStatesPresent: MARKET_DATA_CERTIFICATION_STATES.length === 10,
    });
  }
}

export function createHeliosExternalMarketDataCertificationService(
  options: HeliosExternalMarketDataCertificationServiceOptions = {},
): HeliosExternalMarketDataCertificationService {
  return new HeliosExternalMarketDataCertificationService(options);
}
