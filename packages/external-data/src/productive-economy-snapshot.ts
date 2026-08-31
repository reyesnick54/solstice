/**
 * ProductiveEconomySnapshot — MoonRey analytics aggregation only.
 *
 * Observations are economic inputs. Does not mint, issue, or set exchange price.
 */

import type { ExternalDataPlane } from './plane.ts';
import {
  aggregateOverallState,
  buildSectionEnvelope,
  defaultDataStateForMode,
  sanitizeSourceFromObservation,
  type ProductDataState,
  type ProductSectionEnvelope,
} from './product-data-state.ts';
import { DATA_MODE } from '../../config/src/data-mode.ts';

export type ProductiveEconomySnapshot = {
  readonly schema: 'sunrey.productive-economy.snapshot.v1';
  readonly generatedAt: string;
  readonly overallStatus: ProductDataState;
  readonly dataMode: typeof DATA_MODE;
  readonly analyticsOnly: true;
  readonly issuanceAuthority: false;
  readonly sections: Readonly<{
    readonly energy: ProductSectionEnvelope<unknown>;
    readonly resources: ProductSectionEnvelope<unknown>;
    readonly logistics: ProductSectionEnvelope<unknown>;
    readonly environment: ProductSectionEnvelope<unknown>;
    readonly compute: ProductSectionEnvelope<unknown>;
  }>;
};

export async function buildProductiveEconomySnapshot(
  plane: ExternalDataPlane,
  options?: { readonly nowUtc?: string },
): Promise<ProductiveEconomySnapshot> {
  const nowUtc = options?.nowUtc ?? plane.adapterContext().nowUtc;

  const [energyResult, resourcesResult, productiveResult] = await Promise.allSettled([
    plane.productiveEconomy.getEnergyObservations(),
    plane.productiveEconomy.getResourceObservations(),
    plane.productiveEconomy.getProductiveEconomicObservations(),
  ]);

  const energy =
    energyResult.status === 'fulfilled'
      ? buildSectionEnvelope({
          status: defaultDataStateForMode(energyResult.value.length > 0),
          updatedAt: nowUtc,
          freshness: energyResult.value.length > 0 ? 'current' : 'none',
          source: energyResult.value[0]
            ? sanitizeSourceFromObservation(energyResult.value[0]!)
            : Object.freeze({ displayName: 'Energy Oracle', authorityClass: 'reference_data' }),
          data: Object.freeze(
            energyResult.value.map((o) => ({
              measurementKind: o.data.measurementKind,
              value: o.data.value,
              unit: o.data.unit,
              geography: o.data.geography.country,
            })),
          ),
        })
      : buildSectionEnvelope({
          status: 'UNAVAILABLE',
          updatedAt: nowUtc,
          freshness: 'none',
          source: null,
          data: null,
          reason: 'energy observations unavailable',
        });

  const resources =
    resourcesResult.status === 'fulfilled'
      ? buildSectionEnvelope({
          status: defaultDataStateForMode(resourcesResult.value.length > 0),
          updatedAt: nowUtc,
          freshness: resourcesResult.value.length > 0 ? 'current' : 'none',
          source: resourcesResult.value[0]
            ? sanitizeSourceFromObservation(resourcesResult.value[0]!)
            : Object.freeze({ displayName: 'Resource Oracle', authorityClass: 'reference_data' }),
          data: Object.freeze(
            resourcesResult.value.map((o) => ({
              resourceType: o.data.resourceType,
              measurementType: o.data.measurementType,
              value: o.data.value,
              unit: o.data.unit,
            })),
          ),
        })
      : buildSectionEnvelope({
          status: 'UNAVAILABLE',
          updatedAt: nowUtc,
          freshness: 'none',
          source: null,
          data: null,
          reason: 'resource observations unavailable',
        });

  const productive =
    productiveResult.status === 'fulfilled'
      ? buildSectionEnvelope({
          status: defaultDataStateForMode(productiveResult.value.length > 0),
          updatedAt: nowUtc,
          freshness: productiveResult.value.length > 0 ? 'current' : 'none',
          source: Object.freeze({ displayName: 'Productive Economy', authorityClass: 'reference_data' }),
          data: Object.freeze({
            observationCount: productiveResult.value.length,
            domains: Object.freeze(
              [...new Set(productiveResult.value.map((o) => o.economicDomain))].sort(),
            ),
          }),
        })
      : buildSectionEnvelope({
          status: 'UNAVAILABLE',
          updatedAt: nowUtc,
          freshness: 'none',
          source: null,
          data: null,
          reason: 'productive observations unavailable',
        });

  const logistics = buildSectionEnvelope({
    status: productive.status === 'UNAVAILABLE' ? 'UNAVAILABLE' : 'SIMULATED',
    updatedAt: nowUtc,
    freshness: 'reference',
    source: Object.freeze({ displayName: 'Logistics Fabric', authorityClass: 'reference_data' }),
    data: Object.freeze({
      note: 'Logistics observations route through productive economy data platform',
    }),
  });

  const environment = buildSectionEnvelope({
    status: 'SIMULATED',
    updatedAt: nowUtc,
    freshness: 'reference',
    source: Object.freeze({ displayName: 'Environmental Oracle', authorityClass: 'reference_data' }),
    data: Object.freeze({
      referenceRoute: '/api/v1/world/environmental',
    }),
  });

  const compute = buildSectionEnvelope({
    status: productive.status === 'UNAVAILABLE' ? 'UNAVAILABLE' : 'SIMULATED',
    updatedAt: nowUtc,
    freshness: 'reference',
    source: Object.freeze({ displayName: 'Compute Economics', authorityClass: 'reference_data' }),
    data: Object.freeze({
      note: 'AI/compute economics via productive economy observations',
    }),
  });

  const sections = Object.freeze({
    energy,
    resources,
    logistics,
    environment,
    compute,
  });

  return Object.freeze({
    schema: 'sunrey.productive-economy.snapshot.v1',
    generatedAt: nowUtc,
    overallStatus: aggregateOverallState(Object.values(sections).map((s) => s.status)),
    dataMode: DATA_MODE,
    analyticsOnly: true,
    issuanceAuthority: false,
    sections,
  });
}
