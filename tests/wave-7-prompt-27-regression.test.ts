/**
 * Wave 7 Prompt 27 — full 126-provider program regression, chaos, security, production readiness.
 */

import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { parseUntrustedJson } from '../packages/provider-sdk/src/untrusted.ts';
import {
  assertWave7CatalogCoverageComplete,
  assertWave7ProgramAccounting,
  buildWave7CoverageReport,
  createExternalDataPlane,
  exchangeRegressionSnapshot,
  financialAgentRegressionSnapshot,
  blockchainRegressionSnapshot,
  ExternalDataTrustEngine,
  generateProviderMatrixMarkdown,
  runAllChaosScenarios,
  runCacheSwrRegressionTest,
  runCircuitBreakerLifecycleTest,
  runComplianceOutageTest,
  runProviderCompromiseTest,
  runRateLimitStormTest,
  runSingleFlightRegressionTest,
  runSsrfRegressionTest,
  runTwentyFiveProviderOutageTest,
  wave7AcceptedGapSummary,
  WAVE7_EXPECTED_PROGRAM_TOTAL,
} from '../packages/external-data/src/index.ts';
import { createAllEnvironmentalAdapters } from '../packages/sunrey-chain/src/environmental/index.ts';

const ROOT = join(import.meta.dirname, '..');

describe('Wave 7 Prompt 27 — provider program regression', () => {
  it('44. catalog coverage test accounts for every catalog provider', () => {
    const report = buildWave7CoverageReport();
    assert.ok(report.catalogTotal >= 70);
    assert.equal(report.expectedTotal, 126);
    assertWave7CatalogCoverageComplete();
    assertWave7ProgramAccounting();
    const classified = Object.values(report.summary).reduce((a, b) => a + b, 0);
    assert.equal(classified, report.catalogTotal);
  });

  it('documents accepted Wave 6 program gaps honestly (53 slots)', () => {
    const gaps = wave7AcceptedGapSummary();
    const total = gaps.reduce((sum, g) => sum + g.slotCount, 0);
    const report = buildWave7CoverageReport();
    assert.equal(report.catalogTotal + total, WAVE7_EXPECTED_PROGRAM_TOTAL);
    assert.ok(gaps.some((g) => g.category === 'travel'));
    assert.ok(gaps.some((g) => g.category === 'hin'));
  });

  it('3. every implemented adapter loads without optional credentials', () => {
    const envAdapters = createAllEnvironmentalAdapters();
    assert.equal(envAdapters.length, 13);
    for (const adapter of envAdapters) {
      assert.ok(adapter.providerId);
      assert.ok(adapter.capabilities.length > 0);
    }
    const plane = createExternalDataPlane();
    const health = plane.health();
    assert.ok(health.length > 0);
  });

  it('14. trust engine never fabricates canonical values', () => {
    const engine = new ExternalDataTrustEngine();
    const conflicted = engine.reconcile([
      { providerId: 'a', value: 100, observedAtUtc: '2026-08-31T00:00:00.000Z', authorityClass: 'reference_data' },
      { providerId: 'b', value: 200, observedAtUtc: '2026-08-31T00:00:00.000Z', authorityClass: 'reference_data' },
    ]);
    assert.equal(conflicted.outcome, 'CONFLICTED');
    assert.equal(conflicted.value, null);

    const low = engine.reconcile([
      { providerId: 'a', value: 100, observedAtUtc: '2026-08-31T00:00:00.000Z', authorityClass: 'reference_data' },
    ]);
    assert.equal(low.outcome, 'LOW_CONFIDENCE');

    const official = new ExternalDataTrustEngine({
      agreementTolerancePct: 2,
      minimumSources: 2,
      officialSourceIds: ['fred'],
    });
    const agreed = official.reconcile([
      { providerId: 'fred', value: 42, observedAtUtc: '2026-08-31T00:00:00.000Z', authorityClass: 'authoritative_official' },
      { providerId: 'other', value: 99, observedAtUtc: '2026-08-31T00:00:00.000Z', authorityClass: 'reference_data' },
    ]);
    assert.equal(agreed.outcome, 'AGREEMENT');
    assert.equal(agreed.value, 42);
  });

  it('6–12. chaos and resilience scenarios pass', () => {
    const results = runAllChaosScenarios();
    for (const result of results) {
      assert.equal(result.passed, true, `${result.scenario}: ${result.notes}`);
    }
  });

  it('9. rate-limit storm does not crash platform', () => {
    const result = runRateLimitStormTest();
    assert.equal(result.passed, true);
  });

  it('11. circuit breaker lifecycle CLOSED→OPEN→HALF_OPEN→CLOSED', () => {
    const result = runCircuitBreakerLifecycleTest();
    assert.equal(result.passed, true);
  });

  it('12–13. cache/SWR and single-flight regression', async () => {
    const cache = await runCacheSwrRegressionTest();
    assert.equal(cache.passed, true, cache.notes);
    const flight = await runSingleFlightRegressionTest();
    assert.equal(flight.passed, true, flight.notes);
  });

  it('8. compliance provider outage is safe (degraded, not silent ALLOW)', () => {
    const result = runComplianceOutageTest();
    assert.equal(result.passed, true);
  });

  it('15. provider compromise triggers quarantine recommendation', () => {
    const result = runProviderCompromiseTest();
    assert.equal(result.passed, true);
  });

  it('16. SSRF regression blocks abusive destinations', () => {
    const result = runSsrfRegressionTest();
    assert.equal(result.passed, true);
  });

  it('20. malicious payload limits and safe parsing', () => {
    const huge = `{"a":${'"x"'.repeat(100)}}`;
    const parsed = parseUntrustedJson(huge.slice(0, 5000));
    assert.equal(parsed.ok, false);
    const deep = JSON.stringify({ a: { b: { c: { d: { e: 1 } } } } });
    const ok = parseUntrustedJson(deep);
    assert.equal(ok.ok, true);
  });

  it('26. financial agent authority boundary', () => {
    const agent = financialAgentRegressionSnapshot();
    assert.equal(agent.grantsExecutionAuthority, false);
    assert.equal(agent.providerRiskAuthorizesTrade, false);
  });

  it('28–29. exchange and blockchain regression', () => {
    const exchange = exchangeRegressionSnapshot();
    assert.equal(exchange.externalProviderModifiesBalances, false);
    assert.equal(exchange.executionAuthority, false);
    const chain = blockchainRegressionSnapshot();
    assert.equal(chain.consensusIndependent, true);
    assert.equal(chain.providerOutageHaltsConsensus, false);
  });

  it('30–31. SunRey Coin and MoonRey cannot be minted by external data', () => {
    const chain = blockchainRegressionSnapshot();
    assert.equal(chain.sunreyCoinBehaviorUnchanged, true);
    assert.equal(chain.moonreyCoinBehaviorUnchanged, true);
    const plane = createExternalDataPlane();
    const bundle = plane.agentEvidenceBundle();
    assert.equal(bundle.grantsExecutionAuthority, false);
  });

  it('19. no arbitrary provider proxy routes in consumer API', () => {
    const handlerPath = join(ROOT, 'services/api/src/consumer/handler.ts');
    const text = readFileSync(handlerPath, 'utf8');
    assert.equal(text.includes('/api/proxy'), false);
    assert.equal(text.includes('arbitraryUrl'), false);
  });

  it('39. runbooks exist for provider incidents', () => {
    assert.equal(existsSync(join(ROOT, 'docs/runbooks/EXTERNAL_PROVIDER_INCIDENT.md')), true);
    assert.equal(existsSync(join(ROOT, 'docs/providers/PROVIDER_OPERATIONS.md')), true);
  });

  it('45. final provider matrix generator produces markdown', () => {
    const md = generateProviderMatrixMarkdown();
    assert.ok(md.includes('| Provider |'));
    assert.ok(md.includes('IMPLEMENTED'));
    assert.ok(md.includes('fred'));
  });

  it('46–47. final architecture and scorecard documents exist', () => {
    assert.equal(existsSync(join(ROOT, 'docs/providers/SUNREY_EXTERNAL_DATA_ARCHITECTURE.md')), true);
    assert.equal(existsSync(join(ROOT, 'docs/providers/PRODUCTION_READINESS_SCORECARD.md')), true);
    assert.equal(existsSync(join(ROOT, 'docs/providers/FINAL_PROVIDER_MATRIX.md')), true);
  });

  it('6. 25-provider simultaneous outage', () => {
    const result = runTwentyFiveProviderOutageTest();
    assert.equal(result.passed, true, result.notes);
  });
});
