import assert from 'node:assert/strict';
import { describe, it, afterEach } from 'node:test';

import { asUtcInstant } from '../packages/domain/src/time.ts';
import { FINNHUB_CREDENTIAL_ENV_VAR } from '../packages/sunrey-exchange/src/capital-market/adapters/finnhub-adapter.ts';
import { createFinnhubCapitalMarketAdapter } from '../packages/sunrey-exchange/src/capital-market/adapters/finnhub-adapter.ts';
import { MARKET_DATA_CERTIFICATION_STATES } from '../packages/provider-sdk/src/market-data-capability/certification-states.ts';
import { buildMarketDataProviderCapability } from '../packages/provider-sdk/src/market-data-capability/build-from-catalog.ts';
import { loadHeliosMarketDataCertificationCatalog } from '../packages/external-data/src/certification/market-data/catalog.ts';
import { runMarketDataQualificationHarness } from '../packages/external-data/src/certification/market-data/harness.ts';
import { guardExternalMarketDataFetch } from '../packages/external-data/src/certification/market-data/fetch-guard.ts';
import { createExternalMarketDataCertificationRuntime } from '../packages/external-data/src/certification/market-data/runtime.ts';
import { getCatalogEntry, loadCatalogFromYaml } from '../packages/provider-sdk/src/catalog/loader.ts';
import {
  evaluateAaf07MarketDataQualification,
  HELIOS_AAF07_EXTERNAL_MARKET_DATA_CERTIFICATION_QUALIFIED,
} from '../packages/platform/src/helios/observation/market-data-certification/qualification.ts';
import { createHeliosExternalMarketDataCertificationService } from '../packages/platform/src/helios/observation/market-data-certification/service.ts';

const NOW = asUtcInstant('2026-09-16T12:00:00.000Z');

function finnhubFetchOk(): typeof fetch {
  return async () =>
    new Response(JSON.stringify({ c: 227.5, o: 226.5, h: 228.5, l: 225.5, pc: 227, t: 1_726_502_400 }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
}

function finnhubFetchRateLimited(): typeof fetch {
  return async () =>
    new Response(JSON.stringify({ error: 'rate limit' }), {
      status: 429,
      headers: { 'content-type': 'application/json' },
    });
}

function marketDataFetchOk(): typeof fetch {
  return async (input) => {
    const url = String(input);
    if (url.includes('finnhub')) {
      return finnhubFetchOk()(input);
    }
    if (url.includes('coingecko')) {
      return new Response(JSON.stringify({ bitcoin: { usd: 65000 } }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    return new Response('{}', { status: 404 });
  };
}

describe('HELIOS AAF07 external market-data certification', () => {
  const originalFinnhub = process.env[FINNHUB_CREDENTIAL_ENV_VAR];

  afterEach(() => {
    if (originalFinnhub === undefined) {
      delete process.env[FINNHUB_CREDENTIAL_ENV_VAR];
    } else {
      process.env[FINNHUB_CREDENTIAL_ENV_VAR] = originalFinnhub;
    }
  });

  it('declares certification states without regulatory-approval naming', () => {
    assert.equal(MARKET_DATA_CERTIFICATION_STATES.includes('PAPER_DATA_APPROVED'), true);
    assert.equal(MARKET_DATA_CERTIFICATION_STATES.includes('REGULATORY_APPROVED' as never), false);
    assert.equal(MARKET_DATA_CERTIFICATION_STATES.length, 10);
  });

  it('loads overlay catalog with finnhub and coingecko providers', () => {
    const overlay = loadHeliosMarketDataCertificationCatalog();
    assert.equal(overlay.catalog_id, 'helios-external-market-data-certification');
    assert.equal(overlay.providers.length >= 2, true);
  });

  it('runs thirteen-proof harness for finnhub with injected transport', async () => {
    process.env[FINNHUB_CREDENTIAL_ENV_VAR] = 'test-key';
    const overlay = loadHeliosMarketDataCertificationCatalog();
    const finnhubOverlay = overlay.providers.find((row) => row.provider_id === 'finnhub');
    assert.ok(finnhubOverlay);
    const catalog = loadCatalogFromYaml();
    const catalogEntry = getCatalogEntry(catalog, 'finnhub');
    const provider = createFinnhubCapitalMarketAdapter({ fetchFn: finnhubFetchOk() });
    const harness = await runMarketDataQualificationHarness({
      overlay: finnhubOverlay,
      catalogEntry,
      provider,
      nowUtc: NOW,
    });
    assert.equal(harness.proofs.length, 13);
    assert.equal(harness.allPassed, true);
    assert.equal(harness.secretValuePresent, false);
  });

  it('rejects silent fixture fallback on external_live guard', () => {
    const guard = guardExternalMarketDataFetch({
      routeClass: 'external_live',
      primaryFailed: true,
      attemptedFixtureFallback: true,
      fixtureLabeled: false,
      environment: 'production',
      explicitSimulationAllowed: false,
    });
    assert.equal(guard.allowed, false);
    assert.equal(guard.failureCode, 'SILENT_SIMULATION_REJECTED');
  });

  it('surfaces degraded fetch without fixture substitution', async () => {
    process.env[FINNHUB_CREDENTIAL_ENV_VAR] = 'test-key';
    const runtime = createExternalMarketDataCertificationRuntime({ fetchFn: finnhubFetchRateLimited() });
    const outcome = await runtime.fetchExternalObservation('finnhub', 'SECURITY:US:AAPL:XNAS', NOW);
    assert.equal(outcome.status, 'DEGRADED');
    if (outcome.status !== 'OK') {
      assert.equal(outcome.code, 'RATE_LIMITED');
      assert.equal(outcome.silentFixtureRejected, false);
    }
  });

  it('emits qualification marker when program checks pass', async () => {
    process.env[FINNHUB_CREDENTIAL_ENV_VAR] = 'test-key';
    const service = createHeliosExternalMarketDataCertificationService({ fetchFn: marketDataFetchOk() });
    const finnhub = await service.certifyProvider('finnhub', NOW);
    assert.ok(finnhub);
    const coingecko = await service.certifyProvider('coingecko', NOW);
    assert.ok(coingecko);
    const qualification = service.evaluateProgramQualification({
      finnhubHarnessPassed: finnhub.harness.allPassed,
      coingeckoHarnessPassed: coingecko.harness.allPassed,
      silentFixtureGuardPassed: true,
      healthEvidenceSealed: finnhub.healthEvidence.harnessDigest.length > 0,
      metricsRecorded: service.runtime().metrics().recorder !== undefined,
    });
    assert.equal(qualification.marker, HELIOS_AAF07_EXTERNAL_MARKET_DATA_CERTIFICATION_QUALIFIED);
    assert.equal(qualification.qualified, true);
  });

  it('builds MarketDataProviderCapability contract fields from catalog', () => {
    const overlay = loadHeliosMarketDataCertificationCatalog().providers.find((row) => row.provider_id === 'finnhub');
    assert.ok(overlay);
    const catalogEntry = getCatalogEntry(loadCatalogFromYaml(), 'finnhub');
    const capability = buildMarketDataProviderCapability({
      overlay,
      catalogEntry,
      credentialConfigured: true,
      certificationState: 'PAPER_DATA_APPROVED',
      evaluatedAtUtc: NOW,
    });
    assert.equal(capability.providerId, 'finnhub');
    assert.equal(capability.quoteBarTrade.quotes, true);
    assert.equal(capability.entitlementReferences.length >= 1, true);
    assert.equal(capability.commercialUseStatus, 'restricted');
    assert.equal(capability.redistributionStatus, 'prohibited');
  });
});
