/**
 * Wave 4 Task 1 — audit of current data stores and query access modes.
 *
 * Maps which stores can be queried directly vs connector-mediated.
 * Simulation posture: fixture and in-memory sources dominate.
 */

import type { FederationDataSourceRecord } from './types.ts';

export const CANONICAL_FEDERATION_SOURCES = Object.freeze([
  Object.freeze({
    sourceId: 'db.solstice_customer',
    label: 'Solstice Customer PostgreSQL',
    kind: 'POSTGRESQL',
    accessMode: 'CONNECTOR_MEDIATED',
    ownerPackage: 'packages/persistence',
    domains: ['WORKFORCE', 'EDUCATION', 'RESEARCH_PUBLICATION'],
    directQueryable: false,
    connectorRequired: true,
    notes: 'Consent, PDV, economic graph, information market schemas. Subject-bound data requires purpose firewall.',
  }),
  Object.freeze({
    sourceId: 'db.solstice_ledger',
    label: 'Solstice Ledger PostgreSQL',
    kind: 'POSTGRESQL',
    accessMode: 'CONNECTOR_MEDIATED',
    ownerPackage: 'packages/ledger',
    domains: ['REFERENCE'],
    directQueryable: false,
    connectorRequired: true,
    notes: 'Append-only journals. Balances read from ledger, never stored on Account.',
  }),
  Object.freeze({
    sourceId: 'db.solstice_evidence',
    label: 'Solstice Evidence Vault PostgreSQL',
    kind: 'POSTGRESQL',
    accessMode: 'CONNECTOR_MEDIATED',
    ownerPackage: 'packages/evidence',
    domains: ['REFERENCE'],
    directQueryable: false,
    connectorRequired: true,
    notes: 'Hash-chained evidence. Query receipts may reference vault entries; raw payloads not logged.',
  }),
  Object.freeze({
    sourceId: 'db.solstice_security',
    label: 'Solstice Security PostgreSQL',
    kind: 'POSTGRESQL',
    accessMode: 'NOT_QUERYABLE',
    ownerPackage: 'packages/security',
    domains: [],
    directQueryable: false,
    connectorRequired: true,
    notes: 'Key metadata only. Not federated for economic queries.',
  }),
  Object.freeze({
    sourceId: 'external-data.plane',
    label: 'External Data Plane',
    kind: 'PROVIDER_API',
    accessMode: 'FIXTURE_ONLY',
    ownerPackage: 'packages/external-data',
    domains: ['REFERENCE', 'RESEARCH_PUBLICATION', 'WORKFORCE'],
    directQueryable: false,
    connectorRequired: true,
    notes: 'Waves 1–7 provider observations. Fixture transport in simulation.',
  }),
  Object.freeze({
    sourceId: 'oracle.economic-data-fabric',
    label: 'Unified Economic Data Fabric',
    kind: 'IN_MEMORY_STORE',
    accessMode: 'DIRECT_QUERY',
    ownerPackage: 'packages/sunrey-chain/src/oracle/production/economic-data-fabric',
    domains: ['ENERGY', 'MANUFACTURING', 'LOGISTICS', 'COMPUTE', 'BANDWIDTH', 'AGRICULTURE', 'REFERENCE'],
    directQueryable: true,
    connectorRequired: false,
    notes: 'Chunk 138 reconciliation store. Primary federation owner.',
  }),
  Object.freeze({
    sourceId: 'oracle.provider-families',
    label: 'Oracle Provider Family Adapters',
    kind: 'PROVIDER_API',
    accessMode: 'FIXTURE_ONLY',
    ownerPackage: 'packages/sunrey-chain/src/oracle/production/provider-families',
    domains: ['ENERGY', 'MANUFACTURING', 'LOGISTICS', 'COMPUTE', 'BANDWIDTH', 'AGRICULTURE', 'WEATHER'],
    directQueryable: false,
    connectorRequired: true,
    notes: 'Per-family fixture adapters. Certification gate before admission.',
  }),
  Object.freeze({
    sourceId: 'productive.economy-data',
    label: 'Productive Economy Data Platform',
    kind: 'IN_MEMORY_STORE',
    accessMode: 'DIRECT_QUERY',
    ownerPackage: 'packages/sunrey-chain/src/productive/economy-data',
    domains: ['MANUFACTURING', 'LOGISTICS', 'ENERGY'],
    directQueryable: true,
    connectorRequired: false,
    notes: 'Phase H observations. Does not mint MoonRey.',
  }),
  Object.freeze({
    sourceId: 'provider-runtime.observation-cache',
    label: 'Provider Runtime Observation Cache',
    kind: 'IN_MEMORY_STORE',
    accessMode: 'CONNECTOR_MEDIATED',
    ownerPackage: 'packages/sunrey-chain/src/provider-runtime/data-delivery',
    domains: ['ENERGY', 'REFERENCE'],
    directQueryable: false,
    connectorRequired: true,
    notes: 'TTL/SWR cache. Not authoritative; may promote to fabric observation journal.',
  }),
  Object.freeze({
    sourceId: 'personal-economic-graph',
    label: 'Personal Economic Graph',
    kind: 'GRAPH_PROJECTION',
    accessMode: 'CONNECTOR_MEDIATED',
    ownerPackage: 'packages/personal-economic-graph',
    domains: ['WORKFORCE', 'EDUCATION'],
    directQueryable: false,
    connectorRequired: true,
    notes: 'Non-authoritative subject intelligence. Purpose-bound.',
  }),
  Object.freeze({
    sourceId: 'information-market.hin',
    label: 'Human Information Network',
    kind: 'GRAPH_PROJECTION',
    accessMode: 'CONNECTOR_MEDIATED',
    ownerPackage: 'packages/information-market',
    domains: ['RESEARCH_PUBLICATION', 'WORKFORCE'],
    directQueryable: false,
    connectorRequired: true,
    notes: 'Rights marketplace governs purpose. Clean-room for sensitive joins.',
  }),
  Object.freeze({
    sourceId: 'personal-data-vault',
    label: 'Personal Data Vault',
    kind: 'CONNECTOR_MEDIATED',
    accessMode: 'CONNECTOR_MEDIATED',
    ownerPackage: 'packages/personal-data-vault',
    domains: ['WORKFORCE', 'EDUCATION'],
    directQueryable: false,
    connectorRequired: true,
    notes: 'Subject-bound encrypted store. Clean-room query templates only.',
  }),
  Object.freeze({
    sourceId: 'economic-asset-registry',
    label: 'Economic Asset Registry',
    kind: 'IN_MEMORY_STORE',
    accessMode: 'DIRECT_QUERY',
    ownerPackage: 'packages/economic-asset-registry',
    domains: ['RESEARCH_PUBLICATION', 'REFERENCE'],
    directQueryable: true,
    connectorRequired: false,
    notes: 'Metadata, rights, provenance. VERIFIED requires verification decision.',
  }),
  Object.freeze({
    sourceId: 'external-data.search-index',
    label: 'External Data In-Memory Search Index',
    kind: 'SEARCH_INDEX',
    accessMode: 'DIRECT_QUERY',
    ownerPackage: 'packages/external-data/src/plane.ts',
    domains: ['REFERENCE', 'RESEARCH_PUBLICATION'],
    directQueryable: true,
    connectorRequired: false,
    notes: 'Lightweight entity index over filings/company data. Not a warehouse.',
  }),
  Object.freeze({
    sourceId: 'warehouse.lake.placeholder',
    label: 'Enterprise Warehouse / Lake (future)',
    kind: 'WAREHOUSE_LAKE',
    accessMode: 'NOT_QUERYABLE',
    ownerPackage: 'future-connector',
    domains: [],
    directQueryable: false,
    connectorRequired: true,
    notes: 'Reserved for FederationAdapter / Trino boundary when operationally justified.',
  }),
]) as readonly FederationDataSourceRecord[];

export class FederationSourceRegistry {
  private readonly byId = new Map<string, FederationDataSourceRecord>();

  constructor(sources: readonly FederationDataSourceRecord[] = CANONICAL_FEDERATION_SOURCES) {
    for (const source of sources) {
      this.byId.set(source.sourceId, source);
    }
  }

  get(sourceId: string): FederationDataSourceRecord | undefined {
    return this.byId.get(sourceId);
  }

  list(): readonly FederationDataSourceRecord[] {
    return [...this.byId.values()].sort((left, right) => (left.sourceId < right.sourceId ? -1 : 1));
  }

  forDomain(domain: FederationDataSourceRecord['domains'][number]): readonly FederationDataSourceRecord[] {
    return this.list().filter((source) => source.domains.includes(domain));
  }

  directQueryable(): readonly FederationDataSourceRecord[] {
    return this.list().filter((source) => source.directQueryable);
  }

  connectorMediated(): readonly FederationDataSourceRecord[] {
    return this.list().filter((source) => source.connectorRequired);
  }
}
