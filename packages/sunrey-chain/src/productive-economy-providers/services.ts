/**
 * Wave 5 productive-economy domain services.
 */

import type { ExternalObservation } from '../../../provider-sdk/src/index.ts';
import { WAVE5_ADAPTER_IDS } from './catalog-entries.ts';
import { createWave5Adapter, type Wave5Adapter, type Wave5AdapterContext } from './adapters/base.ts';
import { ingestEnergyObservationsToPeg, ingestResourceObservationsToPeg } from './peg-ingestion.ts';
import type {
  EnergyObservation,
  ProductiveEconomicObservation,
  ResourceAvailability,
  ResourceObservation,
  ResourceType,
} from './types.ts';

export type ServiceResult<T> = {
  readonly observations: readonly ExternalObservation<T>[];
  readonly degraded: boolean;
  readonly providersUsed: readonly string[];
};

function summarize<T>(observations: readonly ExternalObservation<T>[], providers: readonly string[]): ServiceResult<T> {
  return Object.freeze({
    observations,
    degraded: observations.length === 0,
    providersUsed: Object.freeze([...new Set(providers)]),
  });
}

export class EnergyObservationService {
  readonly #adapters: ReadonlyMap<string, Wave5Adapter>;

  constructor(ctx?: Wave5AdapterContext) {
    const context = ctx ?? { nowUtc: () => new Date().toISOString(), simulationOnly: true };
    const adapters = new Map<string, Wave5Adapter>();
    for (const id of WAVE5_ADAPTER_IDS) {
      adapters.set(id, createWave5Adapter(id, context));
    }
    this.#adapters = adapters;
  }

  async getEnergyObservations(): Promise<ServiceResult<EnergyObservation>> {
    const all: ExternalObservation<EnergyObservation>[] = [];
    const used: string[] = [];
    for (const [id, adapter] of this.#adapters) {
      const result = await adapter.fetchEnergyObservations();
      if (result.ok) {
        all.push(...result.value);
        if (result.value.length > 0) {
          used.push(id);
        }
      }
    }
    return summarize(all, used);
  }

  async getCarbonIntensity(): Promise<ServiceResult<EnergyObservation>> {
    const all = await this.getEnergyObservations();
    const filtered = all.observations.filter((o) => o.data.measurementKind === 'CARBON_INTENSITY');
    return summarize(filtered, all.providersUsed);
  }

  async getElectricityDemand(): Promise<ServiceResult<EnergyObservation>> {
    const all = await this.getEnergyObservations();
    const filtered = all.observations.filter(
      (o) => o.data.measurementKind === 'DEMAND' || o.data.measurementKind === 'CONSUMPTION',
    );
    return summarize(filtered, all.providersUsed);
  }

  async getElectricityGeneration(): Promise<ServiceResult<EnergyObservation>> {
    const all = await this.getEnergyObservations();
    const filtered = all.observations.filter(
      (o) => o.data.measurementKind === 'GENERATION' || o.data.measurementKind === 'GENERATION_MIX',
    );
    return summarize(filtered, all.providersUsed);
  }

  async pegProjection() {
    const result = await this.getEnergyObservations();
    return ingestEnergyObservationsToPeg(result.observations);
  }
}

export class ResourceObservationService {
  readonly #adapters: ReadonlyMap<string, Wave5Adapter>;

  constructor(ctx?: Wave5AdapterContext) {
    const context = ctx ?? { nowUtc: () => new Date().toISOString(), simulationOnly: true };
    const adapters = new Map<string, Wave5Adapter>();
    for (const id of WAVE5_ADAPTER_IDS) {
      adapters.set(id, createWave5Adapter(id, context));
    }
    this.#adapters = adapters;
  }

  async getResourceObservations(): Promise<ServiceResult<ResourceObservation>> {
    const all: ExternalObservation<ResourceObservation>[] = [];
    const used: string[] = [];
    for (const [id, adapter] of this.#adapters) {
      const result = await adapter.fetchResourceObservations();
      if (result.ok) {
        all.push(...result.value);
        if (result.value.length > 0) {
          used.push(id);
        }
      }
    }
    return summarize(all, used);
  }

  pegProjection(observations: readonly ExternalObservation<ResourceObservation>[]) {
    return ingestResourceObservationsToPeg(observations);
  }

  resourceAvailability(): readonly ResourceAvailability[] {
    const catalog: { type: ResourceType; providers: string[] }[] = [
      { type: 'OIL', providers: ['fred-commodity'] },
      { type: 'WHEAT', providers: ['indian-mandi-prices'] },
      { type: 'GOLD', providers: [] },
      { type: 'SILVER', providers: [] },
      { type: 'COPPER', providers: [] },
      { type: 'LITHIUM', providers: [] },
      { type: 'WATER', providers: [] },
      { type: 'HYDROGEN', providers: [] },
      { type: 'NATURAL_GAS', providers: [] },
    ];

    return Object.freeze(
      catalog.map((row) =>
        Object.freeze({
          resourceType: row.type,
          status: row.providers.length > 0 ? ('AVAILABLE' as const) : ('NO_ELIGIBLE_LIVE_SOURCE' as const),
          providerId: row.providers[0] ?? null,
          notes:
            row.providers.length > 0
              ? `Available via ${row.providers.join(', ')} in simulation.`
              : 'No eligible free provider in Wave 5 catalog.',
        }),
      ),
    );
  }
}

export class ProductiveEconomicIndexFoundation {
  readonly energy: EnergyObservationService;
  readonly resources: ResourceObservationService;

  constructor(ctx?: Wave5AdapterContext) {
    this.energy = new EnergyObservationService(ctx);
    this.resources = new ResourceObservationService(ctx);
  }

  async energyIndexInputs() {
    const [generation, demand, carbon, prices] = await Promise.all([
      this.energy.getElectricityGeneration(),
      this.energy.getElectricityDemand(),
      this.energy.getCarbonIntensity(),
      this.energy.getEnergyObservations().then((r) =>
        summarize(
          r.observations.filter((o) => o.data.measurementKind === 'PRICE'),
          r.providersUsed,
        ),
      ),
    ]);
    return Object.freeze({
      schema: 'sunrey.energy-index.foundation.v1' as const,
      generation: generation.observations,
      consumption: demand.observations,
      carbonIntensity: carbon.observations,
      prices: prices.observations,
      formulaNotDefined: true as const,
      observationsIndependentlyTraceable: true as const,
    });
  }

  async resourceIndexInputs() {
    const resources = await this.resources.getResourceObservations();
    return Object.freeze({
      schema: 'sunrey.resource-index.foundation.v1' as const,
      observations: resources.observations,
      availability: this.resources.resourceAvailability(),
      formulaNotDefined: true as const,
      observationsIndependentlyTraceable: true as const,
    });
  }

  async toProductiveEconomicObservations(): Promise<readonly ProductiveEconomicObservation[]> {
    const [energy, resources] = await Promise.all([
      this.energy.getEnergyObservations(),
      this.resources.getResourceObservations(),
    ]);
    const result: ProductiveEconomicObservation[] = [];

    for (const obs of energy.observations) {
      result.push(
        Object.freeze({
          schema: 'sunrey.productive-economic-observation.v1',
          observationId: obs.data.observationId,
          economicDomain: obs.data.economicDomain === 'CARBON' ? 'CARBON' : 'ELECTRICITY',
          resourceType: null,
          assetId: obs.data.geography.gridZone,
          geography: obs.data.geography,
          jurisdiction: obs.data.geography.country,
          value: obs.data.value,
          unit: obs.data.unit,
          currency: obs.data.currency,
          effectiveAt: obs.data.effectiveAt,
          sourceTimestamp: obs.data.sourceTimestamp,
          retrievedAt: obs.data.retrievedAt,
          providerId: obs.data.providerId,
          freshness: obs.data.freshness,
          confidence: obs.data.confidence,
          authorityClass: obs.data.authorityClass,
          provenance: obs.data.provenance,
          unitNormalization: obs.data.unitNormalization,
          mintsMoonRey: false,
          issuanceAuthority: false,
        }),
      );
    }

    for (const obs of resources.observations) {
      result.push(
        Object.freeze({
          schema: 'sunrey.productive-economic-observation.v1',
          observationId: obs.data.observationId,
          economicDomain: 'RESOURCE',
          resourceType: obs.data.resourceType,
          assetId: obs.data.resourceType,
          geography: obs.data.geography,
          jurisdiction: obs.data.geography.country,
          value: obs.data.value,
          unit: obs.data.unit,
          currency: obs.data.currency,
          effectiveAt: obs.data.effectiveAt,
          sourceTimestamp: obs.data.sourceTimestamp,
          retrievedAt: obs.data.retrievedAt,
          providerId: obs.data.providerId,
          freshness: obs.data.freshness,
          confidence: obs.data.confidence,
          authorityClass: obs.data.authorityClass,
          provenance: obs.data.provenance,
          unitNormalization: obs.data.unitNormalization,
          mintsMoonRey: false,
          issuanceAuthority: false,
        }),
      );
    }

    return Object.freeze(result);
  }
}

export function createProductiveEconomyServices(ctx?: Wave5AdapterContext) {
  const index = new ProductiveEconomicIndexFoundation(ctx);
  return Object.freeze({
    energy: index.energy,
    resources: index.resources,
    index,
  });
}
