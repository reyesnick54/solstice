import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ProviderActivationPolicy } from './activation-policy.ts';
import { catalogEntryToDescriptor } from './catalog/loader.ts';
import { ProviderSdkException } from './errors.ts';
import { createProviderFactory } from './factory.ts';
import {
  MockFailingProvider,
  MockHealthyProvider,
  MockMalformedProvider,
  MockSlowProvider,
} from './mocks/index.ts';
import { ProviderRegistry } from './registry.ts';
import {
  createFixtureCatalogIndex,
  FIXTURE_CATALOG_ENTRIES,
  descriptorFromFixture,
} from './test-fixtures/catalog.ts';
import { loadCatalogFromYaml } from './catalog/loader.ts';
import type { ProviderRuntimeContext } from './types.ts';

const RUNTIME_CONTEXT: ProviderRuntimeContext = Object.freeze({
  environment: 'simulation',
  nowUtc: '2026-01-01T00:00:00.000Z',
  correlationId: 'test-correlation',
  catalogId: 'sunrey-free-api-catalog',
});

function healthyProvider() {
  return new MockHealthyProvider({
    id: FIXTURE_CATALOG_ENTRIES.healthy.provider_id,
    descriptor: descriptorFromFixture(FIXTURE_CATALOG_ENTRIES.healthy),
  });
}

describe('ProviderRegistry', () => {
  it('registers a catalog-backed provider', () => {
    const registry = new ProviderRegistry({ catalogIndex: createFixtureCatalogIndex() });
    const registration = registry.register(healthyProvider(), { activationMode: 'preview_only' });
    assert.equal(registration.descriptor.id, 'fixture-healthy');
    assert.equal(registry.has('fixture-healthy'), true);
  });

  it('rejects duplicate provider registration', () => {
    const registry = new ProviderRegistry({ catalogIndex: createFixtureCatalogIndex() });
    registry.register(healthyProvider(), { activationMode: 'preview_only' });
    assert.throws(
      () => registry.register(healthyProvider(), { activationMode: 'preview_only' }),
      (error: unknown) => error instanceof ProviderSdkException && error.code === 'PROVIDER_ALREADY_REGISTERED',
    );
  });

  it('looks up providers by id', () => {
    const registry = new ProviderRegistry({ catalogIndex: createFixtureCatalogIndex() });
    registry.register(healthyProvider(), { activationMode: 'preview_only' });
    assert.equal(registry.get('fixture-healthy')?.descriptor.name, 'Fixture Healthy Provider');
    assert.equal(registry.get('missing-provider'), undefined);
  });

  it('filters by category', () => {
    const registry = new ProviderRegistry({ catalogIndex: createFixtureCatalogIndex() });
    registry.register(healthyProvider(), { activationMode: 'preview_only' });
    registry.register(
      new MockHealthyProvider({
        id: FIXTURE_CATALOG_ENTRIES.failing.provider_id,
        descriptor: descriptorFromFixture(FIXTURE_CATALOG_ENTRIES.failing),
      }),
      { activationMode: 'preview_only' },
    );
    assert.equal(registry.listByCategory('macroeconomics').length, 1);
    assert.equal(registry.listByCategory('foreign_exchange').length, 1);
  });

  it('filters by capability', () => {
    const registry = new ProviderRegistry({ catalogIndex: createFixtureCatalogIndex() });
    registry.register(healthyProvider(), { activationMode: 'preview_only' });
    const matches = registry.listByCapability('inflation');
    assert.equal(matches.length, 1);
    assert.equal(matches[0]?.descriptor.id, 'fixture-healthy');
  });

  it('lists enabled providers only when activation allows runtime', () => {
    const registry = new ProviderRegistry({ catalogIndex: createFixtureCatalogIndex() });
    registry.register(healthyProvider(), { activationMode: 'preview_only' });
    registry.register(
      new MockHealthyProvider({
        id: FIXTURE_CATALOG_ENTRIES.failing.provider_id,
        descriptor: descriptorFromFixture(FIXTURE_CATALOG_ENTRIES.failing),
      }),
      { activationMode: 'disabled' },
    );
    assert.equal(registry.listEnabled().length, 1);
  });

  it('rejects unknown providers not present in catalog', () => {
    const registry = new ProviderRegistry({ catalogIndex: createFixtureCatalogIndex() });
    const unknown = new MockHealthyProvider({
      id: 'not-in-catalog',
      descriptor: catalogEntryToDescriptor(FIXTURE_CATALOG_ENTRIES.healthy, 'preview_only'),
    });
    Object.defineProperty(unknown, 'id', { value: 'not-in-catalog' });
    assert.throws(
      () => registry.register(unknown, { activationMode: 'preview_only' }),
      (error: unknown) => error instanceof ProviderSdkException && error.code === 'PROVIDER_NOT_IN_CATALOG',
    );
  });

  it('initializes and shuts down provider lifecycle', async () => {
    const registry = new ProviderRegistry({ catalogIndex: createFixtureCatalogIndex() });
    const provider = healthyProvider();
    registry.register(provider, { activationMode: 'enabled', featureFlagEnabled: true });
    await registry.initialize('fixture-healthy', RUNTIME_CONTEXT);
    const health = await registry.getHealth('fixture-healthy');
    assert.equal(health?.state, 'healthy');
    await registry.shutdown('fixture-healthy');
    assert.equal(registry.has('fixture-healthy'), false);
  });

  it('reports health contract from registered provider', async () => {
    const registry = new ProviderRegistry({ catalogIndex: createFixtureCatalogIndex() });
    registry.register(healthyProvider(), { activationMode: 'preview_only' });
    const health = await registry.getHealth('fixture-healthy');
    assert.equal(health?.providerId, 'fixture-healthy');
    assert.equal(health?.state, 'healthy');
  });

  it('lists production candidates from catalog metadata', () => {
    const registry = new ProviderRegistry({ catalogIndex: createFixtureCatalogIndex() });
    registry.register(healthyProvider(), { activationMode: 'preview_only' });
    registry.register(
      new MockHealthyProvider({
        id: FIXTURE_CATALOG_ENTRIES.failing.provider_id,
        descriptor: descriptorFromFixture(FIXTURE_CATALOG_ENTRIES.failing),
      }),
      { activationMode: 'preview_only' },
    );
    assert.equal(registry.listProductionCandidates().length, 1);
  });

  it('prevents blocked providers from activating', () => {
    const registry = new ProviderRegistry({ catalogIndex: createFixtureCatalogIndex() });
    const blocked = new MockHealthyProvider({
      id: FIXTURE_CATALOG_ENTRIES.blocked.provider_id,
      descriptor: descriptorFromFixture(FIXTURE_CATALOG_ENTRIES.blocked),
    });
    assert.throws(
      () => registry.register(blocked, { activationMode: 'preview_only' }),
      (error: unknown) => error instanceof ProviderSdkException && error.code === 'PROVIDER_BLOCKED',
    );
  });

  it('rejects providers with mismatched descriptor metadata', () => {
    const registry = new ProviderRegistry({ catalogIndex: createFixtureCatalogIndex() });
    const provider = healthyProvider();
    Object.defineProperty(provider, 'descriptor', {
      value: descriptorFromFixture({
        ...FIXTURE_CATALOG_ENTRIES.healthy,
        provider_id: 'other-id',
      }),
    });
    assert.throws(
      () => registry.register(provider, { activationMode: 'preview_only' }),
      (error: unknown) => error instanceof ProviderSdkException && error.code === 'PROVIDER_METADATA_INVALID',
    );
  });

  it('never exposes secret values through descriptors', () => {
    const registry = new ProviderRegistry({ catalogIndex: createFixtureCatalogIndex() });
    registry.register(
      new MockHealthyProvider({
        id: FIXTURE_CATALOG_ENTRIES.credentialRequired.provider_id,
        descriptor: descriptorFromFixture(FIXTURE_CATALOG_ENTRIES.credentialRequired),
      }),
      {
        activationMode: 'preview_only',
        credentialAvailable: false,
      },
    );
    const descriptor = registry.getDescriptor('fixture-credential');
    assert.equal(descriptor?.secretReference?.environmentVariable, 'FIXTURE_WEATHER_API_KEY');
    assert.equal(descriptor?.secretReference?.resolved, false);
    assert.equal(JSON.stringify(descriptor).includes('sk_live'), false);
  });
});

describe('ProviderActivationPolicy', () => {
  it('downgrades production activation in simulation environment', () => {
    const policy = new ProviderActivationPolicy();
    const evaluation = policy.evaluate({
      catalogEntry: FIXTURE_CATALOG_ENTRIES.healthy,
      configuration: null,
      requestedMode: 'production_enabled',
      environment: 'simulation',
    });
    assert.equal(evaluation.allowed, false);
    assert.equal(evaluation.effectiveMode, 'preview_only');
  });

  it('blocks launch-tier blocked_pending_review providers', () => {
    const policy = new ProviderActivationPolicy();
    const evaluation = policy.evaluate({
      catalogEntry: FIXTURE_CATALOG_ENTRIES.blocked,
      configuration: null,
      requestedMode: 'enabled',
    });
    assert.equal(evaluation.effectiveMode, 'blocked');
    assert.equal(evaluation.allowed, false);
  });
});

describe('ProviderFactory', () => {
  it('resolves providers by capability without direct client imports', () => {
    const registry = new ProviderRegistry({ catalogIndex: createFixtureCatalogIndex() });
    registry.register(healthyProvider(), { activationMode: 'preview_only' });
    const factory = createProviderFactory(registry);
    const resolved = factory.listByCapability('macroeconomic_indicators');
    assert.equal(resolved.length, 1);
    assert.equal(resolved[0]?.descriptor.id, 'fixture-healthy');
  });
});

describe('catalog integration', () => {
  it('repository catalog loads and may be empty during Wave 0', () => {
    const index = loadCatalogFromYaml();
    assert.equal(index.catalog.population_status, 'awaiting_master_list');
    assert.equal(index.catalog.providers.length, 0);
  });

  it('provider IDs in fixtures are consistent with catalog index', () => {
    const index = createFixtureCatalogIndex();
    for (const entry of Object.values(FIXTURE_CATALOG_ENTRIES)) {
      assert.equal(index.byId.get(entry.provider_id)?.name, entry.name);
    }
  });
});

describe('mock providers', () => {
  it('mock healthy provider works offline', async () => {
    const provider = healthyProvider();
    await provider.initialize(RUNTIME_CONTEXT);
    const health = await provider.healthCheck();
    assert.equal(health.state, 'healthy');
    await provider.shutdown();
  });

  it('mock failing provider simulates failures', async () => {
    const provider = new MockFailingProvider({
      id: FIXTURE_CATALOG_ENTRIES.failing.provider_id,
      descriptor: descriptorFromFixture(FIXTURE_CATALOG_ENTRIES.failing),
      failInitialize: true,
      failHealth: true,
    });
    await assert.rejects(() => provider.initialize(RUNTIME_CONTEXT));
    const health = await provider.healthCheck();
    assert.equal(health.state, 'unhealthy');
  });

  it('mock slow provider simulates latency', async () => {
    const provider = new MockSlowProvider({
      id: FIXTURE_CATALOG_ENTRIES.healthy.provider_id,
      descriptor: descriptorFromFixture(FIXTURE_CATALOG_ENTRIES.healthy),
      healthDelayMs: 25,
    });
    const started = Date.now();
    const health = await provider.healthCheck();
    assert.ok(Date.now() - started >= 20);
    assert.ok((health.latencyMs ?? 0) >= 20);
  });

  it('mock malformed provider returns malformed health for contract testing', async () => {
    const provider = new MockMalformedProvider({
      id: FIXTURE_CATALOG_ENTRIES.healthy.provider_id,
      descriptor: descriptorFromFixture(FIXTURE_CATALOG_ENTRIES.healthy),
    });
    const health = await provider.healthCheck();
    assert.equal(health.state, 'unknown');
    assert.equal(health.checkedAt, 'not-an-iso-timestamp');
  });
});
