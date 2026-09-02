/**
 * Wave 4 Task 9 — representative cross-source federation fixtures.
 *
 * Proves federation architecture across domains. Not economic valuation.
 */

import { sha256Hex } from '../../../../../../security/src/hash.ts';
import type { InMemoryFederationAdapter } from './adapter.ts';
import type {
  FederatedFactAttribution,
  FederatedMetricResult,
  FederatedQueryRequest,
  FederationMetricRequest,
  FederationRightsContext,
  FederationSourceConstraint,
} from './types.ts';

export const FEDERATION_FIXTURE_NOW_UNIX = 1_700_100_000n;

const GEO = Object.freeze({ jurisdiction: 'US', region: 'sim-west', locality: 'zone-a' });

function attribution(input: {
  readonly providerId: string;
  readonly sourceId: string;
  readonly datasetId: string;
  readonly unit: string;
  readonly label: string;
}): FederatedFactAttribution {
  const observedAtUnix = FEDERATION_FIXTURE_NOW_UNIX;
  const contentCommitment = sha256Hex(`fed.fixture.${input.label}`);
  return Object.freeze({
    providerId: input.providerId,
    sourceId: input.sourceId,
    datasetId: input.datasetId,
    observedAtUnix,
    unit: input.unit,
    licenseRef: `license.sim.${input.providerId}`,
    provenanceRef: `prov.${input.label}`,
    contentCommitment,
  });
}

function metric(
  metricId: string,
  kind: FederatedMetricResult['kind'],
  mantissa: bigint,
  unit: string,
  attr: FederatedFactAttribution,
): FederatedMetricResult {
  return Object.freeze({
    metricId,
    kind,
    mantissa,
    scale: 0,
    unit,
    attribution: attr,
  });
}

export const RESEARCH_RIGHTS_CONTEXT: FederationRightsContext = Object.freeze({
  licenseId: 'license.research.sim',
  permittedPurposes: Object.freeze(['RESEARCH', 'FEDERATED_CORRELATION']),
  permittedMaterialization: Object.freeze(['QUERIED_ONLY', 'CACHED']),
});

export const ECONOMIC_AWARENESS_RIGHTS_CONTEXT: FederationRightsContext = Object.freeze({
  licenseId: 'license.economic-awareness.sim',
  permittedPurposes: Object.freeze(['ECONOMIC_AWARENESS', 'FEDERATED_CORRELATION']),
  permittedMaterialization: Object.freeze(['QUERIED_ONLY', 'CACHED', 'OBSERVATION']),
});

export const VALUATION_RIGHTS_CONTEXT: FederationRightsContext = Object.freeze({
  licenseId: 'license.valuation.sim',
  permittedPurposes: Object.freeze(['ECONOMIC_VALUATION']),
  permittedMaterialization: Object.freeze(['QUERIED_ONLY', 'OBSERVATION']),
});

function baseRequest(input: {
  readonly queryId: string;
  readonly purpose: FederatedQueryRequest['purpose'];
  readonly domain: FederatedQueryRequest['domain'];
  readonly metrics: readonly FederationMetricRequest[];
  readonly sourceConstraints: readonly FederationSourceConstraint[];
  readonly rightsContext: FederationRightsContext;
  readonly allowPartial?: boolean;
}): FederatedQueryRequest {
  return Object.freeze({
    queryId: input.queryId,
    purpose: input.purpose,
    principal: Object.freeze({
      principalId: 'svc.federation.sim',
      principalKind: 'SERVICE',
      jurisdiction: 'US',
    }),
    domain: input.domain,
    metrics: input.metrics,
    sourceConstraints: input.sourceConstraints,
    requestedFields: Object.freeze(['aggregate_value', 'observation_count']),
    timeRange: Object.freeze({
      fromUnix: FEDERATION_FIXTURE_NOW_UNIX - 86_400n,
      toUnix: FEDERATION_FIXTURE_NOW_UNIX,
    }),
    geography: GEO,
    rightsContext: input.rightsContext,
    allowPartial: input.allowPartial,
  });
}

export const ENERGY_WEATHER_CROSS_SOURCE_QUERY: FederatedQueryRequest = baseRequest({
  queryId: 'fed.q.energy-weather.v1',
  purpose: 'RESEARCH',
  domain: 'ENERGY',
  metrics: Object.freeze([
    Object.freeze({ metricId: 'grid_output_kwh', kind: 'AGGREGATE_SUM', field: 'output_kwh' }),
    Object.freeze({ metricId: 'ambient_temp_c', kind: 'AGGREGATE_AVG', field: 'temp_c' }),
  ]),
  sourceConstraints: Object.freeze([
    Object.freeze({ sourceId: 'oracle.economic-data-fabric', providerId: 'prov_energy_sim' }),
    Object.freeze({ sourceId: 'oracle.provider-families', providerId: 'prov_weather_sim' }),
  ]),
  rightsContext: RESEARCH_RIGHTS_CONTEXT,
});

export const MANUFACTURING_LOGISTICS_CROSS_SOURCE_QUERY: FederatedQueryRequest = baseRequest({
  queryId: 'fed.q.mfg-logistics.v1',
  purpose: 'FEDERATED_CORRELATION',
  domain: 'MANUFACTURING',
  metrics: Object.freeze([
    Object.freeze({ metricId: 'units_produced', kind: 'AGGREGATE_SUM', field: 'units' }),
    Object.freeze({ metricId: 'shipments_completed', kind: 'AGGREGATE_COUNT', field: 'shipments' }),
  ]),
  sourceConstraints: Object.freeze([
    Object.freeze({ sourceId: 'oracle.economic-data-fabric', providerId: 'prov_mfg_sim' }),
    Object.freeze({ sourceId: 'productive.economy-data', providerId: 'prov_logistics_sim' }),
  ]),
  rightsContext: ECONOMIC_AWARENESS_RIGHTS_CONTEXT,
});

export const RESEARCH_PUBLICATION_CROSS_SOURCE_QUERY: FederatedQueryRequest = baseRequest({
  queryId: 'fed.q.research-publication.v1',
  purpose: 'RESEARCH',
  domain: 'RESEARCH_PUBLICATION',
  metrics: Object.freeze([
    Object.freeze({ metricId: 'publication_count', kind: 'AGGREGATE_COUNT' }),
    Object.freeze({ metricId: 'citation_proof', kind: 'PROOF_COMMITMENT' }),
  ]),
  sourceConstraints: Object.freeze([
    Object.freeze({ sourceId: 'external-data.search-index', providerId: 'prov_research_sim' }),
    Object.freeze({ sourceId: 'economic-asset-registry', providerId: 'prov_ear_sim' }),
  ]),
  rightsContext: RESEARCH_RIGHTS_CONTEXT,
});

export const WORKFORCE_EDUCATION_CROSS_SOURCE_QUERY: FederatedQueryRequest = baseRequest({
  queryId: 'fed.q.workforce-education.v1',
  purpose: 'AGGREGATED_ANALYTICS',
  domain: 'WORKFORCE',
  metrics: Object.freeze([
    Object.freeze({ metricId: 'credential_count', kind: 'AGGREGATE_COUNT' }),
    Object.freeze({ metricId: 'placement_rate', kind: 'DERIVED_RATIO' }),
  ]),
  sourceConstraints: Object.freeze([
    Object.freeze({ sourceId: 'personal-economic-graph', providerId: 'prov_peg_sim' }),
    Object.freeze({ sourceId: 'db.solstice_customer', providerId: 'prov_education_sim' }),
  ]),
  rightsContext: RESEARCH_RIGHTS_CONTEXT,
});

export function registerFederationFixtureHandlers(adapter: InMemoryFederationAdapter): void {
  adapter.register('oracle.economic-data-fabric', ({ request, constraint }) => {
    const attr = attribution({
      providerId: constraint.providerId ?? 'prov_energy_sim',
      sourceId: 'oracle.economic-data-fabric',
      datasetId: 'edf.energy.grid',
      unit: 'kWh',
      label: `${request.queryId}.energy`,
    });
    return {
      ok: true,
      metrics: Object.freeze([
        metric('grid_output_kwh', 'AGGREGATE_SUM', 1_250_000n, 'kWh', attr),
        metric('units_produced', 'AGGREGATE_SUM', 42_000n, 'units_produced', attr),
      ]),
    };
  });

  adapter.register('oracle.provider-families', ({ request }) => {
    const attr = attribution({
      providerId: 'prov_weather_sim',
      sourceId: 'oracle.provider-families',
      datasetId: 'weather.ambient',
      unit: 'celsius',
      label: `${request.queryId}.weather`,
    });
    return {
      ok: true,
      metrics: Object.freeze([metric('ambient_temp_c', 'AGGREGATE_AVG', 22n, 'celsius', attr)]),
    };
  });

  adapter.register('productive.economy-data', ({ request }) => {
    const attr = attribution({
      providerId: 'prov_logistics_sim',
      sourceId: 'productive.economy-data',
      datasetId: 'logistics.shipments',
      unit: 'count',
      label: `${request.queryId}.logistics`,
    });
    return {
      ok: true,
      metrics: Object.freeze([metric('shipments_completed', 'AGGREGATE_COUNT', 1_840n, 'count', attr)]),
    };
  });

  adapter.register('external-data.search-index', ({ request }) => {
    const attr = attribution({
      providerId: 'prov_research_sim',
      sourceId: 'external-data.search-index',
      datasetId: 'research.publications',
      unit: 'count',
      label: `${request.queryId}.publications`,
    });
    return {
      ok: true,
      metrics: Object.freeze([
        metric('publication_count', 'AGGREGATE_COUNT', 312n, 'count', attr),
      ]),
    };
  });

  adapter.register('economic-asset-registry', ({ request }) => {
    const attr = attribution({
      providerId: 'prov_ear_sim',
      sourceId: 'economic-asset-registry',
      datasetId: 'ear.metadata',
      unit: 'commitment',
      label: `${request.queryId}.citation`,
    });
    return {
      ok: true,
      metrics: Object.freeze([
        metric('citation_proof', 'PROOF_COMMITMENT', 0n, 'commitment', attr),
      ]),
    };
  });

  adapter.register('personal-economic-graph', ({ request }) => {
    const attr = attribution({
      providerId: 'prov_peg_sim',
      sourceId: 'personal-economic-graph',
      datasetId: 'peg.workforce',
      unit: 'count',
      label: `${request.queryId}.workforce`,
    });
    return {
      ok: true,
      metrics: Object.freeze([
        metric('credential_count', 'AGGREGATE_COUNT', 5_600n, 'count', attr),
        metric('placement_rate', 'DERIVED_RATIO', 78n, 'percent', attr),
      ]),
    };
  });

  adapter.register('db.solstice_customer', ({ request }) => {
    const attr = attribution({
      providerId: 'prov_education_sim',
      sourceId: 'db.solstice_customer',
      datasetId: 'education.credentials',
      unit: 'count',
      label: `${request.queryId}.education`,
    });
    return {
      ok: true,
      metrics: Object.freeze([
        metric('credential_count', 'AGGREGATE_COUNT', 5_600n, 'count', attr),
      ]),
    };
  });
}

export function registerUnavailableSourceHandler(
  adapter: InMemoryFederationAdapter,
  sourceId: string,
): void {
  adapter.register(sourceId, ({ constraint }) => ({
    ok: false,
    rejection: {
      code: 'SOURCE_UNAVAILABLE',
      message: `simulated unavailable source ${sourceId}`,
      sourceId: constraint.sourceId,
    },
  }));
}

export function registerLicenseDeniedHandler(
  adapter: InMemoryFederationAdapter,
  sourceId: string,
): void {
  adapter.register(sourceId, ({ constraint }) => ({
    ok: false,
    rejection: {
      code: 'LICENSE_DENIED',
      message: `license does not permit federation query on ${sourceId}`,
      sourceId: constraint.sourceId,
    },
  }));
}
