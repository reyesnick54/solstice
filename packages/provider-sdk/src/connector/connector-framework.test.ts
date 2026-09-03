// @ts-nocheck
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  buildDeduplicationKey,
  buildExternalObservation,
  createInMemoryDeduplicationRegistry,
  DEFAULT_DEDUPLICATION_POLICIES,
  isDuplicate,
  ProviderReliabilityControlPlane,
  SimulatedProviderTransport,
  loadCatalogFromYaml,
  getCatalogEntry,
  redactUrlForLog,
  createRedactionCatalog,
  headersAreSafeToLog,
} from '../index.ts';
import {
  auditProviderCatalogs,
  bootstrapWave4MigratedConnectors,
  buildTransportRetryIdentity,
  createConnectorRequestContext,
  createGovernedConnectorRegistry,
  createProviderLineageRegistry,
  RestGovernedConnector,
  catalogEntryToProviderDefinition,
} from './index.ts';

describe('Wave 4 provider connector framework', () => {
  it('discovers providers across config catalogs', () => {
    const report = auditProviderCatalogs();
    assert.ok(report.uniqueProviderIds >= 100);
    assert.ok(report.byPlane.HUMAN_ECONOMY > 0);
    assert.ok(report.byPlane.PRODUCTIVE_ECONOMY > 0);
    assert.ok(report.byPlane.REFERENCE_CONTEXT > 0);
  });

  it('builds versioned ProviderDefinition from catalog without credentials', () => {
    const catalog = loadCatalogFromYaml();
    const entry = getCatalogEntry(catalog, 'national-grid-eso');
    assert.ok(entry);
    const definition = catalogEntryToProviderDefinition(entry);
    assert.equal(definition.schemaVersion, 'sunrey.provider-definition.v1');
    assert.equal(definition.providerId, 'national-grid-eso');
    assert.ok(definition.domain.includes('energy'));
    assert.equal(definition.secretEnvironmentVariable, null);
    assert.ok(!JSON.stringify(definition).includes('api_key'));
  });

  it('rejects unknown provider connector lookup', async () => {
    const registry = createGovernedConnectorRegistry();
    bootstrapWave4MigratedConnectors(registry);
    assert.equal(registry.getConnector('nonexistent-provider-xyz'), undefined);
  });

  it('handles disabled provider', async () => {
    const catalog = loadCatalogFromYaml();
    const entry = getCatalogEntry(catalog, 'arbeitnow');
    assert.ok(entry);
    const definition = catalogEntryToProviderDefinition(entry);
    const connector = new RestGovernedConnector({
      definition,
      disabled: true,
      fixtures: [{ operation: 'jobs', filename: 'jobs.json' }],
    });
    const context = createConnectorRequestContext({
      operation: 'jobs',
      providerId: definition.providerId,
    });
    const result = await connector.fetch('jobs', {}, context);
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.code, 'PROVIDER_DISABLED');
    }
    assert.equal(connector.getOperationalHealth().state, 'DISABLED');
  });

  it('handles bad credentials without logging secrets', async () => {
    const catalog = loadCatalogFromYaml();
    const entry = getCatalogEntry(catalog, 'usda-fooddata-central');
    assert.ok(entry);
    const definition = catalogEntryToProviderDefinition(entry);
    const connector = new RestGovernedConnector({
      definition,
      simulationOnly: false,
      forceAuthFailure: true,
      fixtures: [{ operation: 'search', filename: 'search.json' }],
    });
    const context = createConnectorRequestContext({
      operation: 'search',
      providerId: definition.providerId,
      environment: 'simulation',
    });
    const result = await connector.fetch('search', {}, context);
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.code, 'AUTH_FAILURE');
      assert.ok(!result.message.includes('USDA_FDC_API_KEY'));
    }
    const catalog_redaction = createRedactionCatalog();
    const redacted = redactUrlForLog(
      'https://api.example.com?api_key=supersecret&foo=bar',
      catalog_redaction,
    );
    assert.ok(!redacted.includes('supersecret'));
    assert.ok(headersAreSafeToLog({ authorization: 'Bearer token123' }, catalog_redaction) === false);
  });

  it('handles timeout', async () => {
    const catalog = loadCatalogFromYaml();
    const entry = getCatalogEntry(catalog, 'noozra');
    assert.ok(entry);
    const definition = catalogEntryToProviderDefinition(entry);
    const connector = new RestGovernedConnector({
      definition,
      forceTimeout: true,
      fixtures: [{ operation: 'intelligence', filename: 'intelligence.json' }],
    });
    const context = createConnectorRequestContext({
      operation: 'intelligence',
      providerId: definition.providerId,
    });
    const result = await connector.fetch('intelligence', {}, context);
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.code, 'TIMEOUT');
    }
    assert.equal(connector.getOperationalHealth().state, 'UNAVAILABLE');
  });

  it('retries via reliability control plane without duplicate observations', async () => {
    const transport = new SimulatedProviderTransport('retry-test', [
      { status: 503, headers: {}, body: 'temporary' },
      { status: 200, headers: {}, body: '{"ok":true}' },
    ]);
    const reliability = new ProviderReliabilityControlPlane({
      policy: { maxRetries: 2, timeoutMs: 5_000 },
    });
    const outcome = await reliability.execute(transport, {
      method: 'GET',
      path: '/test',
      idempotent: true,
    });
    assert.equal(outcome.ok, true);
    if (outcome.ok) {
      assert.equal(outcome.attempts, 2);
    }
  });

  it('deduplicates duplicate retry responses via transportRetryIdentity', () => {
    const registry = createInMemoryDeduplicationRegistry();
    const transportRetryIdentity = buildTransportRetryIdentity({
      providerId: 'national-grid-eso',
      operation: 'generation',
      correlationId: 'corr-1',
    });
    const built = buildExternalObservation({
      providerId: 'national-grid-eso',
      providerCategory: 'energy',
      capability: 'generation',
      data: { value: 100 },
      source: { provider: 'national-grid-eso', dataset: 'grid' },
      time: {
        retrievedAt: '2026-01-01T00:00:01.000Z',
        sourceTimestamp: '2026-01-01T00:00:00.000Z',
      },
      authorityClass: 'authoritative_official',
      provenance: {
        rawPayload: '{"value":100}',
        providerSchemaVersion: 'v1',
      },
    });
    assert.equal(built.ok, true);
    if (!built.ok) {
      return;
    }
    const observation = built.value;
    const policy = DEFAULT_DEDUPLICATION_POLICIES.transportRetry;
    const first = isDuplicate(observation, policy, registry, { transportRetryIdentity });
    const second = isDuplicate(observation, policy, registry, { transportRetryIdentity });
    assert.equal(first, false);
    assert.equal(second, true);
    const key = buildDeduplicationKey(observation, policy, { transportRetryIdentity });
    assert.ok(key.digest.includes(transportRetryIdentity));
  });

  it('handles rate limit operational health', async () => {
    const catalog = loadCatalogFromYaml();
    const entry = getCatalogEntry(catalog, 'arbeitnow');
    assert.ok(entry);
    const definition = catalogEntryToProviderDefinition(entry);
    const connector = new RestGovernedConnector({
      definition,
      forceRateLimit: true,
      fixtures: [{ operation: 'jobs', filename: 'jobs.json' }],
    });
    const context = createConnectorRequestContext({
      operation: 'jobs',
      providerId: definition.providerId,
    });
    const result = await connector.fetch('jobs', {}, context);
    assert.equal(result.ok, false);
    assert.equal(connector.getOperationalHealth().state, 'RATE_LIMITED');
  });

  it('handles schema failure', async () => {
    const catalog = loadCatalogFromYaml();
    const entry = getCatalogEntry(catalog, 'national-grid-eso');
    assert.ok(entry);
    const definition = catalogEntryToProviderDefinition(entry);
    const connector = new RestGovernedConnector({
      definition,
      forceSchemaFailure: true,
      fixtures: [{ operation: 'generation', filename: 'generation.json' }],
    });
    const context = createConnectorRequestContext({
      operation: 'generation',
      providerId: definition.providerId,
    });
    const result = await connector.fetch('generation', {}, context);
    assert.equal(result.ok, false);
    assert.equal(connector.getOperationalHealth().state, 'SCHEMA_CHANGED');
  });

  it('tracks provider health changes on success after failure', async () => {
    const catalog = loadCatalogFromYaml();
    const entry = getCatalogEntry(catalog, 'arbeitnow');
    assert.ok(entry);
    const definition = catalogEntryToProviderDefinition(entry);
    const connector = new RestGovernedConnector({
      definition,
      forceRateLimit: true,
      fixtures: [{ operation: 'jobs', filename: 'jobs.json' }],
    });
    const failContext = createConnectorRequestContext({
      operation: 'jobs',
      providerId: definition.providerId,
    });
    await connector.fetch('jobs', {}, failContext);
    assert.equal(connector.getOperationalHealth().state, 'RATE_LIMITED');

    const healthy = new RestGovernedConnector({
      definition,
      fixtures: [{ operation: 'jobs', filename: 'jobs.json' }],
    });
    const okContext = createConnectorRequestContext({
      operation: 'jobs',
      providerId: definition.providerId,
    });
    const result = await healthy.fetch('jobs', {}, okContext);
    assert.equal(result.ok, true);
    assert.equal(healthy.getOperationalHealth().state, 'AVAILABLE');
    assert.equal(healthy.getOperationalHealth().trustScore, null);
  });

  it('registers provider lineage and detects shared upstream', () => {
    const lineage = createProviderLineageRegistry();
    lineage.registerOrigin({ providerId: 'eia', datasetId: 'eia:open-data' });
    lineage.registerDerivation({
      providerId: 'eia-mirror-a',
      upstreamProviderId: 'eia',
      relationship: 'REPUBLISHES',
    });
    lineage.registerDerivation({
      providerId: 'eia-mirror-b',
      upstreamProviderId: 'eia',
      relationship: 'REPUBLISHES',
    });
    const independent = lineage.countIndependentSources([
      'eia',
      'eia-mirror-a',
      'eia-mirror-b',
    ]);
    assert.equal(independent, 1);
    const shared = lineage.sharedUpstreamGroup(['eia', 'eia-mirror-a', 'eia-mirror-b']);
    assert.equal(shared.length, 3);
  });

  it('enforces environment restrictions', async () => {
    const catalog = loadCatalogFromYaml();
    const entry = getCatalogEntry(catalog, 'national-grid-eso');
    assert.ok(entry);
    const base = catalogEntryToProviderDefinition(entry);
    const restricted = Object.freeze({
      ...base,
      enabledEnvironments: Object.freeze(['simulation'] as const),
    });
    const connector = new RestGovernedConnector({
      definition: restricted,
      fixtures: [{ operation: 'generation', filename: 'generation.json' }],
    });
    const context = createConnectorRequestContext({
      operation: 'generation',
      providerId: restricted.providerId,
      environment: 'production_candidate',
    });
    const result = await connector.fetch('generation', {}, context);
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.code, 'ENVIRONMENT_RESTRICTED');
    }
  });

  it('migrates representative domain connectors', async () => {
    const registry = createGovernedConnectorRegistry();
    const migrated = bootstrapWave4MigratedConnectors(registry);
    assert.equal(migrated.length, 4);
    const ids = migrated.map((c) => c.definition.providerId).sort();
    assert.deepEqual(ids, [
      'arbeitnow',
      'national-grid-eso',
      'noozra',
      'usda-fooddata-central',
    ]);

    for (const connector of migrated) {
      const operation =
        connector.definition.providerId === 'national-grid-eso'
          ? 'generation'
          : connector.definition.providerId === 'usda-fooddata-central'
            ? 'search'
            : connector.definition.providerId === 'arbeitnow'
              ? 'jobs'
              : 'intelligence';
      const context = createConnectorRequestContext({
        operation,
        providerId: connector.definition.providerId,
      });
      const result = await connector.fetch(operation, {}, context);
      assert.equal(result.ok, true);
    }
  });

  it('applies license persistence policy on definition', () => {
    const catalog = loadCatalogFromYaml();
    const entry = getCatalogEntry(catalog, 'usda-fooddata-central');
    assert.ok(entry);
    const definition = catalogEntryToProviderDefinition(entry);
    assert.ok(definition.license.persistencePolicy);
    assert.equal(definition.license.commercialUse, 'verified_allowed');
  });
});
