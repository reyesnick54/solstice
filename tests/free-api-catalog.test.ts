import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { parse as parseYaml } from 'yaml';
import {
  AUTHORITY_CLASSES,
  CATALOG_PATH,
  EXPECTED_PROVIDER_COUNT,
  LAUNCH_TIERS,
  PRIORITIES,
  SUNREY_DOMAINS,
  VERIFICATION_STATUSES,
  computeCatalogStats,
  loadCatalog,
  validateCatalog,
} from '../scripts/lib/free-api-catalog-validator.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

function sampleProvider(overrides = {}) {
  return {
    provider_id: 'sample-provider',
    name: 'Sample Provider',
    short_name: 'Sample',
    description: 'Fixture provider for catalog validation tests.',
    primary_category: 'macroeconomics',
    capabilities: ['economic_indicators'],
    endpoints: {
      base_url: 'https://api.example.com',
      api_version: 'v1',
      documentation_url: 'https://docs.example.com',
      status_url: null,
    },
    authentication: {
      type: 'api_key',
      required: true,
      registration_required: true,
      environment_variable: 'SAMPLE_PROVIDER_API_KEY',
      notes: null,
    },
    access: {
      status: 'free_tier',
      free_tier_verified: false,
      registration_required: true,
      notes: null,
    },
    commercial_use: {
      status: 'unclear',
      notes: 'Fixture only.',
    },
    redistribution: {
      status: 'unknown',
      notes: null,
    },
    rate_limits: {
      documented: false,
      requests_per_second: null,
      requests_per_minute: null,
      requests_per_hour: null,
      requests_per_day: null,
      monthly_quota: null,
      concurrency_limit: null,
      notes: null,
    },
    data_characteristics: {
      freshness: null,
      geographic_scope: ['US'],
      historical_data: true,
      realtime: false,
      data_format: 'json',
      notes: null,
    },
    sunrey: {
      domain: ['world', 'grow'],
      canonical_provider_interface: 'MacroDataProvider',
      priority: 'high',
      launch_tier: 'research_only',
      authority_class: 'reference_data',
      integration_state: 'catalog_only',
      existing_adapter: null,
    },
    verification: {
      status: 'unverified',
      verified_against_official_docs: false,
      last_verified: null,
      notes: 'Test fixture.',
    },
    ...overrides,
  };
}

function baseCatalog(providers: Record<string, unknown>[] = []) {
  return {
    schema_version: '1.0.0',
    catalog_id: 'sunrey-free-api-catalog',
    expected_provider_count: EXPECTED_PROVIDER_COUNT,
    population_status: providers.length === EXPECTED_PROVIDER_COUNT ? 'populated' : 'partial',
    providers,
  };
}

describe('free API provider catalog', () => {
  it('catalog YAML can be parsed', () => {
    const text = readFileSync(join(ROOT, CATALOG_PATH), 'utf8');
    const catalog = parseYaml(text);
    assert.equal(typeof catalog, 'object');
    assert.ok(Array.isArray(catalog.providers));
  });

  it('repository catalog passes framework validation', () => {
    const { catalog } = loadCatalog(ROOT);
    const result = validateCatalog(catalog);
    assert.equal(result.ok, true, result.errors.join('\n'));
    assert.equal(catalog.population_status, 'partial');
    assert.equal(result.stats.total, 8);
    assert.equal(result.stats.byCategory.foreign_exchange, 8);
    assert.ok(result.stats.total >= 9);
  });

  it('requires unique provider_id values', () => {
    const providers = [
      sampleProvider({ provider_id: 'dup' }),
      sampleProvider({ provider_id: 'dup', name: 'Duplicate Provider' }),
    ];
    const result = validateCatalog(baseCatalog(providers));
    assert.equal(result.ok, false);
    assert.ok(result.errors.some((e: string) => e.includes('duplicate provider_id')));
  });

  it('requires required provider fields', () => {
    const incomplete = { provider_id: 'incomplete' };
    const result = validateCatalog(baseCatalog([incomplete]));
    assert.equal(result.ok, false);
    assert.ok(result.errors.some((e: string) => e.includes('required field missing')));
  });

  it('enforces populated provider count of 126', () => {
    const result = validateCatalog({
      ...baseCatalog([sampleProvider()]),
      population_status: 'populated',
    });
    assert.equal(result.ok, false);
    assert.ok(result.errors.some((e: string) => e.includes('expected 126')));
  });

  it('rejects duplicate provider names', () => {
    const providers = [
      sampleProvider({ provider_id: 'one', name: 'Same Name' }),
      sampleProvider({ provider_id: 'two', name: 'same name' }),
    ];
    const result = validateCatalog(baseCatalog(providers));
    assert.equal(result.ok, false);
    assert.ok(result.errors.some((e: string) => e.includes('duplicate provider name')));
  });

  it('rejects invalid authority classes', () => {
    const provider = sampleProvider({
      sunrey: {
        ...sampleProvider().sunrey,
        authority_class: 'financial_execution_authority',
      },
    });
    const result = validateCatalog(baseCatalog([provider]));
    assert.equal(result.ok, false);
    assert.ok(result.errors.some((e: string) => e.includes('authority class')));
    for (const value of AUTHORITY_CLASSES) {
      const okProvider = sampleProvider({
        provider_id: `auth-${value}`,
        sunrey: { ...sampleProvider().sunrey, authority_class: value },
      });
      const okResult = validateCatalog(baseCatalog([okProvider]));
      assert.equal(okResult.ok, true, `authority class ${value} should be valid`);
    }
  });

  it('rejects invalid SunRey domains', () => {
    const provider = sampleProvider({
      sunrey: {
        ...sampleProvider().sunrey,
        domain: ['frontend_direct'],
      },
    });
    const result = validateCatalog(baseCatalog([provider]));
    assert.equal(result.ok, false);
    assert.ok(result.errors.some((e: string) => e.includes('SunRey domain')));
    for (const domain of SUNREY_DOMAINS) {
      const okProvider = sampleProvider({
        provider_id: `domain-${domain}`,
        sunrey: { ...sampleProvider().sunrey, domain: [domain] },
      });
      const okResult = validateCatalog(baseCatalog([okProvider]));
      assert.equal(okResult.ok, true, `domain ${domain} should be valid`);
    }
  });

  it('rejects invalid priorities', () => {
    const provider = sampleProvider({
      sunrey: { ...sampleProvider().sunrey, priority: 'urgent' },
    });
    const result = validateCatalog(baseCatalog([provider]));
    assert.equal(result.ok, false);
    assert.ok(result.errors.some((e: string) => e.includes('priority')));
    for (const priority of PRIORITIES) {
      const okProvider = sampleProvider({
        provider_id: `priority-${priority}`,
        sunrey: { ...sampleProvider().sunrey, priority },
      });
      const okResult = validateCatalog(baseCatalog([okProvider]));
      assert.equal(okResult.ok, true);
    }
  });

  it('rejects invalid launch tiers', () => {
    const provider = sampleProvider({
      sunrey: { ...sampleProvider().sunrey, launch_tier: 'immediate_production' },
    });
    const result = validateCatalog(baseCatalog([provider]));
    assert.equal(result.ok, false);
    assert.ok(result.errors.some((e: string) => e.includes('launch tier')));
    for (const tier of LAUNCH_TIERS) {
      const okProvider = sampleProvider({
        provider_id: `tier-${tier}`,
        sunrey: { ...sampleProvider().sunrey, launch_tier: tier },
      });
      const okResult = validateCatalog(baseCatalog([okProvider]));
      assert.equal(okResult.ok, true);
    }
  });

  it('rejects invalid verification states', () => {
    const provider = sampleProvider({
      verification: { ...sampleProvider().verification, status: 'maybe_verified' },
    });
    const result = validateCatalog(baseCatalog([provider]));
    assert.equal(result.ok, false);
    assert.ok(result.errors.some((e: string) => e.includes('verification status')));
    for (const status of VERIFICATION_STATUSES) {
      const okProvider = sampleProvider({
        provider_id: `verify-${status}`,
        verification: { ...sampleProvider().verification, status },
      });
      const okResult = validateCatalog(baseCatalog([okProvider]));
      assert.equal(okResult.ok, true);
    }
  });

  it('rejects embedded secrets', () => {
    const provider = sampleProvider({
      authentication: {
        ...sampleProvider().authentication,
        notes: 'accidentally committed api_key=SUPERFAKE_TEST_SECRET_VALUE_DO_NOT_USE_12345',
      },
    });
    const result = validateCatalog(baseCatalog([provider]));
    assert.equal(result.ok, false);
    assert.ok(result.errors.some((e: string) => e.includes('secret')));
  });

  it('allows environment variable name references', () => {
    const provider = sampleProvider({
      authentication: {
        type: 'api_key',
        required: true,
        registration_required: true,
        environment_variable: 'FRED_API_KEY',
        notes: null,
      },
    });
    const result = validateCatalog(baseCatalog([provider]));
    assert.equal(result.ok, true);
  });

  it('validates URL syntax and permits null URLs', () => {
    const badUrl = sampleProvider({
      endpoints: {
        ...sampleProvider().endpoints,
        base_url: 'not-a-url',
      },
    });
    const badResult = validateCatalog(baseCatalog([badUrl]));
    assert.equal(badResult.ok, false);
    assert.ok(badResult.errors.some((e: string) => e.includes('invalid URL')));

    const nullUrl = sampleProvider({
      provider_id: 'null-urls',
      endpoints: {
        base_url: null,
        api_version: null,
        documentation_url: null,
        status_url: null,
      },
    });
    const nullResult = validateCatalog(baseCatalog([nullUrl]));
    assert.equal(nullResult.ok, true);
  });

  it('permits unknown and null values where information is not verified', () => {
    const provider = sampleProvider({
      commercial_use: { status: 'unknown', notes: null },
      redistribution: { status: 'unknown', notes: null },
      verification: {
        status: 'unverified',
        verified_against_official_docs: false,
        last_verified: null,
        notes: 'Awaiting official documentation review.',
      },
      data_characteristics: {
        freshness: null,
        geographic_scope: [],
        historical_data: null,
        realtime: null,
        data_format: null,
        notes: null,
      },
    });
    const result = validateCatalog(baseCatalog([provider]));
    assert.equal(result.ok, true);
  });

  it('computes category statistics from providers', () => {
    const providers = [
      sampleProvider({ provider_id: 'a', primary_category: 'macroeconomics' }),
      sampleProvider({ provider_id: 'b', primary_category: 'weather', name: 'Weather Provider' }),
    ];
    const stats = computeCatalogStats(baseCatalog(providers));
    assert.equal(stats.total, 2);
    assert.equal(stats.byCategory.macroeconomics, 1);
    assert.equal(stats.byCategory.weather, 1);
    assert.equal(stats.authRequired, 2);
  });
});
