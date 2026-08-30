/**
 * Consumer BFF adapter for World macroeconomic data.
 * Orchestration only — no provider credentials exposed to clients.
 *
 * Simulation responses are synchronous for BFF handler compatibility.
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  CANONICAL_INDICATORS,
  MACRO_CATALOG_PROVIDER_IDS,
  normalizeCountryCode,
  resolveCanonicalIndicatorId,
  type CanonicalIndicatorId,
} from '../../../../packages/sunrey-chain/src/macro/index.ts';

const FIXTURE_ROOT = join(dirname(fileURLToPath(import.meta.url)), '../../../../packages/sunrey-chain/src/macro/adapters/fixtures');

export type WorldEconomySurface = {
  readonly overview: () => unknown;
  readonly indicators: () => unknown;
  readonly country: (countryCode: string) => unknown;
  readonly series: (indicatorId: string, country?: string) => unknown;
  readonly coverage: () => unknown;
};

function loadFixture(name: string): unknown {
  return JSON.parse(readFileSync(join(FIXTURE_ROOT, name), 'utf8'));
}

function indicatorFromFixture(providerId: (typeof MACRO_CATALOG_PROVIDER_IDS)[number], nativeId: string, country: string) {
  const canonicalId = resolveCanonicalIndicatorId(providerId, nativeId);
  return Object.freeze({
    indicatorId: canonicalId ?? nativeId,
    providerNativeId: nativeId,
    name: nativeId,
    description: null,
    value: providerId === 'fred' ? 314.5 : providerId === 'world-bank' ? 2.1 : 1000,
    unit: providerId === 'fred' ? 'index_1982_1984=100' : providerId === 'world-bank' ? 'percent' : 'USD',
    frequency: 'monthly',
    country,
    region: null,
    currency: country === 'US' ? 'USD' : null,
    period: '2026-07',
    effectiveDate: '2026-07-01T00:00:00.000Z',
    releaseDate: '2026-08-15T00:00:00.000Z',
    revisionStatus: 'final',
    seasonalAdjustment: 'seasonally_adjusted',
    source: Object.freeze({
      provider: providerId,
      retrievedAt: '2026-08-30T12:00:00.000Z',
      sourceTimestamp: '2026-08-15T00:00:00.000Z',
      freshness: 'fresh',
    }),
  });
}

export function createWorldEconomySurface(): WorldEconomySurface {
  const fredFixture = loadFixture('fred-series.json');
  void fredFixture;

  return Object.freeze({
    overview() {
      return Object.freeze({
        schema: 'sunrey.consumer.world-economy.v1',
        mode: 'simulation',
        asOf: '2026-08-30T12:00:00.000Z',
        indicators: Object.freeze([
          indicatorFromFixture('fred', 'CPIAUCSL', 'US'),
          indicatorFromFixture('world-bank', 'NY.GDP.MKTP.KD.ZG', 'US'),
        ]),
        warnings: Object.freeze([]),
        degraded: false,
      });
    },

    indicators() {
      return Object.freeze({
        schema: 'sunrey.consumer.world-economy.v1',
        categories: Object.freeze({
          inflation: Object.freeze([indicatorFromFixture('fred', 'CPIAUCSL', 'US')]),
          employment: Object.freeze([indicatorFromFixture('fred', 'UNRATE', 'US')]),
          gdp: Object.freeze([
            indicatorFromFixture('fred', 'GDP', 'US'),
            indicatorFromFixture('world-bank', 'NY.GDP.MKTP.KD.ZG', 'US'),
          ]),
        }),
      });
    },

    country(countryCode: string) {
      const normalized = normalizeCountryCode(countryCode) ?? countryCode.toUpperCase();
      return Object.freeze({
        schema: 'sunrey.consumer.world-economy.v1',
        country: normalized,
        indicators: Object.freeze([
          indicatorFromFixture('fred', 'CPIAUCSL', normalized),
          indicatorFromFixture('world-bank', 'NY.GDP.MKTP.KD.ZG', normalized),
        ]),
        warnings: Object.freeze([]),
        degraded: false,
      });
    },

    series(indicatorId: string, country?: string) {
      const normalizedCountry = normalizeCountryCode(country ?? 'US') ?? 'US';
      const canonical = Object.values(CANONICAL_INDICATORS).includes(indicatorId as CanonicalIndicatorId)
        ? (indicatorId as CanonicalIndicatorId)
        : null;
      if (!canonical) {
        return Object.freeze({
          schema: 'sunrey.consumer.world-economy.v1',
          error: 'unknown_indicator',
          indicatorId,
        });
      }
      return Object.freeze({
        schema: 'sunrey.consumer.world-economy.v1',
        indicatorId: canonical,
        country: normalizedCountry,
        frequency: 'monthly',
        points: Object.freeze([
          Object.freeze({ period: '2026-05', value: 312.1, releaseDate: '2026-06-15T00:00:00.000Z' }),
          Object.freeze({ period: '2026-06', value: 313.2, releaseDate: '2026-07-15T00:00:00.000Z' }),
          Object.freeze({ period: '2026-07', value: 314.5, releaseDate: '2026-08-15T00:00:00.000Z' }),
        ]),
        source: Object.freeze({
          provider: 'fred',
          retrievedAt: '2026-08-30T12:00:00.000Z',
          sourceTimestamp: '2026-08-15T00:00:00.000Z',
          freshness: 'fresh',
        }),
        warnings: Object.freeze([]),
      });
    },

    coverage() {
      return Object.freeze({
        schema: 'sunrey.consumer.world-economy.v1',
        providers: Object.freeze(
          MACRO_CATALOG_PROVIDER_IDS.map((providerId) =>
            Object.freeze({
              providerId,
              healthy: true,
              capabilities: Object.freeze(['macroeconomic_indicators', 'economic_indicators']),
            }),
          ),
        ),
      });
    },
  });
}
