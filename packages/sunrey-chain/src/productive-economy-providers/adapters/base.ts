/**
 * Shared Wave 5 productive-economy adapter infrastructure.
 */

import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { asUtcInstant } from '../../../../domain/src/time.ts';
import {
  buildExternalObservation,
  type AuthorityClass,
  type ExternalObservation,
  type ProviderCategory,
  type ProviderResult,
} from '../../../../provider-sdk/src/index.ts';
import { cachePolicyFor } from '../cache-policies.ts';
import { assessFreshness, validateObservation } from '../data-quality.ts';
import { geographicIdentity, gridZoneForCountry } from '../geography.ts';
import { preserveNativeSource } from '../energy-source-taxonomy.ts';
import {
  identityUnitNormalization,
  normalizeCarbonIntensity,
  normalizeEnergyUnit,
  normalizePowerUnit,
  normalizePriceUnit,
} from '../units.ts';
import type { Wave5AdapterId } from '../catalog-entries.ts';
import type {
  EnergyObservation,
  EnergySourceType,
  GeographicIdentity,
  ResourceObservation,
  ResourceType,
} from '../types.ts';

const FIXTURES_DIR = join(dirname(fileURLToPath(import.meta.url)), 'fixtures');

export type Wave5AdapterContext = {
  readonly nowUtc: () => string;
  readonly simulationOnly: boolean;
  readonly providerDown?: boolean;
  readonly rateLimited?: boolean;
  readonly malformed?: boolean;
  readonly circuitOpen?: boolean;
};

export type Wave5Adapter = {
  readonly providerId: Wave5AdapterId;
  fetchEnergyObservations(): Promise<ProviderResult<readonly ExternalObservation<EnergyObservation>[]>>;
  fetchResourceObservations(): Promise<ProviderResult<readonly ExternalObservation<ResourceObservation>[]>>;
};

function loadFixture<T>(filename: string): T {
  return JSON.parse(readFileSync(join(FIXTURES_DIR, filename), 'utf8')) as T;
}

function guard(ctx: Wave5AdapterContext, providerId: string): string | null {
  if (ctx.circuitOpen) {
    return 'CIRCUIT_OPEN';
  }
  if (ctx.providerDown) {
    return 'PROVIDER_UNAVAILABLE';
  }
  if (ctx.rateLimited) {
    return 'RATE_LIMITED';
  }
  if (ctx.malformed) {
    return 'INVALID_PAYLOAD';
  }
  return null;
}

function buildEnergyObservation(input: {
  readonly providerId: string;
  readonly measurementKind: EnergyObservation['measurementKind'];
  readonly value: number;
  readonly unit: string;
  readonly energySource?: EnergySourceType | null;
  readonly providerNativeSource?: string | null;
  readonly geography: GeographicIdentity;
  readonly effectiveAt: string;
  readonly sourceTimestamp: string;
  readonly retrievedAt: string;
  readonly authorityClass: AuthorityClass;
  readonly capability: string;
  readonly currency?: string | null;
}): ExternalObservation<EnergyObservation> | null {
  const quality = validateObservation({
    value: input.value,
    unit: input.unit,
    sourceTimestamp: input.sourceTimestamp,
    retrievedAt: input.retrievedAt,
    allowNegative: input.measurementKind === 'IMPORT',
  });
  if (!quality.valid) {
    return null;
  }

  const policy = cachePolicyFor(input.capability);
  const freshness = assessFreshness(input.sourceTimestamp, input.retrievedAt, policy.ttlSeconds);

  let unitNorm;
  if (input.unit === 'gCO2/kWh' || input.unit === 'kgCO2/MWh') {
    const converted = normalizeCarbonIntensity(input.value, input.unit);
    unitNorm = converted.ok ? converted.normalization : identityUnitNormalization(input.value, input.unit);
  } else if (['Wh', 'kWh', 'MWh', 'GWh'].includes(input.unit)) {
    const converted = normalizeEnergyUnit(input.value, input.unit);
    unitNorm = converted.ok ? converted.normalization : identityUnitNormalization(input.value, input.unit);
  } else if (['W', 'kW', 'MW', 'GW'].includes(input.unit)) {
    const converted = normalizePowerUnit(input.value, input.unit);
    unitNorm = converted.ok ? converted.normalization : identityUnitNormalization(input.value, input.unit);
  } else {
    unitNorm = identityUnitNormalization(input.value, input.unit);
  }

  const observationId = `peo_${input.providerId}_${input.measurementKind}_${randomUUID().slice(0, 8)}`;
  const data: EnergyObservation = Object.freeze({
    schema: 'sunrey.energy-observation.v1',
    observationId,
    economicDomain: input.measurementKind === 'CARBON_INTENSITY' ? 'CARBON' : 'ELECTRICITY',
    measurementKind: input.measurementKind,
    energySource: input.energySource ?? null,
    providerNativeSource: input.providerNativeSource ?? null,
    geography: input.geography,
    value: input.value,
    unit: input.unit,
    currency: input.currency ?? null,
    effectiveAt: input.effectiveAt,
    sourceTimestamp: input.sourceTimestamp,
    retrievedAt: input.retrievedAt,
    providerId: input.providerId,
    freshness,
    confidence: 0.9,
    authorityClass: input.authorityClass,
    provenance: `${input.providerId}:${input.measurementKind}:${input.effectiveAt}`,
    unitNormalization: unitNorm,
    mintsMoonRey: false,
  });

  const built = buildExternalObservation({
    observationId,
    providerId: input.providerId,
    providerCategory: 'energy' as ProviderCategory,
    capability: input.capability,
    authorityClass: input.authorityClass,
    data,
    source: {
      provider: input.providerId,
      dataset: input.measurementKind,
      sourceUrl: null,
    },
    time: {
      retrievedAt: asUtcInstant(input.retrievedAt),
      sourceTimestamp: asUtcInstant(input.sourceTimestamp),
      effectiveAt: asUtcInstant(input.effectiveAt),
    },
    provenance: {
      requestId: `wave5-${input.providerId}`,
      rawPayload: JSON.stringify(data),
      providerSchemaVersion: 'wave5/1',
    },
  });
  return built.ok ? built.value : null;
}

function buildResourceObservation(input: {
  readonly providerId: string;
  readonly resourceType: ResourceType;
  readonly measurementType: ResourceObservation['measurementType'];
  readonly value: number;
  readonly unit: string;
  readonly currency?: string | null;
  readonly geography: GeographicIdentity;
  readonly effectiveAt: string;
  readonly sourceTimestamp: string;
  readonly retrievedAt: string;
  readonly authorityClass: AuthorityClass;
  readonly capability: string;
}): ExternalObservation<ResourceObservation> | null {
  const quality = validateObservation({
    value: input.value,
    unit: input.unit,
    sourceTimestamp: input.sourceTimestamp,
    retrievedAt: input.retrievedAt,
  });
  if (!quality.valid) {
    return null;
  }

  const policy = cachePolicyFor(input.capability);
  const freshness = assessFreshness(input.sourceTimestamp, input.retrievedAt, policy.ttlSeconds);
  const observationId = `res_${input.providerId}_${input.resourceType}_${randomUUID().slice(0, 8)}`;

  const data: ResourceObservation = Object.freeze({
    schema: 'sunrey.resource-observation.v1',
    observationId,
    resourceType: input.resourceType,
    measurementType: input.measurementType,
    geography: input.geography,
    value: input.value,
    unit: input.unit,
    currency: input.currency ?? null,
    effectiveAt: input.effectiveAt,
    sourceTimestamp: input.sourceTimestamp,
    retrievedAt: input.retrievedAt,
    providerId: input.providerId,
    freshness,
    confidence: 0.85,
    authorityClass: input.authorityClass,
    provenance: `${input.providerId}:${input.resourceType}:${input.effectiveAt}`,
    unitNormalization: input.currency
      ? normalizePriceUnit(input.value, input.unit, input.currency)
      : identityUnitNormalization(input.value, input.unit),
    mintsMoonRey: false,
  });

  const built = buildExternalObservation({
    observationId,
    providerId: input.providerId,
    providerCategory: 'natural_resources' as ProviderCategory,
    capability: input.capability,
    authorityClass: input.authorityClass,
    data,
    source: {
      provider: input.providerId,
      dataset: input.resourceType,
      sourceUrl: null,
    },
    time: {
      retrievedAt: asUtcInstant(input.retrievedAt),
      sourceTimestamp: asUtcInstant(input.sourceTimestamp),
      effectiveAt: asUtcInstant(input.effectiveAt),
    },
    provenance: {
      requestId: `wave5-${input.providerId}`,
      rawPayload: JSON.stringify(data),
      providerSchemaVersion: 'wave5/1',
    },
  });
  return built.ok ? built.value : null;
}

export function createNationalGridEsoAdapter(ctx: Wave5AdapterContext): Wave5Adapter {
  return Object.freeze({
    providerId: 'national-grid-eso',
    async fetchEnergyObservations() {
      const failure = guard(ctx, 'national-grid-eso');
      if (failure) {
        return { ok: false, code: failure, message: failure };
      }
      const retrievedAt = ctx.nowUtc();
      const fixture = loadFixture<{
        data: { fuelType: string; generation: number; unit: string; startTime: string }[];
        demand: { demand: number; unit: string; startTime: string };
      }>('national-grid-eso.json');
      const geo = geographicIdentity({ country: 'GB', gridZone: gridZoneForCountry('GB') });
      const observations: ExternalObservation<EnergyObservation>[] = [];

      for (const row of fixture.data) {
        const mapped = preserveNativeSource(row.fuelType);
        const obs = buildEnergyObservation({
          providerId: 'national-grid-eso',
          measurementKind: 'GENERATION',
          value: row.generation,
          unit: row.unit,
          energySource: mapped.canonical,
          providerNativeSource: mapped.native,
          geography: geo,
          effectiveAt: row.startTime,
          sourceTimestamp: row.startTime,
          retrievedAt,
          authorityClass: 'authoritative_official',
          capability: 'electricity_generation',
        });
        if (obs) {
          observations.push(obs);
        }
      }

      const demandObs = buildEnergyObservation({
        providerId: 'national-grid-eso',
        measurementKind: 'DEMAND',
        value: fixture.demand.demand,
        unit: fixture.demand.unit,
        geography: geo,
        effectiveAt: fixture.demand.startTime,
        sourceTimestamp: fixture.demand.startTime,
        retrievedAt,
        authorityClass: 'authoritative_official',
        capability: 'electricity_demand',
      });
      if (demandObs) {
        observations.push(demandObs);
      }

      return { ok: true, value: Object.freeze(observations) };
    },
    async fetchResourceObservations() {
      return { ok: true, value: Object.freeze([]) };
    },
  });
}

export function createUkCarbonIntensityAdapter(ctx: Wave5AdapterContext): Wave5Adapter {
  return Object.freeze({
    providerId: 'uk-carbon-intensity',
    async fetchEnergyObservations() {
      const failure = guard(ctx, 'uk-carbon-intensity');
      if (failure) {
        return { ok: false, code: failure, message: failure };
      }
      const retrievedAt = ctx.nowUtc();
      const fixture = loadFixture<{
        data: {
          from: string;
          intensity: { actual: number };
          generationmix: { fuel: string; perc: number }[];
        }[];
      }>('uk-carbon-intensity.json');
      const geo = geographicIdentity({ country: 'GB', gridZone: gridZoneForCountry('GB') });
      const observations: ExternalObservation<EnergyObservation>[] = [];
      const row = fixture.data[0]!;

      const carbonObs = buildEnergyObservation({
        providerId: 'uk-carbon-intensity',
        measurementKind: 'CARBON_INTENSITY',
        value: row.intensity.actual,
        unit: 'gCO2/kWh',
        geography: geo,
        effectiveAt: row.from,
        sourceTimestamp: row.from,
        retrievedAt,
        authorityClass: 'authoritative_official',
        capability: 'carbon_intensity',
      });
      if (carbonObs) {
        observations.push(carbonObs);
      }

      for (const mix of row.generationmix) {
        const mapped = preserveNativeSource(mix.fuel);
        const mixObs = buildEnergyObservation({
          providerId: 'uk-carbon-intensity',
          measurementKind: 'GENERATION_MIX',
          value: mix.perc,
          unit: 'percent',
          energySource: mapped.canonical,
          providerNativeSource: mapped.native,
          geography: geo,
          effectiveAt: row.from,
          sourceTimestamp: row.from,
          retrievedAt,
          authorityClass: 'authoritative_official',
          capability: 'energy_mix',
        });
        if (mixObs) {
          observations.push(mixObs);
        }
      }

      return { ok: true, value: Object.freeze(observations) };
    },
    async fetchResourceObservations() {
      return { ok: true, value: Object.freeze([]) };
    },
  });
}

export function createEnergiDataServiceAdapter(ctx: Wave5AdapterContext): Wave5Adapter {
  return Object.freeze({
    providerId: 'energi-data-service',
    async fetchEnergyObservations() {
      const failure = guard(ctx, 'energi-data-service');
      if (failure) {
        return { ok: false, code: failure, message: failure };
      }
      const retrievedAt = ctx.nowUtc();
      const fixture = loadFixture<{
        records: {
          HourUTC: string;
          SolarPower: number;
          WindPower: number;
          HydroPower: number;
          BiomassPower: number;
          Production: number;
          Consumption: number;
          unit: string;
        }[];
      }>('energi-data-service.json');
      const geo = geographicIdentity({ country: 'DK', gridZone: gridZoneForCountry('DK') });
      const observations: ExternalObservation<EnergyObservation>[] = [];
      const row = fixture.records[0]!;

      const sources: { kind: EnergySourceType; native: string; value: number }[] = [
        { kind: 'SOLAR', native: 'SolarPower', value: row.SolarPower },
        { kind: 'WIND', native: 'WindPower', value: row.WindPower },
        { kind: 'HYDRO', native: 'HydroPower', value: row.HydroPower },
        { kind: 'BIOMASS', native: 'BiomassPower', value: row.BiomassPower },
      ];

      for (const source of sources) {
        const obs = buildEnergyObservation({
          providerId: 'energi-data-service',
          measurementKind: 'GENERATION',
          value: source.value,
          unit: row.unit,
          energySource: source.kind,
          providerNativeSource: source.native,
          geography: geo,
          effectiveAt: row.HourUTC,
          sourceTimestamp: row.HourUTC,
          retrievedAt,
          authorityClass: 'authoritative_official',
          capability: 'electricity_generation',
        });
        if (obs) {
          observations.push(obs);
        }
      }

      const demandObs = buildEnergyObservation({
        providerId: 'energi-data-service',
        measurementKind: 'CONSUMPTION',
        value: row.Consumption,
        unit: row.unit,
        geography: geo,
        effectiveAt: row.HourUTC,
        sourceTimestamp: row.HourUTC,
        retrievedAt,
        authorityClass: 'authoritative_official',
        capability: 'electricity_demand',
      });
      if (demandObs) {
        observations.push(demandObs);
      }

      return { ok: true, value: Object.freeze(observations) };
    },
    async fetchResourceObservations() {
      return { ok: true, value: Object.freeze([]) };
    },
  });
}

export function createCo2OffsetAdapter(ctx: Wave5AdapterContext): Wave5Adapter {
  return Object.freeze({
    providerId: 'co2-offset',
    async fetchEnergyObservations() {
      return { ok: true, value: Object.freeze([]) };
    },
    async fetchResourceObservations() {
      const failure = guard(ctx, 'co2-offset');
      if (failure) {
        return { ok: false, code: failure, message: failure };
      }
      const retrievedAt = ctx.nowUtc();
      const fixture = loadFixture<{
        projects: { offsetTonnes: number; unit: string; verifiedAt: string; country: string }[];
      }>('co2-offset.json');
      const observations: ExternalObservation<ResourceObservation>[] = [];
      const project = fixture.projects[0]!;

      const obs = buildResourceObservation({
        providerId: 'co2-offset',
        resourceType: 'CARBON_OFFSET',
        measurementType: 'INVENTORY',
        value: project.offsetTonnes,
        unit: project.unit,
        geography: geographicIdentity({ country: project.country }),
        effectiveAt: project.verifiedAt,
        sourceTimestamp: project.verifiedAt,
        retrievedAt,
        authorityClass: 'community_data',
        capability: 'resource_data',
      });
      if (obs) {
        observations.push(obs);
      }

      return { ok: true, value: Object.freeze(observations) };
    },
  });
}

export function createWebsiteCarbonAdapter(ctx: Wave5AdapterContext): Wave5Adapter {
  return Object.freeze({
    providerId: 'website-carbon',
    async fetchEnergyObservations() {
      const failure = guard(ctx, 'website-carbon');
      if (failure) {
        return { ok: false, code: failure, message: failure };
      }
      const retrievedAt = ctx.nowUtc();
      const fixture = loadFixture<{
        statistics: { co2: { grid: { grams: number } }; renewable: number };
        timestamp: string;
      }>('website-carbon.json');
      const geo = geographicIdentity({ country: 'global' });
      const observations: ExternalObservation<EnergyObservation>[] = [];

      const obs = buildEnergyObservation({
        providerId: 'website-carbon',
        measurementKind: 'CARBON_INTENSITY',
        value: fixture.statistics.co2.grid.grams,
        unit: 'gCO2/kWh',
        geography: geo,
        effectiveAt: fixture.timestamp,
        sourceTimestamp: fixture.timestamp,
        retrievedAt,
        authorityClass: 'derived_data',
        capability: 'carbon_intensity',
      });
      if (obs) {
        observations.push(obs);
      }

      return { ok: true, value: Object.freeze(observations) };
    },
    async fetchResourceObservations() {
      return { ok: true, value: Object.freeze([]) };
    },
  });
}

const COMMODITY_MAP: Readonly<Record<string, ResourceType>> = Object.freeze({
  Wheat: 'WHEAT',
  Rice: 'RICE',
  Onion: 'OTHER',
  Corn: 'CORN',
  Soybean: 'SOYBEAN',
});

export function createIndianMandiPricesAdapter(ctx: Wave5AdapterContext): Wave5Adapter {
  return Object.freeze({
    providerId: 'indian-mandi-prices',
    async fetchEnergyObservations() {
      return { ok: true, value: Object.freeze([]) };
    },
    async fetchResourceObservations() {
      const failure = guard(ctx, 'indian-mandi-prices');
      if (failure) {
        return { ok: false, code: failure, message: failure };
      }
      const retrievedAt = ctx.nowUtc();
      const fixture = loadFixture<{
        records: {
          state: string;
          commodity: string;
          modal_price: number;
          unit: string;
          arrival_date: string;
        }[];
      }>('indian-mandi-prices.json');
      const observations: ExternalObservation<ResourceObservation>[] = [];

      for (const row of fixture.records) {
        const obs = buildResourceObservation({
          providerId: 'indian-mandi-prices',
          resourceType: COMMODITY_MAP[row.commodity] ?? 'OTHER',
          measurementType: 'PRICE',
          value: row.modal_price,
          unit: 'quintal',
          currency: 'INR',
          geography: geographicIdentity({ country: 'IN', region: row.state }),
          effectiveAt: row.arrival_date,
          sourceTimestamp: row.arrival_date,
          retrievedAt,
          authorityClass: 'authoritative_official',
          capability: 'agriculture_prices',
        });
        if (obs) {
          observations.push(obs);
        }
      }

      return { ok: true, value: Object.freeze(observations) };
    },
  });
}

export function createFredCommodityAdapter(ctx: Wave5AdapterContext): Wave5Adapter {
  return Object.freeze({
    providerId: 'fred-commodity',
    async fetchEnergyObservations() {
      const failure = guard(ctx, 'fred-commodity');
      if (failure) {
        return { ok: false, code: failure, message: failure };
      }
      const retrievedAt = ctx.nowUtc();
      const fixture = loadFixture<{
        series: { observations: { date: string; value: string }[] };
        units: string;
      }>('fred-commodity-oil.json');
      const latest = fixture.series.observations[0]!;
      const geo = geographicIdentity({ country: 'US' });
      const observations: ExternalObservation<EnergyObservation>[] = [];

      const priceObs = buildEnergyObservation({
        providerId: 'fred-commodity',
        measurementKind: 'PRICE',
        value: Number.parseFloat(latest.value),
        unit: 'USD/barrel',
        currency: 'USD',
        geography: geo,
        effectiveAt: latest.date,
        sourceTimestamp: latest.date,
        retrievedAt,
        authorityClass: 'authoritative_official',
        capability: 'energy_prices',
      });
      if (priceObs) {
        observations.push(priceObs);
      }

      return { ok: true, value: Object.freeze(observations) };
    },
    async fetchResourceObservations() {
      const failure = guard(ctx, 'fred-commodity');
      if (failure) {
        return { ok: false, code: failure, message: failure };
      }
      const retrievedAt = ctx.nowUtc();
      const fixture = loadFixture<{
        series: { observations: { date: string; value: string }[] };
      }>('fred-commodity-oil.json');
      const latest = fixture.series.observations[0]!;
      const geo = geographicIdentity({ country: 'US' });

      const obs = buildResourceObservation({
        providerId: 'fred-commodity',
        resourceType: 'OIL',
        measurementType: 'PRICE',
        value: Number.parseFloat(latest.value),
        unit: 'barrel',
        currency: 'USD',
        geography: geo,
        effectiveAt: latest.date,
        sourceTimestamp: latest.date,
        retrievedAt,
        authorityClass: 'authoritative_official',
        capability: 'commodity_prices',
      });

      return { ok: true, value: Object.freeze(obs ? [obs] : []) };
    },
  });
}

export function createWave5Adapter(providerId: Wave5AdapterId, ctx: Wave5AdapterContext): Wave5Adapter {
  switch (providerId) {
    case 'national-grid-eso':
      return createNationalGridEsoAdapter(ctx);
    case 'uk-carbon-intensity':
      return createUkCarbonIntensityAdapter(ctx);
    case 'energi-data-service':
      return createEnergiDataServiceAdapter(ctx);
    case 'co2-offset':
      return createCo2OffsetAdapter(ctx);
    case 'website-carbon':
      return createWebsiteCarbonAdapter(ctx);
    case 'indian-mandi-prices':
      return createIndianMandiPricesAdapter(ctx);
    case 'fred-commodity':
      return createFredCommodityAdapter(ctx);
    default: {
      const _exhaustive: never = providerId;
      throw new Error(`unknown wave5 adapter: ${_exhaustive}`);
    }
  }
}

export { buildEnergyObservation, buildResourceObservation, loadFixture, guard };
