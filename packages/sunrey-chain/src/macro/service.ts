/**
 * MacroDataService — provider selection, fallback, and degraded partial responses.
 */

import { createProviderFactory, type ProviderFactory } from '../../../provider-sdk/src/factory.ts';
import type { ProviderRegistry } from '../../../provider-sdk/src/registry.ts';
import type { ExternalObservation, ProviderRegistration } from '../../../provider-sdk/src/types.ts';
import type { MacroAdapter } from './adapters/base.ts';
import {
  CANONICAL_INDICATORS,
  getProviderNativeId,
  type CanonicalIndicatorId,
} from './indicator-mapping.ts';
import type { MacroProviderBundle } from './providers.ts';
import { normalizeCountryCode } from './country.ts';
import type {
  MacroCountrySnapshot,
  MacroGlobalSnapshot,
  MacroIndicator,
  MacroProviderCoverage,
  MacroServiceResult,
  MacroTimeSeries,
} from './types.ts';

export type MacroDataServiceDeps = {
  readonly registry: ProviderRegistry;
  readonly adapters: ReadonlyMap<string, MacroAdapter>;
  readonly nowUtc?: () => string;
};

const INDICATOR_CATEGORIES: Readonly<Record<string, readonly CanonicalIndicatorId[]>> = Object.freeze({
  inflation: Object.freeze([CANONICAL_INDICATORS.US_CPI, CANONICAL_INDICATORS.US_INFLATION_EXPECTATIONS]),
  employment: Object.freeze([CANONICAL_INDICATORS.US_UNEMPLOYMENT]),
  gdp: Object.freeze([CANONICAL_INDICATORS.US_GDP, CANONICAL_INDICATORS.GLOBAL_GDP, CANONICAL_INDICATORS.SA_GDP]),
  interest_rates: Object.freeze([
    CANONICAL_INDICATORS.US_POLICY_RATE,
    CANONICAL_INDICATORS.US_FED_FUNDS,
    CANONICAL_INDICATORS.US_TREASURY_10Y,
    CANONICAL_INDICATORS.US_TREASURY_2Y,
  ]),
  fiscal: Object.freeze([
    CANONICAL_INDICATORS.US_FEDERAL_DEBT,
    CANONICAL_INDICATORS.US_FEDERAL_SPENDING,
  ]),
  population: Object.freeze([
    CANONICAL_INDICATORS.US_POPULATION,
    CANONICAL_INDICATORS.GLOBAL_POPULATION,
    CANONICAL_INDICATORS.SA_POPULATION,
  ]),
});

export class MacroDataService {
  readonly #factory: ProviderFactory;
  readonly #adapters: ReadonlyMap<string, MacroAdapter>;
  readonly #nowUtc: () => string;

  constructor(deps: MacroDataServiceDeps) {
    this.#factory = createProviderFactory(deps.registry);
    this.#adapters = deps.adapters;
    this.#nowUtc = deps.nowUtc ?? (() => new Date().toISOString());
  }

  async getIndicator(
    indicatorId: CanonicalIndicatorId,
    country?: string,
  ): Promise<MacroServiceResult<MacroIndicator> | undefined> {
    const providers = this.#factory.resolve({ capability: 'macroeconomic_indicators', enabledOnly: true });
    const warnings: string[] = [];
    for (const registration of providers) {
      const nativeId = getProviderNativeId(indicatorId, registration.descriptor.id as Parameters<typeof getProviderNativeId>[1]);
      if (!nativeId) {
        continue;
      }
      const adapter = this.#adapters.get(registration.descriptor.id);
      if (!adapter) {
        warnings.push(`adapter missing for ${registration.descriptor.id}`);
        continue;
      }
      const result = await adapter.fetchIndicator(nativeId, country);
      if (result.ok) {
        const stale = result.value.quality.freshnessStatus === 'stale' || result.value.quality.freshnessStatus === 'expired';
        return Object.freeze({
          data: Object.freeze({ ...result.value.data, sourceObservation: result.value }),
          providerId: registration.descriptor.id,
          stale,
          degraded: warnings.length > 0,
          warnings: Object.freeze(warnings),
        });
      }
      warnings.push(`${registration.descriptor.id}: ${result.message}`);
    }
    if (warnings.length === 0) {
      return undefined;
    }
    return Object.freeze({
      data: Object.freeze({
        indicatorId,
        name: indicatorId,
        description: null,
        value: null,
        unit: null,
        frequency: 'unknown',
        country: country ? normalizeCountryCode(country) : null,
        region: null,
        currency: null,
        period: null,
        effectiveDate: null,
        releaseDate: null,
        revisionStatus: 'unknown',
        seasonalAdjustment: 'unknown',
        sourceObservation: null,
      }),
      providerId: 'none',
      stale: true,
      degraded: true,
      warnings: Object.freeze(warnings),
    });
  }

  async getTimeSeries(
    indicatorId: CanonicalIndicatorId,
    country?: string,
    limit?: number,
  ): Promise<MacroServiceResult<MacroTimeSeries> | undefined> {
    const providers = this.#factory.resolve({ capability: 'macroeconomic_indicators', enabledOnly: true });
    const warnings: string[] = [];
    for (const registration of providers) {
      const nativeId = getProviderNativeId(indicatorId, registration.descriptor.id as Parameters<typeof getProviderNativeId>[1]);
      if (!nativeId) {
        continue;
      }
      const adapter = this.#adapters.get(registration.descriptor.id);
      if (!adapter) {
        warnings.push(`adapter missing for ${registration.descriptor.id}`);
        continue;
      }
      const result = await adapter.fetchTimeSeries(nativeId, country, limit);
      if (result.ok) {
        const stale = result.value.quality.freshnessStatus === 'stale' || result.value.quality.freshnessStatus === 'expired';
        return Object.freeze({
          data: Object.freeze({ ...result.value.data, sourceObservation: result.value }),
          providerId: registration.descriptor.id,
          stale,
          degraded: warnings.length > 0,
          warnings: Object.freeze(warnings),
        });
      }
      warnings.push(`${registration.descriptor.id}: ${result.message}`);
    }
    return undefined;
  }

  async getCountrySnapshot(country: string): Promise<MacroCountrySnapshot> {
    const countryCode = normalizeCountryCode(country);
    if (!countryCode) {
      return Object.freeze({
        country,
        asOf: this.#nowUtc(),
        indicators: Object.freeze([]),
        stale: true,
        degraded: true,
        warnings: Object.freeze(['invalid country code']),
      });
    }
    const indicators: MacroIndicator[] = [];
    const warnings: string[] = [];
    let stale = false;
    const categoryIds = countryCode === 'SA'
      ? [CANONICAL_INDICATORS.SA_GDP, CANONICAL_INDICATORS.SA_POPULATION]
      : countryCode === 'US'
        ? [CANONICAL_INDICATORS.US_CPI, CANONICAL_INDICATORS.US_GDP, CANONICAL_INDICATORS.US_UNEMPLOYMENT]
        : [CANONICAL_INDICATORS.GLOBAL_GDP, CANONICAL_INDICATORS.GLOBAL_POPULATION];

    for (const indicatorId of categoryIds) {
      const result = await this.getIndicator(indicatorId, countryCode);
      if (result) {
        indicators.push(result.data);
        if (result.stale) {
          stale = true;
        }
        if (result.degraded) {
          warnings.push(...result.warnings);
        }
      } else {
        warnings.push(`no provider for ${indicatorId}`);
      }
    }

    return Object.freeze({
      country: countryCode,
      asOf: this.#nowUtc(),
      indicators: Object.freeze(indicators),
      stale,
      degraded: warnings.length > 0,
      warnings: Object.freeze(warnings),
    });
  }

  async getGlobalSnapshot(): Promise<MacroGlobalSnapshot> {
    const countries = await Promise.all([
      this.getCountrySnapshot('US'),
      this.getCountrySnapshot('SA'),
    ]);
    const warnings = countries.flatMap((snapshot) => [...snapshot.warnings]);
    return Object.freeze({
      asOf: this.#nowUtc(),
      countries: Object.freeze(countries),
      stale: countries.some((snapshot) => snapshot.stale),
      degraded: warnings.length > 0,
      warnings: Object.freeze(warnings),
    });
  }

  getIndicatorsByCategory(category: string): readonly CanonicalIndicatorId[] {
    return INDICATOR_CATEGORIES[category] ?? Object.freeze([]);
  }

  async getLatest(indicatorId: CanonicalIndicatorId, country?: string): Promise<MacroServiceResult<MacroIndicator> | undefined> {
    return this.getIndicator(indicatorId, country);
  }

  async getProviderCoverage(): Promise<readonly MacroProviderCoverage[]> {
    const registrations = this.#factory.resolve({ capability: 'macroeconomic_indicators', enabledOnly: true });
    const coverage: MacroProviderCoverage[] = [];
    for (const registration of registrations) {
      const adapter = this.#adapters.get(registration.descriptor.id);
      const health = adapter ? await adapter.healthCheck() : undefined;
      coverage.push(
        Object.freeze({
          providerId: registration.descriptor.id,
          indicators: Object.freeze(
            Object.values(CANONICAL_INDICATORS).filter(
              (canonicalId) => getProviderNativeId(canonicalId, registration.descriptor.id as Parameters<typeof getProviderNativeId>[1]) !== null,
            ),
          ),
          countries: Object.freeze(
            registration.descriptor.id === 'saudi-open-data'
              ? ['SA']
              : registration.descriptor.id === 'world-bank' || registration.descriptor.id === 'econdb'
                ? ['GLOBAL', 'US']
                : ['US'],
          ),
          capabilities: Object.freeze([...registration.descriptor.capabilities]),
          healthy: health?.state === 'healthy',
        }),
      );
    }
    return Object.freeze(coverage);
  }
}

export function createMacroDataService(input: {
  readonly bundles: readonly MacroProviderBundle[];
  readonly registry: ProviderRegistry;
  readonly nowUtc?: () => string;
}): MacroDataService {
  const adapters = new Map(input.bundles.map((bundle) => [bundle.providerId, bundle.adapter]));
  return new MacroDataService({
    registry: input.registry,
    adapters,
    ...(input.nowUtc ? { nowUtc: input.nowUtc } : {}),
  });
}

export type { ProviderRegistration, ExternalObservation };
