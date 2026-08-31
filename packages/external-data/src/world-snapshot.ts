/**
 * Canonical WorldSnapshot — partial-success aggregation over domain services.
 *
 * Domain-owned. No vendor-specific adapters on this surface.
 */

import type { ExternalDataPlane } from './plane.ts';
import {
  aggregateOverallState,
  buildSectionEnvelope,
  defaultDataStateForMode,
  sanitizeSourceFromObservation,
  type ProductDataState,
  type ProductSectionEnvelope,
  type SanitizedSourceMetadata,
} from './product-data-state.ts';
import { DATA_MODE } from '../../config/src/data-mode.ts';

export type WorldSnapshotSectionKey =
  | 'economy'
  | 'markets'
  | 'currencies'
  | 'crypto'
  | 'energy'
  | 'resources'
  | 'environment'
  | 'mobility'
  | 'innovation'
  | 'humanEconomy';

export type WorldSnapshot = {
  readonly schema: 'sunrey.world.snapshot.v1';
  readonly generatedAt: string;
  readonly overallStatus: ProductDataState;
  readonly dataMode: typeof DATA_MODE;
  readonly referenceOnly: true;
  readonly sections: Readonly<Record<WorldSnapshotSectionKey, ProductSectionEnvelope<unknown>>>;
};

type SectionBuildResult = {
  readonly key: WorldSnapshotSectionKey;
  readonly envelope: ProductSectionEnvelope<unknown>;
};

function firstSource(
  observations: readonly { readonly providerId: string }[],
  fallback: SanitizedSourceMetadata,
): SanitizedSourceMetadata {
  if (observations.length === 0) {
    return fallback;
  }
  return Object.freeze({
    displayName: providerDisplayName(observations[0]!.providerId),
    authorityClass: 'reference_data',
  });
}

function providerDisplayName(providerId: string): string {
  return providerId
    .split(/[-_]/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function buildEconomySection(plane: ExternalDataPlane, nowUtc: string): SectionBuildResult {
  const macro = plane.macro.getIndicators();
  const treasury = plane.macro.getTreasuryYields();
  const hasData = macro.observations.length > 0 || treasury.observations.length > 0;
  const source = macro.observations[0]
    ? sanitizeSourceFromObservation(macro.observations[0]!)
    : Object.freeze({ displayName: 'Macro Data', authorityClass: 'official_statistics' as const });
  return {
    key: 'economy',
    envelope: buildSectionEnvelope({
      status: defaultDataStateForMode(hasData),
      updatedAt: nowUtc,
      freshness: hasData ? 'current' : 'none',
      source,
      data: Object.freeze({
        macroIndicators: macro.observations.map((o) => ({
          seriesId: o.data.seriesId,
          value: o.data.value,
          unit: o.data.unit,
        })),
        treasuryYields: treasury.observations.map((o) => ({
          maturity: o.data.maturity,
          yieldPercent: o.data.yieldPercent,
        })),
      }),
    }),
  };
}

function buildMarketsSection(plane: ExternalDataPlane, nowUtc: string): SectionBuildResult {
  const quotes = plane.markets.getQuotes();
  const commodities = plane.markets.getCommodities();
  const hasData = quotes.observations.length > 0 || commodities.observations.length > 0;
  return {
    key: 'markets',
    envelope: buildSectionEnvelope({
      status: defaultDataStateForMode(hasData),
      updatedAt: nowUtc,
      freshness: hasData ? 'current' : 'none',
      source: firstSource(quotes.observations, Object.freeze({ displayName: 'Market Reference', authorityClass: 'market_data' })),
      data: Object.freeze({
        quotes: quotes.observations.map((o) => ({
          symbol: o.data.symbol,
          priceMinor: o.data.priceMinor.toString(),
        })),
        commodities: commodities.observations.map((o) => ({
          commodityId: o.data.commodityId,
          priceMinor: o.data.priceMinor.toString(),
          unit: o.data.unit,
        })),
      }),
    }),
  };
}

function buildCurrenciesSection(plane: ExternalDataPlane, nowUtc: string): SectionBuildResult {
  const fx = plane.fx.getRates();
  const hasData = fx.observations.length > 0;
  return {
    key: 'currencies',
    envelope: buildSectionEnvelope({
      status: defaultDataStateForMode(hasData),
      updatedAt: nowUtc,
      freshness: hasData ? 'current' : 'none',
      source: firstSource(fx.observations, Object.freeze({ displayName: 'FX Reference', authorityClass: 'reference_data' })),
      data: Object.freeze({
        rates: fx.observations.map((o) => ({
          pair: `${o.data.baseCurrency}/${o.data.quoteCurrency}`,
          rate: o.data.rate,
        })),
      }),
    }),
  };
}

function buildInnovationSection(plane: ExternalDataPlane, nowUtc: string): SectionBuildResult {
  const filings = plane.company.getLatestFilings(10);
  const regulatory = plane.company.getRegulatoryPublications();
  const hasData = filings.observations.length > 0 || regulatory.observations.length > 0;
  return {
    key: 'innovation',
    envelope: buildSectionEnvelope({
      status: defaultDataStateForMode(hasData),
      updatedAt: nowUtc,
      freshness: hasData ? 'current' : 'none',
      source: firstSource(filings.observations, Object.freeze({ displayName: 'Company Intelligence', authorityClass: 'reference_data' })),
      data: Object.freeze({
        filings: filings.observations.map((o) => ({
          companyName: o.data.companyName,
          formType: o.data.formType,
          filingDate: o.data.filingDate,
        })),
        regulatory: regulatory.observations.map((o) => ({
          title: o.data.title,
          agency: o.data.agency,
        })),
      }),
    }),
  };
}

function buildHumanEconomySection(plane: ExternalDataPlane, nowUtc: string): SectionBuildResult {
  const fiscal = plane.macro.getFiscalBalances();
  const hasData = fiscal.observations.length > 0;
  return {
    key: 'humanEconomy',
    envelope: buildSectionEnvelope({
      status: defaultDataStateForMode(hasData),
      updatedAt: nowUtc,
      freshness: hasData ? 'current' : 'none',
      source: Object.freeze({ displayName: 'Fiscal Reference', authorityClass: 'official_statistics' }),
      data: Object.freeze({
        fiscal: fiscal.observations.map((o) => ({
          period: o.data.period,
          balanceMinor: o.data.balanceMinor?.toString() ?? '0',
        })),
      }),
    }),
  };
}

async function buildEnergySection(plane: ExternalDataPlane, nowUtc: string): Promise<SectionBuildResult> {
  try {
    const energy = await plane.productiveEconomy.getEnergyObservations();
    const hasData = energy.length > 0;
    return {
      key: 'energy',
      envelope: buildSectionEnvelope({
        status: defaultDataStateForMode(hasData),
        updatedAt: nowUtc,
        freshness: hasData ? 'current' : 'none',
        source: energy[0]
          ? sanitizeSourceFromObservation(energy[0]!)
          : Object.freeze({ displayName: 'Energy Oracle', authorityClass: 'reference_data' }),
        data: Object.freeze(
          energy.map((o) => ({
            measurementKind: o.data.measurementKind,
            value: o.data.value,
            unit: o.data.unit,
            geography: o.data.geography.country,
          })),
        ),
      }),
    };
  } catch {
    return {
      key: 'energy',
      envelope: buildSectionEnvelope({
        status: 'UNAVAILABLE',
        updatedAt: nowUtc,
        freshness: 'none',
        source: null,
        data: null,
        reason: 'energy observations unavailable',
      }),
    };
  }
}

const RESOURCE_CATALOG = Object.freeze([
  'gold',
  'silver',
  'copper',
  'lithium',
  'water',
  'hydrogen',
  'energy',
] as const);

async function buildResourcesSection(plane: ExternalDataPlane, nowUtc: string): Promise<SectionBuildResult> {
  try {
    const [observations, availability] = await Promise.all([
      plane.productiveEconomy.getResourceObservations(),
      Promise.resolve(plane.productiveEconomy.runtime.index.resources.resourceAvailability()),
    ]);
    const byType = new Map(observations.map((o) => [o.data.resourceType.toLowerCase(), o]));
    const items = RESOURCE_CATALOG.map((resourceType) => {
      const obs = byType.get(resourceType);
      const avail = availability.find((a) => a.resourceType.toLowerCase() === resourceType);
      if (!obs && (!avail || avail.status === 'NO_ELIGIBLE_LIVE_SOURCE')) {
        return Object.freeze({
          resourceType,
          status: 'UNAVAILABLE' as const,
          value: null,
          unit: null,
        });
      }
      if (!obs) {
        return Object.freeze({
          resourceType,
          status: 'UNAVAILABLE' as const,
          value: null,
          unit: null,
        });
      }
      return Object.freeze({
        resourceType,
        status: defaultDataStateForMode(true),
        value: obs.data.value,
        unit: obs.data.unit,
      });
    });
    const hasAny = items.some((i) => i.status !== 'UNAVAILABLE');
    return {
      key: 'resources',
      envelope: buildSectionEnvelope({
        status: hasAny ? (items.some((i) => i.status === 'UNAVAILABLE') ? 'PARTIAL' : defaultDataStateForMode(true)) : 'UNAVAILABLE',
        updatedAt: nowUtc,
        freshness: hasAny ? 'mixed' : 'none',
        source: observations[0]
          ? sanitizeSourceFromObservation(observations[0]!)
          : Object.freeze({ displayName: 'Resource Oracle', authorityClass: 'reference_data' }),
        data: Object.freeze({ resources: items }),
      }),
    };
  } catch {
    return {
      key: 'resources',
      envelope: buildSectionEnvelope({
        status: 'UNAVAILABLE',
        updatedAt: nowUtc,
        freshness: 'none',
        source: null,
        data: null,
        reason: 'resource observations unavailable',
      }),
    };
  }
}

function buildCryptoSection(nowUtc: string): SectionBuildResult {
  return {
    key: 'crypto',
    envelope: buildSectionEnvelope({
      status: 'SIMULATED',
      updatedAt: nowUtc,
      freshness: 'current',
      source: Object.freeze({ displayName: 'Crypto Market Reference', authorityClass: 'market_data' }),
      data: Object.freeze({
        note: 'Crypto reference available via /api/v1/markets/crypto and /api/v1/blockchain/market-quotes',
        referenceRoutes: Object.freeze(['/api/v1/markets/crypto', '/api/v1/blockchain/market-quotes']),
      }),
    }),
  };
}

function buildEnvironmentSection(nowUtc: string): SectionBuildResult {
  return {
    key: 'environment',
    envelope: buildSectionEnvelope({
      status: 'SIMULATED',
      updatedAt: nowUtc,
      freshness: 'current',
      source: Object.freeze({ displayName: 'Environmental Oracle', authorityClass: 'reference_data' }),
      data: Object.freeze({
        note: 'Environmental observations available via /api/v1/world/environmental',
        referenceRoutes: Object.freeze(['/api/v1/world/environmental']),
      }),
    }),
  };
}

function buildMobilitySection(nowUtc: string): SectionBuildResult {
  return {
    key: 'mobility',
    envelope: buildSectionEnvelope({
      status: 'SIMULATED',
      updatedAt: nowUtc,
      freshness: 'current',
      source: Object.freeze({ displayName: 'Travel Intelligence', authorityClass: 'reference_data' }),
      data: Object.freeze({
        note: 'Mobility and travel context available via /api/v1/travel/overview',
        referenceRoutes: Object.freeze(['/api/v1/travel/overview', '/api/v1/environmental/travel-context']),
      }),
    }),
  };
}

export async function buildWorldSnapshot(
  plane: ExternalDataPlane,
  options?: { readonly nowUtc?: string },
): Promise<WorldSnapshot> {
  const nowUtc = options?.nowUtc ?? plane.adapterContext().nowUtc;
  const syncSections = [
    buildEconomySection(plane, nowUtc),
    buildMarketsSection(plane, nowUtc),
    buildCurrenciesSection(plane, nowUtc),
    buildInnovationSection(plane, nowUtc),
    buildHumanEconomySection(plane, nowUtc),
    buildCryptoSection(nowUtc),
    buildEnvironmentSection(nowUtc),
    buildMobilitySection(nowUtc),
  ];
  const asyncResults = await Promise.allSettled([
    buildEnergySection(plane, nowUtc),
    buildResourcesSection(plane, nowUtc),
  ]);
  const asyncSections: SectionBuildResult[] = asyncResults.map((result, index) => {
    if (result.status === 'fulfilled') {
      return result.value;
    }
    const key = index === 0 ? 'energy' : 'resources';
    return {
      key,
      envelope: buildSectionEnvelope({
        status: 'UNAVAILABLE',
        updatedAt: nowUtc,
        freshness: 'none',
        source: null,
        data: null,
        reason: `${key} section failed`,
      }),
    };
  });
  const allSections = [...syncSections, ...asyncSections];
  const sections = Object.freeze(
    allSections.reduce(
      (acc, section) => {
        acc[section.key] = section.envelope;
        return acc;
      },
      {} as Record<WorldSnapshotSectionKey, ProductSectionEnvelope<unknown>>,
    ),
  );
  return Object.freeze({
    schema: 'sunrey.world.snapshot.v1',
    generatedAt: nowUtc,
    overallStatus: aggregateOverallState(allSections.map((s) => s.envelope.status)),
    dataMode: DATA_MODE,
    referenceOnly: true,
    sections,
  });
}
