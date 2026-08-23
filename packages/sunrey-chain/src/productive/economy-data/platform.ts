/**
 * Canonical Productive Economy Data Platform.
 *
 * Ingests, verifies, normalizes, and aggregates approved economic
 * observations. Does not mint MoonRey and does not set Exchange price.
 */

import { aggregateObservations, type ProductiveAggregate } from './aggregation.ts';
import { SANDBOX_DRAFTS, SANDBOX_NOW_UTC, SANDBOX_RESOURCES, sandboxMethodologies, seedSandboxResources } from './fixtures.ts';
import { ingestObservation } from './ingestion.ts';
import { proposeMoonReyIssuanceFromObservations, separateEconomyPlanes } from './issuance-interface.ts';
import { derivePublicMetric } from './licensing.ts';
import { ProductiveValueMethodologyRegistry, canonicalGpuvProductization } from './methodology.ts';
import { ProductiveAssetRegistry } from './registry.ts';
import type {
  EconomicObservation,
  ProductiveEconomyCategory,
  ProductiveResourceRecord,
  ProductiveValueMethodology,
} from './types.ts';

export class ProductiveEconomyDataPlatform {
  readonly productionActive = false as const;
  readonly liveProviderConnected = false as const;
  readonly resources = new ProductiveAssetRegistry();
  readonly methodologies = new ProductiveValueMethodologyRegistry();
  readonly #observations: EconomicObservation[] = [];

  constructor() {
    seedSandboxResources(this.resources);
    for (const methodology of sandboxMethodologies()) {
      this.methodologies.register(methodology);
    }
  }

  ingestSandbox(): this {
    const energyPeersWh = [120_000_000n, 118_000_000n];
    this.ingest(SANDBOX_DRAFTS.energyA, { independentSourceCount: 2, peerValues: energyPeersWh });
    this.ingest(SANDBOX_DRAFTS.energyB, { independentSourceCount: 2, peerValues: energyPeersWh });
    this.ingest(SANDBOX_DRAFTS.compute);
    this.ingest(SANDBOX_DRAFTS.manufacturing);
    this.ingest(SANDBOX_DRAFTS.agriculture);
    this.ingest(SANDBOX_DRAFTS.logistics);
    this.ingest(SANDBOX_DRAFTS.stale);
    this.ingest(SANDBOX_DRAFTS.conflicting, {
      independentSourceCount: 2,
      peerValues: [...energyPeersWh, 9_000_000_000n],
    });
    this.ingest(SANDBOX_DRAFTS.outlier, {
      independentSourceCount: 2,
      peerValues: [...energyPeersWh, 50_000_000_000n],
    });
    this.ingest(SANDBOX_DRAFTS.missingSource);
    this.ingest(SANDBOX_DRAFTS.invalidProvenance);
    this.ingest(SANDBOX_DRAFTS.unlabeled);
    this.ingest(SANDBOX_DRAFTS.restrictedLicense);
    return this;
  }

  ingest(
    draft: Parameters<typeof ingestObservation>[0],
    extras?: { readonly independentSourceCount?: number; readonly peerValues?: readonly bigint[] },
  ) {
    const resource = this.resources.get(draft.resourceId);
    if (!resource) {
      return { ok: false as const, code: 'RESOURCE_UNKNOWN', message: 'resource is not registered' };
    }
    const result = ingestObservation(draft, {
      nowUtc: SANDBOX_NOW_UTC,
      resource,
      independentSourceCount: extras?.independentSourceCount ?? 1,
      peerValues: extras?.peerValues,
    });
    if (result.ok) {
      this.#observations.push(result.value);
    }
    return result;
  }

  observations(category?: ProductiveEconomyCategory): readonly EconomicObservation[] {
    return category ? this.#observations.filter((row) => row.category === category) : [...this.#observations];
  }

  resource(resourceId: string): ProductiveResourceRecord | undefined {
    return this.resources.get(resourceId);
  }

  aggregates(): readonly ProductiveAggregate[] {
    return aggregateObservations(this.#observations, SANDBOX_NOW_UTC);
  }

  gpuv() {
    return canonicalGpuvProductization();
  }

  methodology(category: ProductiveEconomyCategory): ProductiveValueMethodology | undefined {
    return this.methodologies.list(category)[0];
  }

  publicMetrics() {
    return this.#observations
      .filter((row) => row.status === 'VERIFIED')
      .map((row) => derivePublicMetric(row));
  }

  issuanceFromObservations() {
    const methodology = this.methodology('ENERGY') ?? sandboxMethodologies()[0]!;
    return proposeMoonReyIssuanceFromObservations({
      observations: this.observations('ENERGY'),
      methodology,
    });
  }

  separation() {
    const verifiedEnergy = this.observations('ENERGY').filter((row) => row.verification === 'MULTI_SOURCE_CORROBORATED');
    const gpuvInput = verifiedEnergy.reduce((sum, row) => sum + row.canonicalValue, 0n);
    return separateEconomyPlanes({ gpuvInput });
  }

  sandboxResources() {
    return SANDBOX_RESOURCES;
  }
}

export function createProductiveEconomyDataPlatform(): ProductiveEconomyDataPlatform {
  return new ProductiveEconomyDataPlatform().ingestSandbox();
}
