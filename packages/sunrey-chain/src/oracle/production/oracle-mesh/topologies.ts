// @ts-nocheck
/**
 * Domain-specific oracle topologies — recommended source-class combinations.
 *
 * Quorum rules vary by domain; policies are versioned separately.
 */

import type { ProductiveMeshDomain, ProductiveOracleSourceClass } from './types.ts';

export type DomainTopology = {
  readonly domain: ProductiveMeshDomain;
  readonly recommendedClasses: readonly ProductiveOracleSourceClass[];
  readonly minimumIndependentSources: number;
  readonly notes: string;
};

export const DOMAIN_TOPOLOGIES: Readonly<Record<ProductiveMeshDomain, DomainTopology>> = Object.freeze({
  ENERGY: Object.freeze({
    domain: 'ENERGY',
    recommendedClasses: Object.freeze([
      'DIRECT_SENSOR',
      'UTILITY_OR_GRID',
      'PRIMARY_OPERATOR',
      'SATELLITE',
      'GOVERNMENT',
      'MARKET_REFERENCE',
    ]),
    minimumIndependentSources: 2,
    notes: 'Direct meter + grid/operator + weather/satellite/reference corroboration',
  }),
  COMPUTE: Object.freeze({
    domain: 'COMPUTE',
    recommendedClasses: Object.freeze([
      'DIRECT_SENSOR',
      'PRIMARY_OPERATOR',
      'ENTERPRISE_SYSTEM',
      'NETWORK_OPERATOR',
      'UTILITY_OR_GRID',
    ]),
    minimumIndependentSources: 2,
    notes: 'Datacenter telemetry + workload receipt + energy/resource corroboration where applicable',
  }),
  MANUFACTURING: Object.freeze({
    domain: 'MANUFACTURING',
    recommendedClasses: Object.freeze([
      'ENTERPRISE_SYSTEM',
      'LOGISTICS_OPERATOR',
      'DIRECT_SENSOR',
      'UTILITY_OR_GRID',
      'PRIMARY_OPERATOR',
    ]),
    minimumIndependentSources: 2,
    notes: 'ERP/MES + logistics + energy/input/output corroboration',
  }),
  AGRICULTURE: Object.freeze({
    domain: 'AGRICULTURE',
    recommendedClasses: Object.freeze([
      'DIRECT_SENSOR',
      'SATELLITE',
      'GOVERNMENT',
      'GEOSPATIAL',
      'ACADEMIC',
    ]),
    minimumIndependentSources: 2,
    notes: 'Farm/IoT + satellite + government/reference',
  }),
  LOGISTICS: Object.freeze({
    domain: 'LOGISTICS',
    recommendedClasses: Object.freeze([
      'LOGISTICS_OPERATOR',
      'GEOSPATIAL',
      'PRIMARY_OPERATOR',
      'GOVERNMENT',
      'DIRECT_SENSOR',
    ]),
    minimumIndependentSources: 2,
    notes: 'Operator record + geospatial movement + port/infrastructure record',
  }),
  WATER: Object.freeze({
    domain: 'WATER',
    recommendedClasses: Object.freeze([
      'UTILITY_OR_GRID',
      'DIRECT_SENSOR',
      'GOVERNMENT',
      'GEOSPATIAL',
      'SATELLITE',
    ]),
    minimumIndependentSources: 2,
    notes: 'Utility + direct sensor + hydrology/geospatial/reference',
  }),
  RESOURCES: Object.freeze({
    domain: 'RESOURCES',
    recommendedClasses: Object.freeze([
      'PRIMARY_OPERATOR',
      'GOVERNMENT',
      'GEOSPATIAL',
      'LOGISTICS_OPERATOR',
      'SATELLITE',
    ]),
    minimumIndependentSources: 2,
    notes: 'Producer + government/geological data + logistics/export evidence',
  }),
});

export function topologyFor(domain: ProductiveMeshDomain): DomainTopology {
  return DOMAIN_TOPOLOGIES[domain];
}
