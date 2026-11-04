/**
 * HELIOS observation integration for AAF07 market-data certification runtime.
 */

import type { UtcInstant } from '@solstice/domain';
import {
  createExternalMarketDataCertificationRuntime,
  type ExternalMarketDataCertificationRecord,
  type ExternalMarketDataCertificationRuntime,
} from '@solstice/external-data';
import type { MarketDataFetchOutcome } from '@solstice/external-data';
import { evaluateAaf07MarketDataQualification, type Aaf07MarketDataQualificationResult } from './qualification.ts';
import { MARKET_DATA_CERTIFICATION_STATES } from '@solstice/provider-sdk';
import { MARKET_DATA_CAPABILITY_SCHEMA_VERSION } from '@solstice/provider-sdk';

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
