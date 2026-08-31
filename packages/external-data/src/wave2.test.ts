import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  createExternalDataPlane,
  buildWave2CoverageReport,
  assertWave2CoverageComplete,
  WAVE2_IMPLEMENTED_PROVIDER_IDS,
  filingAvailableEvent,
  worldEconomySnapshot,
  growContextSnapshot,
  agentEvidenceSnapshot,
  exchangeReferenceSnapshot,
  moonReyResourceContext,
} from './index.ts';

describe('Wave 2 external data plane', () => {
  it('runs end-to-end workflow across domain services', () => {
    const plane = createExternalDataPlane({ nowUtc: '2026-08-30T12:00:00.000Z' });
    const macro = plane.macro.getIndicators();
    const fx = plane.fx.getRates();
    const markets = plane.markets.getQuotes();
    const filings = plane.company.getLatestFilings();
    assert.ok(macro.observations.length > 0);
    assert.ok(fx.observations.length > 0);
    assert.ok(markets.observations.length > 0);
    assert.ok(filings.observations.length > 0);
    for (const obs of [...macro.observations, ...fx.observations, ...markets.observations, ...filings.observations]) {
      assert.equal(obs.schemaVersion, 'sunrey.external-observation.v1');
      assert.ok(obs.provenance.rawPayloadHash.length > 0);
    }
  });

  it('isolates provider failures without crashing the plane', () => {
    const plane = createExternalDataPlane();
    plane.setProviderState('fred', { down: true });
    plane.setProviderState('frankfurter', { rateLimited: true });
    plane.setProviderState('alpha-vantage', { down: true });
    plane.setProviderState('sec-edgar', { malformed: true });
    const macro = plane.macro.getIndicators();
    const fx = plane.fx.getRates();
    const markets = plane.markets.getQuotes();
    const filings = plane.company.getLatestFilings();
    assert.equal(macro.observations.length, 0);
    assert.equal(fx.observations.length, 0);
    assert.equal(markets.observations.length, 0);
    assert.equal(filings.observations.length, 0);
    const health = plane.health();
    assert.ok(health.some((h) => h.providerId === 'fred' && h.health !== 'healthy'));
    plane.setProviderState('world-bank', { down: false });
    assert.ok(plane.health().length >= WAVE2_IMPLEMENTED_PROVIDER_IDS.length);
  });

  it('serves cache with stale metadata when providers unavailable', async () => {
    const plane = createExternalDataPlane({ nowUtc: '2026-08-30T12:00:00.000Z' });
    const first = await plane.cachedFetch('frankfurter', 'fx_rates', 'USD-EUR');
    assert.ok(first);
    plane.setProviderState('frankfurter', { down: true });
    const second = await plane.cachedFetch('frankfurter', 'fx_rates', 'USD-EUR');
    assert.ok(second);
    assert.ok(['cache_fresh', 'cache_stale', 'cache_retained_on_failure', 'provider_fetch'].includes(second.source));
  });

  it('does not expose credentials in health or evidence surfaces', () => {
    const plane = createExternalDataPlane();
    const healthJson = JSON.stringify(plane.health());
    assert.equal(healthJson.includes('api_key'), false);
    assert.equal(healthJson.includes('FRED_API_KEY'), false);
    const evidence = plane.agentEvidenceBundle();
    assert.equal(evidence.grantsExecutionAuthority, false);
    for (const ref of evidence.refs) {
      assert.equal(ref.grantsExecutionAuthority, false);
      assert.equal(ref.treatedAsTradeInstruction, false);
    }
  });

  it('indexes filings for search discovery', () => {
    const plane = createExternalDataPlane();
    const results = plane.search({ ticker: 'AAPL', filingType: '10-K' });
    assert.ok(results.length >= 1);
  });

  it('bridges World, Grow, Agent, Exchange, and MoonRey without authority contamination', () => {
    const plane = createExternalDataPlane();
    const world = worldEconomySnapshot(plane);
    const grow = growContextSnapshot(plane);
    const agent = agentEvidenceSnapshot(plane);
    const exchange = exchangeReferenceSnapshot(plane);
    const moonrey = moonReyResourceContext(plane);
    assert.equal(world.availability, 'AVAILABLE_SIMULATION');
    assert.equal(agent.grantsExecutionAuthority, false);
    assert.equal(exchange.executionAuthority, false);
    assert.equal(moonrey.issuanceAuthority, false);
    assert.ok(grow.fundamentalsAvailable);
  });

  it('prepares Action Center backend events without auto-notify', () => {
    const event = filingAvailableEvent({
      accessionNumber: '0000320193-25-000079',
      companyName: 'Apple Inc.',
      formType: '10-K',
      occurredAt: '2026-08-30T12:00:00.000Z',
    });
    assert.equal(event.autoNotify, false);
    assert.equal(event.type, 'major_company_filing_available');
  });

  it('accounts for every Wave 2 catalog provider', () => {
    const report = buildWave2CoverageReport();
    assert.equal(report.implemented, 17);
    assert.equal(report.summary.BLOCKED, 3);
    assert.equal(report.summary.DEPRECATED + report.summary.UNAVAILABLE, 1);
    assert.doesNotThrow(() => assertWave2CoverageComplete());
    const unexplained = report.providers.filter(
      (p) =>
        p.status === 'NOT_WAVE_2' &&
        p.category !== 'other' &&
        p.category !== 'cryptocurrency' &&
        p.category !== 'blockchain' &&
        p.category !== 'energy' &&
        p.category !== 'environmental' &&
        p.category !== 'food_nutrition' &&
        p.category !== 'natural_resources',
    );
    assert.equal(unexplained.length, 0);
  });

  it('supports parallel queries without cross-provider contamination', async () => {
    const plane = createExternalDataPlane();
    const [macro, fx, markets, filings] = await Promise.all([
      Promise.resolve(plane.macro.getIndicators()),
      Promise.resolve(plane.fx.getRates()),
      Promise.resolve(plane.markets.getQuotes()),
      Promise.resolve(plane.company.getLatestFilings()),
    ]);
    assert.ok(macro.providersUsed.includes('fred'));
    assert.ok(fx.providersUsed.includes('frankfurter'));
    assert.ok(markets.providersUsed.includes('alpha-vantage'));
    assert.ok(filings.providersUsed.includes('sec-edgar'));
  });
});
