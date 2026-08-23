/**
 * Client-safe SunRey Economy resources.
 * Only expose data backed by configured sandbox sources. Do not fabricate globals.
 */

import type { UtcInstant } from '../../../domain/src/time.ts';
import { MARKET_DATA_CLIENT_STATUSES, type MarketDataClientStatus } from './taxonomy.ts';

export const PRODUCTIVE_ECONOMY_CATEGORIES = [
  'energy',
  'compute',
  'manufacturing',
  'resources',
  'food_agriculture',
  'real_estate',
  'logistics',
  'bandwidth',
  'goods_service_delivery',
] as const;
export type ProductiveEconomyCategory = (typeof PRODUCTIVE_ECONOMY_CATEGORIES)[number];

export type EconomyMetric = {
  readonly metricId: string;
  readonly label: string;
  readonly category: string;
  readonly value: string | null;
  readonly unit: string | null;
  readonly source: string;
  readonly timestampUtc: string;
  readonly freshness: MarketDataClientStatus;
  readonly provenance: string;
  readonly configured: boolean;
  readonly globalValueFabricated: false;
};

export type EconomyView = {
  readonly schema: string;
  readonly asset: 'SUNREY_COIN' | 'MOONREY_COIN';
  readonly generatedAt: UtcInstant;
  readonly productionEconomics: false;
  readonly metrics: readonly EconomyMetric[];
  readonly omittedUnconfiguredCategories: readonly string[];
};

function metric(input: {
  readonly metricId: string;
  readonly label: string;
  readonly category: string;
  readonly value: string | null;
  readonly unit: string | null;
  readonly source: string;
  readonly timestampUtc: string;
  readonly freshness: MarketDataClientStatus;
  readonly provenance: string;
  readonly configured: boolean;
}): EconomyMetric {
  return Object.freeze({
    ...input,
    globalValueFabricated: false,
  });
}

export function sunreyCoinEconomyView(now: UtcInstant): EconomyView {
  return Object.freeze({
    schema: 'sunrey.consumer.economy.sunrey-coin.v1',
    asset: 'SUNREY_COIN',
    generatedAt: now,
    productionEconomics: false,
    metrics: Object.freeze([
      metric({
        metricId: 'hin.contribution.verified.count',
        label: 'Verified Human Information contributions (sandbox fixture)',
        category: 'human_information_network',
        value: '12',
        unit: 'count',
        source: 'packages/information-market sandbox fixture',
        timestampUtc: now,
        freshness: 'SANDBOX',
        provenance: 'Configured HIN contribution adapter fixture. Not a global HIN census.',
        configured: true,
      }),
      metric({
        metricId: 'hin.economic.input.labeled',
        label: 'Labeled economic inputs (sandbox)',
        category: 'human_information_network',
        value: '4',
        unit: 'classes',
        source: 'packages/human-economic-contribution ontology fixture',
        timestampUtc: now,
        freshness: 'SANDBOX',
        provenance: 'Ontology class count from the configured simulation catalog.',
        configured: true,
      }),
    ]),
    omittedUnconfiguredCategories: Object.freeze(['global_gdp', 'world_population', 'live_hin_volume']),
  });
}

export function moonreyCoinEconomyView(now: UtcInstant, configured: readonly ProductiveEconomyCategory[]): EconomyView {
  const all = PRODUCTIVE_ECONOMY_CATEGORIES;
  const metrics: EconomyMetric[] = [];
  for (const category of configured) {
    metrics.push(
      metric({
        metricId: `moonrey.productive.${category}.fixture`,
        label: `${category} productive observation (sandbox)`,
        category,
        value: category === 'energy' ? '100' : category === 'compute' ? '8' : '1',
        unit: category === 'energy' ? 'facility_hour' : category === 'compute' ? 'gpu_hour' : 'observation',
        source: `packages/sunrey-chain oracle production fixture/${category}`,
        timestampUtc: now,
        freshness: 'SANDBOX',
        provenance: 'Configured productive-economy fixture. Production valuation remains inactive.',
        configured: true,
      }),
    );
  }
  return Object.freeze({
    schema: 'sunrey.consumer.economy.moonrey-coin.v1',
    asset: 'MOONREY_COIN',
    generatedAt: now,
    productionEconomics: false,
    metrics: Object.freeze(metrics),
    omittedUnconfiguredCategories: Object.freeze(all.filter((row) => !configured.includes(row))),
  });
}

export function marketDataClientStatus(input: {
  readonly sourceKind: 'SANDBOX_FIXTURE' | 'EXTERNAL' | 'NONE';
  readonly ageMs: number;
  readonly available: boolean;
  readonly delayed: boolean;
}): MarketDataClientStatus {
  if (!input.available || input.sourceKind === 'NONE') {
    return 'UNAVAILABLE';
  }
  if (input.sourceKind === 'SANDBOX_FIXTURE') {
    return input.ageMs > 60_000 ? 'STALE' : 'SANDBOX';
  }
  if (input.ageMs > 60_000) {
    return 'STALE';
  }
  if (input.delayed) {
    return 'DELAYED';
  }
  return 'LIVE';
}

export function assertClientStatusVocabulary(): readonly MarketDataClientStatus[] {
  return MARKET_DATA_CLIENT_STATUSES;
}
