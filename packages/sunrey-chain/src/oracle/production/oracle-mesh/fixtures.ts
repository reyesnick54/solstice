/**
 * Development mesh fixtures — representative scenarios across productive domains.
 *
 * Simulation only. Not live provider integrations.
 */

import type { UtcInstant } from '../../../../../domain/src/time.ts';
import type {
  ProductiveCandidateEvent,
  ProductiveMeshAsset,
  ProductiveMeshDomain,
  ProductiveSourceRecord,
} from './types.ts';

const NOW = '2026-09-02T12:00:00.000Z' as UtcInstant;
const START = '2026-09-02T11:00:00.000Z' as UtcInstant;
const END = '2026-09-02T12:00:00.000Z' as UtcInstant;

const VALID_RIGHTS = Object.freeze({
  licenseId: 'sandbox.fixture.v1',
  commercialUsePermitted: true,
  redistributionPermitted: false,
  purposeBound: true,
});

const INVALID_RIGHTS = Object.freeze({
  licenseId: 'restricted.external.v1',
  commercialUsePermitted: false,
  redistributionPermitted: false,
  purposeBound: true,
});

function asset(domain: ProductiveMeshDomain, suffix: string): ProductiveMeshAsset {
  return Object.freeze({
    assetId: `asset.${domain.toLowerCase()}.${suffix}`,
    domain,
    canonicalRef: `ref.${domain.toLowerCase()}.${suffix}`,
    displayLabel: `${domain} ${suffix}`,
  });
}

function event(domain: ProductiveMeshDomain, suffix: string): ProductiveCandidateEvent {
  return Object.freeze({
    eventId: `event.${domain.toLowerCase()}.${suffix}`,
    domain,
    subjectRef: `subject.${suffix}`,
    resourceRef: `resource.${suffix}`,
    metric: 'production_quantity',
    measurementStartUtc: START,
    measurementEndUtc: END,
  });
}

function record(input: {
  readonly providerId: string;
  readonly sourceRecordId: string;
  readonly controllerId: string;
  readonly upstreamOrganizationId: string;
  readonly datasetOriginId: string;
  readonly copiedFromProviderId?: string | null;
  readonly derivedFromDatasetId?: string | null;
  readonly sourceClass: ProductiveSourceRecord['sourceClass'];
  readonly domain: ProductiveMeshDomain;
  readonly value: bigint;
  readonly freshnessState?: ProductiveSourceRecord['freshnessState'];
  readonly rights?: ProductiveSourceRecord['rights'];
  readonly providerAvailable?: boolean;
  readonly suffix?: string;
}): ProductiveSourceRecord {
  const suffix = input.suffix ?? 'sim';
  return Object.freeze({
    providerId: input.providerId,
    sourceRecordId: input.sourceRecordId,
    controllerId: input.controllerId,
    upstreamOrganizationId: input.upstreamOrganizationId,
    datasetOriginId: input.datasetOriginId,
    copiedFromProviderId: input.copiedFromProviderId ?? null,
    derivedFromDatasetId: input.derivedFromDatasetId ?? null,
    sourceClass: input.sourceClass,
    domain: input.domain,
    subjectRef: `subject.${suffix}`,
    resourceRef: `resource.${suffix}`,
    metric: 'production_quantity',
    value: input.value,
    unit: 'kWh',
    observedAtUtc: NOW,
    receivedAtUtc: NOW,
    freshnessState: input.freshnessState ?? 'FRESH',
    rights: input.rights ?? VALID_RIGHTS,
    evidenceRef: `evidence.${input.providerId}.${input.sourceRecordId}`,
    payloadDigest: `digest.${input.providerId}.${input.sourceRecordId}`,
    providerAvailable: input.providerAvailable ?? true,
  });
}

export const MESH_FIXTURE_NOW_UTC = NOW;

export type MeshFixtureScenario =
  | 'healthy_corroboration'
  | 'single_source'
  | 'copied_sources'
  | 'stale_source'
  | 'outlier'
  | 'conflict'
  | 'missing_source'
  | 'invalid_rights'
  | 'provider_outage';

export type MeshFixturePack = {
  readonly domain: ProductiveMeshDomain;
  readonly scenario: MeshFixtureScenario;
  readonly asset: ProductiveMeshAsset;
  readonly candidateEvent: ProductiveCandidateEvent;
  readonly sourceRecords: readonly ProductiveSourceRecord[];
};

function energyRecords(scenario: MeshFixtureScenario): readonly ProductiveSourceRecord[] {
  switch (scenario) {
    case 'healthy_corroboration':
      return Object.freeze([
        record({
          providerId: 'energy_meter_a',
          sourceRecordId: 'meter_1',
          controllerId: 'ctrl_meter_a',
          upstreamOrganizationId: 'org_meter_a',
          datasetOriginId: 'origin.meter_a',
          sourceClass: 'DIRECT_SENSOR',
          domain: 'ENERGY',
          value: 1_000n,
        }),
        record({
          providerId: 'energy_grid_b',
          sourceRecordId: 'grid_1',
          controllerId: 'ctrl_grid_b',
          upstreamOrganizationId: 'org_grid_b',
          datasetOriginId: 'origin.grid_b',
          sourceClass: 'UTILITY_OR_GRID',
          domain: 'ENERGY',
          value: 1_010n,
        }),
      ]);
    case 'single_source':
      return Object.freeze([
        record({
          providerId: 'energy_meter_only',
          sourceRecordId: 'meter_only',
          controllerId: 'ctrl_meter_only',
          upstreamOrganizationId: 'org_meter_only',
          datasetOriginId: 'origin.meter_only',
          sourceClass: 'DIRECT_SENSOR',
          domain: 'ENERGY',
          value: 900n,
        }),
      ]);
    case 'copied_sources':
      return Object.freeze([
        record({
          providerId: 'gov_energy_a',
          sourceRecordId: 'gov_1',
          controllerId: 'ctrl_gov',
          upstreamOrganizationId: 'org_gov',
          datasetOriginId: 'origin.gov_energy',
          sourceClass: 'GOVERNMENT',
          domain: 'ENERGY',
          value: 1_000n,
        }),
        record({
          providerId: 'website_b',
          sourceRecordId: 'web_1',
          controllerId: 'ctrl_web_b',
          upstreamOrganizationId: 'org_web_b',
          datasetOriginId: 'origin.gov_energy',
          copiedFromProviderId: 'gov_energy_a',
          sourceClass: 'GOVERNMENT',
          domain: 'ENERGY',
          value: 1_000n,
        }),
        record({
          providerId: 'aggregator_c',
          sourceRecordId: 'agg_1',
          controllerId: 'ctrl_agg_c',
          upstreamOrganizationId: 'org_agg_c',
          datasetOriginId: 'origin.gov_energy',
          copiedFromProviderId: 'website_b',
          derivedFromDatasetId: 'origin.gov_energy',
          sourceClass: 'AGGREGATOR',
          domain: 'ENERGY',
          value: 1_000n,
        }),
      ]);
    case 'stale_source':
      return Object.freeze([
        record({
          providerId: 'energy_meter_a',
          sourceRecordId: 'meter_stale',
          controllerId: 'ctrl_meter_a',
          upstreamOrganizationId: 'org_meter_a',
          datasetOriginId: 'origin.meter_a',
          sourceClass: 'DIRECT_SENSOR',
          domain: 'ENERGY',
          value: 1_000n,
          freshnessState: 'STALE',
        }),
        record({
          providerId: 'energy_grid_b',
          sourceRecordId: 'grid_fresh',
          controllerId: 'ctrl_grid_b',
          upstreamOrganizationId: 'org_grid_b',
          datasetOriginId: 'origin.grid_b',
          sourceClass: 'UTILITY_OR_GRID',
          domain: 'ENERGY',
          value: 1_005n,
        }),
      ]);
    case 'outlier':
      return Object.freeze([
        record({
          providerId: 'energy_meter_a',
          sourceRecordId: 'meter_ok',
          controllerId: 'ctrl_meter_a',
          upstreamOrganizationId: 'org_meter_a',
          datasetOriginId: 'origin.meter_a',
          sourceClass: 'DIRECT_SENSOR',
          domain: 'ENERGY',
          value: 1_000n,
        }),
        record({
          providerId: 'energy_grid_b',
          sourceRecordId: 'grid_ok',
          controllerId: 'ctrl_grid_b',
          upstreamOrganizationId: 'org_grid_b',
          datasetOriginId: 'origin.grid_b',
          sourceClass: 'UTILITY_OR_GRID',
          domain: 'ENERGY',
          value: 1_020n,
        }),
        record({
          providerId: 'energy_outlier',
          sourceRecordId: 'outlier_1',
          controllerId: 'ctrl_outlier',
          upstreamOrganizationId: 'org_outlier',
          datasetOriginId: 'origin.outlier',
          sourceClass: 'PRIMARY_OPERATOR',
          domain: 'ENERGY',
          value: 5_000n,
        }),
      ]);
    case 'conflict':
      return Object.freeze([
        record({
          providerId: 'energy_meter_a',
          sourceRecordId: 'meter_conflict_a',
          controllerId: 'ctrl_meter_a',
          upstreamOrganizationId: 'org_meter_a',
          datasetOriginId: 'origin.meter_a',
          sourceClass: 'DIRECT_SENSOR',
          domain: 'ENERGY',
          value: 1_000n,
        }),
        record({
          providerId: 'energy_grid_b',
          sourceRecordId: 'grid_conflict_b',
          controllerId: 'ctrl_grid_b',
          upstreamOrganizationId: 'org_grid_b',
          datasetOriginId: 'origin.grid_b',
          sourceClass: 'UTILITY_OR_GRID',
          domain: 'ENERGY',
          value: 2_500n,
        }),
      ]);
    case 'missing_source':
      return Object.freeze([]);
    case 'invalid_rights':
      return Object.freeze([
        record({
          providerId: 'energy_restricted',
          sourceRecordId: 'restricted_1',
          controllerId: 'ctrl_restricted',
          upstreamOrganizationId: 'org_restricted',
          datasetOriginId: 'origin.restricted',
          sourceClass: 'DIRECT_SENSOR',
          domain: 'ENERGY',
          value: 1_000n,
          rights: INVALID_RIGHTS,
        }),
      ]);
    case 'provider_outage':
      return Object.freeze([
        record({
          providerId: 'energy_meter_down',
          sourceRecordId: 'meter_down',
          controllerId: 'ctrl_meter_down',
          upstreamOrganizationId: 'org_meter_down',
          datasetOriginId: 'origin.meter_down',
          sourceClass: 'DIRECT_SENSOR',
          domain: 'ENERGY',
          value: 1_000n,
          providerAvailable: false,
        }),
      ]);
  }
}

function domainRecord(
  domain: ProductiveMeshDomain,
  scenario: MeshFixtureScenario,
  index: number,
  overrides: Partial<Parameters<typeof record>[0]> = {},
): ProductiveSourceRecord {
  const classes: Record<ProductiveMeshDomain, ProductiveSourceRecord['sourceClass'][]> = {
    ENERGY: ['DIRECT_SENSOR', 'UTILITY_OR_GRID'],
    COMPUTE: ['DIRECT_SENSOR', 'PRIMARY_OPERATOR'],
    MANUFACTURING: ['ENTERPRISE_SYSTEM', 'LOGISTICS_OPERATOR'],
    AGRICULTURE: ['DIRECT_SENSOR', 'SATELLITE'],
    LOGISTICS: ['LOGISTICS_OPERATOR', 'GEOSPATIAL'],
    WATER: ['UTILITY_OR_GRID', 'DIRECT_SENSOR'],
    RESOURCES: ['PRIMARY_OPERATOR', 'GOVERNMENT'],
  };
  const sourceClass = classes[domain][index] ?? 'DIRECT_SENSOR';
  return record({
    providerId: `${domain.toLowerCase()}_provider_${index}`,
    sourceRecordId: `${scenario}_${index}`,
    controllerId: `ctrl_${domain.toLowerCase()}_${index}`,
    upstreamOrganizationId: `org_${domain.toLowerCase()}_${index}`,
    datasetOriginId: `origin.${domain.toLowerCase()}.${index}`,
    sourceClass,
    domain,
    value: 1_000n + BigInt(index * 10),
    suffix: domain.toLowerCase(),
    ...overrides,
  });
}

function genericDomainRecords(domain: ProductiveMeshDomain, scenario: MeshFixtureScenario): readonly ProductiveSourceRecord[] {
  if (domain === 'ENERGY') {
    return energyRecords(scenario);
  }
  switch (scenario) {
    case 'healthy_corroboration':
      return Object.freeze([domainRecord(domain, scenario, 0), domainRecord(domain, scenario, 1)]);
    case 'single_source':
      return Object.freeze([domainRecord(domain, scenario, 0)]);
    case 'copied_sources':
      return Object.freeze([
        domainRecord(domain, scenario, 0),
        domainRecord(domain, scenario, 1, {
          copiedFromProviderId: `${domain.toLowerCase()}_provider_0`,
          datasetOriginId: `origin.${domain.toLowerCase()}.0`,
          sourceClass: 'AGGREGATOR',
        }),
      ]);
    case 'stale_source':
      return Object.freeze([
        domainRecord(domain, scenario, 0, { freshnessState: 'STALE' }),
        domainRecord(domain, scenario, 1),
      ]);
    case 'outlier':
      return Object.freeze([
        domainRecord(domain, scenario, 0),
        domainRecord(domain, scenario, 1),
        domainRecord(domain, scenario, 2, { value: 9_000n, sourceClass: 'PRIMARY_OPERATOR' }),
      ]);
    case 'conflict':
      return Object.freeze([
        domainRecord(domain, scenario, 0, { value: 1_000n }),
        domainRecord(domain, scenario, 1, { value: 4_000n }),
      ]);
    case 'missing_source':
      return Object.freeze([]);
    case 'invalid_rights':
      return Object.freeze([domainRecord(domain, scenario, 0, { rights: INVALID_RIGHTS })]);
    case 'provider_outage':
      return Object.freeze([domainRecord(domain, scenario, 0, { providerAvailable: false })]);
  }
}

export function meshFixturePack(
  domain: ProductiveMeshDomain,
  scenario: MeshFixtureScenario,
): MeshFixturePack {
  return Object.freeze({
    domain,
    scenario,
    asset: asset(domain, scenario),
    candidateEvent: event(domain, scenario),
    sourceRecords: genericDomainRecords(domain, scenario),
  });
}

export const ALL_MESH_DOMAINS: readonly ProductiveMeshDomain[] = Object.freeze([
  'ENERGY',
  'COMPUTE',
  'MANUFACTURING',
  'AGRICULTURE',
  'LOGISTICS',
  'WATER',
  'RESOURCES',
]);

export const ALL_MESH_SCENARIOS: readonly MeshFixtureScenario[] = Object.freeze([
  'healthy_corroboration',
  'single_source',
  'copied_sources',
  'stale_source',
  'outlier',
  'conflict',
  'missing_source',
  'invalid_rights',
  'provider_outage',
]);

export function allMeshFixtures(): readonly MeshFixturePack[] {
  const packs: MeshFixturePack[] = [];
  for (const domain of ALL_MESH_DOMAINS) {
    for (const scenario of ALL_MESH_SCENARIOS) {
      packs.push(meshFixturePack(domain, scenario));
    }
  }
  return Object.freeze(packs);
}

/** Market-reference-only scenario — cannot substitute for production evidence. */
export function marketReferenceOnlyFixture(domain: ProductiveMeshDomain = 'ENERGY'): MeshFixturePack {
  return Object.freeze({
    domain,
    scenario: 'single_source',
    asset: asset(domain, 'market_reference_only'),
    candidateEvent: event(domain, 'market_reference_only'),
    sourceRecords: Object.freeze([
      record({
        providerId: 'market_ref_only',
        sourceRecordId: 'price_1',
        controllerId: 'ctrl_market',
        upstreamOrganizationId: 'org_market',
        datasetOriginId: 'origin.market_price',
        sourceClass: 'MARKET_REFERENCE',
        domain,
        value: 1_000n,
      }),
    ]),
  });
}

/** Wrong source class for domain policy. */
export function wrongSourceClassFixture(domain: ProductiveMeshDomain = 'ENERGY'): MeshFixturePack {
  return Object.freeze({
    domain,
    scenario: 'single_source',
    asset: asset(domain, 'wrong_source_class'),
    candidateEvent: event(domain, 'wrong_source_class'),
    sourceRecords: Object.freeze([
      record({
        providerId: 'academic_only',
        sourceRecordId: 'paper_1',
        controllerId: 'ctrl_academic',
        upstreamOrganizationId: 'org_academic',
        datasetOriginId: 'origin.academic',
        sourceClass: 'ACADEMIC',
        domain,
        value: 1_000n,
      }),
    ]),
  });
}
