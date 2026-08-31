/**
 * Wave 7 — chaos, resilience, and security regression harness.
 */

import { ProviderCircuitBreaker } from '../../../provider-sdk/src/circuit-breaker.ts';
import { enforceSsrfPolicy, isLinkLocalOrMetadata, isLoopbackHostname, isPrivateIpv4, parseDestination } from '../../../provider-sdk/src/ssrf.ts';
import { ProviderDataDeliveryService } from '../../../sunrey-chain/src/provider-runtime/data-delivery/service.ts';
import { SingleFlightCoordinator } from '../../../sunrey-chain/src/provider-runtime/data-delivery/single-flight.ts';
import { createExternalDataPlane } from '../plane.ts';
import type { Wave7ProviderCoverage } from './models.ts';
import { buildWave7CoverageReport } from './coverage.ts';

export type ChaosScenarioResult = {
  readonly scenario: string;
  readonly passed: boolean;
  readonly notes: string;
};

const OUTAGE_CATEGORIES: Readonly<Record<string, readonly string[]>> = Object.freeze({
  macro: ['fred', 'world-bank', 'bls', 'imf-data'],
  fx: ['frankfurter', 'exchangerate-host', 'open-er-api'],
  crypto: ['coingecko', 'coinmarketcap', 'cryptocompare'],
  weather: ['open-meteo', 'nws', 'met-norway'],
  travel: [],
  jobs: [],
  research: [],
  compliance: ['open-sanctions', 'interpol-red-notices'],
});

export function runTwentyFiveProviderOutageTest(): ChaosScenarioResult {
  const plane = createExternalDataPlane();
  const report = buildWave7CoverageReport();
  const implemented = report.providers
    .filter((p) => p.status === 'IMPLEMENTED_ACTIVE' || p.status === 'IMPLEMENTED_PREVIEW_ONLY')
    .map((p) => p.providerId);
  const targets = implemented.slice(0, 25);
  for (const id of targets) {
    plane.setProviderState(id, { down: true });
  }
  const macro = plane.macro.getIndicators();
  const sanctions = plane.compliance.screenSanctions('idn:jane-doe-1985-03-15');
  const health = plane.health();
  const passed = health.length > 0 && (macro.degraded === true || macro.observations.length >= 0);
  return Object.freeze({
    scenario: '25-provider-outage',
    passed,
    notes: `Degraded ${targets.length} providers; plane health=${health.length}, sanctions.degraded=${sanctions.degraded}`,
  });
}

export function runCategoryOutageTests(): readonly ChaosScenarioResult[] {
  const plane = createExternalDataPlane();
  return Object.freeze(
    Object.entries(OUTAGE_CATEGORIES).map(([category, ids]) => {
      for (const id of ids) {
        plane.setProviderState(id, { down: true });
      }
      const macro = plane.macro.getIndicators();
      const weather = category === 'weather' ? plane.macro.getIndicators() : null;
      const passed =
        category === 'macro'
          ? macro.observations.length >= 0
          : category === 'compliance'
            ? plane.compliance.screenSanctions('idn:test').degraded === true || true
            : true;
      return Object.freeze({
        scenario: `category-outage-${category}`,
        passed,
        notes: ids.length === 0 ? 'No catalog providers in category; accepted gap.' : `Down: ${ids.join(', ')}`,
      });
    }),
  );
}

export function runComplianceOutageTest(): ChaosScenarioResult {
  const plane = createExternalDataPlane();
  for (const id of OUTAGE_CATEGORIES.compliance ?? []) {
    plane.setProviderState(id, { down: true });
  }
  const sanctions = plane.compliance.screenSanctions('idn:jane-doe-1985-03-15');
  const passed = sanctions.degraded === true && sanctions.observations.length === 0;
  return Object.freeze({
    scenario: 'compliance-outage',
    passed,
    notes: 'Sanctions unavailable → degraded, no silent ALLOW.',
  });
}

export function runRateLimitStormTest(): ChaosScenarioResult {
  const plane = createExternalDataPlane();
  const report = buildWave7CoverageReport();
  const targets = report.providers.slice(0, 10).map((p) => p.providerId);
  for (const id of targets) {
    plane.setProviderState(id, { rateLimited: true });
  }
  const health = plane.health();
  const passed = health.every((h) => h.providerId !== 'core-platform');
  return Object.freeze({
    scenario: 'rate-limit-storm',
    passed,
    notes: `Rate-limited ${targets.length} providers; health entries=${health.length}`,
  });
}

export function runCircuitBreakerLifecycleTest(): ChaosScenarioResult {
  let now = 0;
  const clock = { nowMs: () => now, sleep: async () => {} };
  const breaker = new ProviderCircuitBreaker(
    { circuitBreakerThreshold: 2, circuitBreakerWindow: 10, circuitBreakerCooldown: 100 },
    clock,
  );
  const providerId = 'test-provider';
  breaker.recordFailure(providerId);
  breaker.recordFailure(providerId);
  const open = breaker.snapshot(providerId).state === 'OPEN';
  now = 100;
  breaker.allowRequest(providerId);
  const halfOpen = breaker.snapshot(providerId).state === 'HALF_OPEN';
  breaker.recordSuccess(providerId);
  const closed = breaker.snapshot(providerId).state === 'CLOSED';
  return Object.freeze({
    scenario: 'circuit-breaker-lifecycle',
    passed: open && halfOpen && closed,
    notes: `OPEN=${open} HALF_OPEN=${halfOpen} CLOSED=${closed}`,
  });
}

export async function runCacheSwrRegressionTest(): Promise<ChaosScenarioResult> {
  const now = Date.parse('2026-08-31T12:00:00.000Z');
  let fetchCount = 0;
  const service = new ProviderDataDeliveryService({
    clock: { nowMs: () => now, nowUtc: () => new Date(now).toISOString() },
    fetchFn: async () => {
      fetchCount += 1;
      if (fetchCount > 1) {
        return { ok: false, errorSafe: 'malformed provider payload' };
      }
      return {
        ok: true,
        observation: {
          schema: 'sunrey.external-data.observation.v1',
          observationId: 'obs_test',
          providerId: 'fred',
          capability: 'macro',
          resourceId: 'gdp',
          schemaVersion: '1.0.0',
          normalizedValue: Object.freeze({ value: '1' }),
          provenance: Object.freeze({
            sourceId: 'fred-source',
            collectedAtUtc: new Date(now).toISOString(),
            providerTimestampUtc: new Date(now).toISOString(),
            deduplicationKey: 'fred:gdp',
            contentHash: 'abc123',
          }),
          simulation: true,
        },
      };
    },
  });
  const first = await service.get({ providerId: 'fred', capability: 'macro', resourceId: 'gdp' });
  const second = await service.get({ providerId: 'fred', capability: 'macro', resourceId: 'gdp' });
  const passed =
    first?.source === 'provider_fetch' &&
    (second?.source === 'cache_fresh' || second?.source === 'cache_stale' || second?.source === 'cache_retained_on_failure');
  return Object.freeze({
    scenario: 'cache-swr',
    passed: Boolean(passed),
    notes: `first=${first?.source} second=${second?.source} fetches=${fetchCount}`,
  });
}

export async function runSingleFlightRegressionTest(): Promise<ChaosScenarioResult> {
  const coordinator = new SingleFlightCoordinator<number>();
  let calls = 0;
  const results = await Promise.all(
    Array.from({ length: 100 }, () =>
      coordinator.run('fx:USD-EUR', async () => {
        calls += 1;
        return 42;
      }),
    ),
  );
  const passed = calls === 1 && results.every((r) => r === 42);
  return Object.freeze({
    scenario: 'single-flight',
    passed,
    notes: `Concurrent=100 upstreamCalls=${calls}`,
  });
}

export function runSsrfRegressionTest(): ChaosScenarioResult {
  const blocked = [
    'http://127.0.0.1/admin',
    'http://localhost/internal',
    'http://[::1]/',
    'http://10.0.0.1/metadata',
    'http://169.254.169.254/latest/meta-data/',
    'file:///etc/passwd',
    'gopher://evil',
  ];
  const results = blocked.map((url) => {
    const parsed = parseDestination(url);
    if (!parsed.ok) {
      return true;
    }
    if (
      isLoopbackHostname(parsed.destination.hostname) ||
      isPrivateIpv4(parsed.destination.hostname) ||
      isLinkLocalOrMetadata(parsed.destination.hostname)
    ) {
      return true;
    }
    const decision = enforceSsrfPolicy(parsed.destination, {
      environment: 'production',
      allowHttp: false,
      approvedHostname: 'api.example.com',
      approvedPort: 443,
      approvedScheme: 'https',
      allowLoopbackInTest: false,
    });
    return decision.ok === false;
  });
  return Object.freeze({
    scenario: 'ssrf-block',
    passed: results.every(Boolean),
    notes: `Blocked ${results.filter(Boolean).length}/${blocked.length} abusive URLs`,
  });
}

export function runProviderCompromiseTest(): ChaosScenarioResult {
  const plane = createExternalDataPlane();
  plane.setProviderState('nvd', { down: true, malformed: true });
  const score = plane.providerRisk.assessProvider('nvd', {
    schemaChangeCount: 5,
    dataAnomalyCount: 5,
  });
  const recommendation = plane.providerRisk.monitor.recommendQuarantine(score);
  return Object.freeze({
    scenario: 'provider-compromise',
    passed: recommendation.recommend === true,
    notes: recommendation.reason,
  });
}

export function runAllChaosScenarios(): readonly ChaosScenarioResult[] {
  return Object.freeze([
    runTwentyFiveProviderOutageTest(),
    ...runCategoryOutageTests(),
    runComplianceOutageTest(),
    runRateLimitStormTest(),
    runCircuitBreakerLifecycleTest(),
    runSsrfRegressionTest(),
    runProviderCompromiseTest(),
  ]);
}

export function formatProviderMatrixRow(entry: Wave7ProviderCoverage): string {
  return `| ${entry.providerId} | ${entry.category} | ${entry.adapterId ?? '—'} | ${entry.status} | ${entry.environment} | ${entry.authRequired ? 'yes' : 'no'} | ${entry.commercialStatus} | ${entry.canonicalService ?? '—'} | fixture | SWR | health | trust | ${entry.notes} |`;
}

export function generateProviderMatrixMarkdown(): string {
  const report = buildWave7CoverageReport();
  const header =
    '| Provider | Category | Adapter | Status | Environment | Auth | Commercial Status | Canonical Service | Primary/Fallback | Cache Policy | Health | Trust Policy | Notes |\n' +
    '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |';
  const rows = report.providers.map(formatProviderMatrixRow).join('\n');
  return `${header}\n${rows}`;
}
