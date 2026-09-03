import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { describe, it } from 'node:test';

import { InMemoryJobStore } from '../../../../events/src/jobs.ts';
import {
  assessCacheFreshness,
  buildCacheKey,
  buildRefreshJobId,
  computeObservationContentHash,
  InMemoryObservationPersistence,
  InMemoryProviderDataCache,
  metadataContainsForbiddenFragments,
  MOCK_REFRESH_SCHEDULES,
  ProviderDataDeliveryService,
  ProviderRefreshScheduler,
  resolveCachePolicy,
  toPersistedRecord,
  type DataDeliveryClock,
  type ExternalDataObservation,
  type ProviderFetchFn,
} from './index.ts';

const BASE_MS = Date.parse('2026-08-30T12:00:00.000Z');

function mutableClock(start = BASE_MS): {
  readonly clock: DataDeliveryClock;
  advance(ms: number): void;
} {
  let at = start;
  return {
    clock: {
      nowUtc: () => new Date(at).toISOString(),
      nowMs: () => at,
    },
    advance(ms: number) {
      at += ms;
    },
  };
}

function clock(atMs = BASE_MS): DataDeliveryClock {
  return mutableClock(atMs).clock;
}

function observation(input: {
  readonly providerId?: string;
  readonly capability?: string;
  readonly resourceId?: string;
  readonly schemaVersion?: string;
  readonly value?: string;
  readonly observationId?: string;
} = {}): ExternalDataObservation {
  const providerId = input.providerId ?? 'mock-ecb';
  const capability = input.capability ?? 'fx.reference';
  const resourceId = input.resourceId ?? 'EURUSD';
  const normalizedValue = Object.freeze({ rate: input.value ?? '1.08' });
  const base = {
    providerId,
    capability,
    resourceId,
    schemaVersion: input.schemaVersion ?? '1.0.0',
    normalizedValue,
    provenance: {
      sourceId: `${providerId}-source`,
      collectedAtUtc: new Date(BASE_MS).toISOString(),
      providerTimestampUtc: new Date(BASE_MS).toISOString(),
      deduplicationKey: `${providerId}:${resourceId}`,
      contentHash: '',
    },
  };
  const contentHash = createHash('sha256')
    .update(JSON.stringify(base.normalizedValue), 'utf8')
    .digest('hex');
  return Object.freeze({
    schema: 'sunrey.external-data.observation.v1',
    observationId: input.observationId ?? `obs_${providerId}_${resourceId}`,
    ...base,
    provenance: Object.freeze({ ...base.provenance, contentHash }),
    simulation: true,
  });
}

describe('Wave 1 Prompt 6 — provider data cache and refresh', () => {
  it('1. fresh cache hit', async () => {
    const clk = clock();
    const cache = new InMemoryProviderDataCache(clk);
    const policy = resolveCachePolicy('fx.reference');
    const obs = observation({ value: '1.10' });
    const key = buildCacheKey({ providerId: obs.providerId, capability: obs.capability, resourceId: obs.resourceId });
    await cache.set(key, obs, policy);
    const hit = await cache.get(key);
    assert.equal(hit?.freshness, 'FRESH');
    assert.equal(hit?.stale, false);
  });

  it('2. cache miss', async () => {
    const cache = new InMemoryProviderDataCache(clock());
    const missing = await cache.get(buildCacheKey({ providerId: 'x', capability: 'fx.reference', resourceId: 'USDJPY' }));
    assert.equal(missing, undefined);
  });

  it('3. stale-but-usable hit', async () => {
    const { clock, advance } = mutableClock();
    const cache = new InMemoryProviderDataCache(clock);
    const policy = resolveCachePolicy('fx.reference');
    const obs = observation({ value: '1.11' });
    const key = buildCacheKey({ providerId: obs.providerId, capability: obs.capability, resourceId: obs.resourceId });
    await cache.set(key, obs, policy);
    advance(45_000);
    const meta = await cache.getMetadata(key);
    assert.ok(meta);
    assert.equal(assessCacheFreshness(meta, clock.nowMs()), 'STALE_USABLE');
    const hit = await cache.get(key);
    assert.equal(hit?.stale, true);
  });

  it('4. SWR background refresh', async () => {
    let fetchCount = 0;
    const fetchFn: ProviderFetchFn = async () => {
      fetchCount += 1;
      return { ok: true, observation: observation({ value: '1.12' }) };
    };
    const { clock, advance } = mutableClock();
    const cache = new InMemoryProviderDataCache(clock);
    const service = new ProviderDataDeliveryService({ clock, fetchFn, cache });
    const policy = resolveCachePolicy('fx.reference');
    const obs = observation({ value: '1.10' });
    const key = buildCacheKey({ providerId: obs.providerId, capability: obs.capability, resourceId: obs.resourceId });
    await cache.set(key, obs, policy);
    advance(40_000);
    const result = await service.get({
      providerId: obs.providerId,
      capability: obs.capability,
      resourceId: obs.resourceId,
    });
    assert.equal(result?.source, 'cache_stale');
    assert.equal(result?.backgroundRefreshTriggered, true);
    await new Promise((resolve) => setTimeout(resolve, 20));
    assert.equal(fetchCount, 1);
  });

  it('5. expired entry', async () => {
    const policy = resolveCachePolicy('fx.reference');
    const { clock, advance } = mutableClock();
    const cache = new InMemoryProviderDataCache(clock);
    const obs = observation();
    const key = buildCacheKey({ providerId: obs.providerId, capability: obs.capability, resourceId: obs.resourceId });
    await cache.set(key, obs, policy);
    advance(policy.hardExpireMs + 1);
    const hit = await cache.get(key);
    assert.equal(hit, undefined);
  });

  it('6. single-flight behavior', async () => {
    let inflight = 0;
    let maxInflight = 0;
    const fetchFn: ProviderFetchFn = async () => {
      inflight += 1;
      maxInflight = Math.max(maxInflight, inflight);
      await new Promise((resolve) => setTimeout(resolve, 50));
      inflight -= 1;
      return { ok: true, observation: observation({ value: '1.13' }) };
    };
    const service = new ProviderDataDeliveryService({ clock: clock(), fetchFn });
    const input = { providerId: 'mock-ecb', capability: 'fx.reference', resourceId: 'EURUSD' };
    const results = await Promise.all([
      service.get(input),
      service.get(input),
      service.get(input),
      service.get(input),
      service.get(input),
    ]);
    assert.equal(maxInflight, 1);
    assert.equal(results.filter((row) => row?.source === 'provider_fetch').length, 5);
  });

  it('7. failed refresh retains existing value', async () => {
    const fetchFn: ProviderFetchFn = async () => ({ ok: false, errorSafe: 'provider outage' });
    const { clock, advance } = mutableClock();
    const cache = new InMemoryProviderDataCache(clock);
    const service = new ProviderDataDeliveryService({ clock, fetchFn, cache });
    const policy = resolveCachePolicy('fx.reference');
    const obs = observation({ value: '1.14' });
    const key = buildCacheKey({ providerId: obs.providerId, capability: obs.capability, resourceId: obs.resourceId });
    await cache.set(key, obs, policy);
    advance(120_000);
    const result = await service.get({
      providerId: obs.providerId,
      capability: obs.capability,
      resourceId: obs.resourceId,
    });
    assert.equal(result?.source, 'cache_retained_on_failure');
    assert.equal(service.failures().length, 1);
    const failure = service.failures()[0];
    assert.ok(failure);
    assert.equal(failure.retainedCached, true);
  });

  it('8. invalid provider payload does not overwrite good cache', async () => {
    const fetchFn: ProviderFetchFn = async () => ({
      ok: true,
      observation: {
        ...observation({ value: 'bad' }),
        schema: 'wrong.schema' as 'sunrey.external-data.observation.v1',
      },
    });
    const { clock, advance } = mutableClock();
    const cache = new InMemoryProviderDataCache(clock);
    const service = new ProviderDataDeliveryService({ clock, fetchFn, cache });
    const policy = resolveCachePolicy('fx.reference');
    const good = observation({ value: '1.15' });
    const key = buildCacheKey({ providerId: good.providerId, capability: good.capability, resourceId: good.resourceId });
    await cache.set(key, good, policy);
    advance(120_000);
    const refreshed = await service.refresh({
      providerId: good.providerId,
      capability: good.capability,
      resourceId: good.resourceId,
    });
    assert.equal(refreshed?.observation.normalizedValue.rate, '1.15');
  });

  it('9. cache invalidation', async () => {
    const cache = new InMemoryProviderDataCache(clock());
    const policy = resolveCachePolicy('weather.current');
    const obs = observation({ providerId: 'mock-ow', capability: 'weather.current', resourceId: 'nyc' });
    const key = buildCacheKey({ providerId: obs.providerId, capability: obs.capability, resourceId: obs.resourceId });
    await cache.set(key, obs, policy);
    const removed = await cache.invalidate({ providerId: 'mock-ow' });
    assert.equal(removed, 1);
    assert.equal(await cache.exists(key), false);
  });

  it('10. schema-version invalidation', async () => {
    const cache = new InMemoryProviderDataCache(clock());
    const policy = resolveCachePolicy('macro.gdp');
    const obs = observation({ capability: 'macro.gdp', resourceId: 'US.GDP', schemaVersion: '1.0.0' });
    const key = buildCacheKey({ providerId: obs.providerId, capability: obs.capability, resourceId: obs.resourceId });
    await cache.set(key, obs, policy);
    const removed = await cache.invalidate({ schemaVersion: '1.0.0' });
    assert.equal(removed, 1);
    assert.equal(await cache.exists(key), false);
  });

  it('11. scheduled job', async () => {
    const jobStore = new InMemoryJobStore();
    const scheduler = new ProviderRefreshScheduler({
      schedules: MOCK_REFRESH_SCHEDULES.filter((row) => row.scheduleId === 'mock-fx-hourly'),
      jobStore,
      clock: clock(),
      rng: () => 0.5,
    });
    const tick = await scheduler.tick();
    assert.equal(tick.enqueued.length, 1);
    const job = tick.enqueued[0];
    assert.ok(job);
    assert.equal(job.jobType, 'PROVIDER_DATA_REFRESH');
    assert.equal(job.payload.providerId, 'mock-ecb');
  });

  it('12. schedule jitter', async () => {
    const schedule = MOCK_REFRESH_SCHEDULES.find((row) => row.scheduleId === 'mock-fx-hourly');
    assert.ok(schedule);
    const scheduler = new ProviderRefreshScheduler({
      schedules: [schedule],
      jobStore: new InMemoryJobStore(),
      clock: clock(),
      rng: () => 0.5,
    });
    const jitter = scheduler.computeJitter(schedule);
    assert.equal(jitter, 60_000);
    assert.ok(jitter >= 0 && jitter < schedule.jitterMs);
  });

  it('13. duplicate job prevention', async () => {
    const jobStore = new InMemoryJobStore();
    const scheduler = new ProviderRefreshScheduler({
      schedules: MOCK_REFRESH_SCHEDULES.filter((row) => row.scheduleId === 'mock-fx-hourly'),
      jobStore,
      clock: clock(),
      rng: () => 0.1,
    });
    const first = await scheduler.tick();
    const second = await scheduler.tick();
    assert.equal(first.enqueued.length, 1);
    assert.equal(second.skippedDuplicate, 1);
    assert.equal(second.enqueued.length, 0);
  });

  it('14. persistence round trip', async () => {
    const persistence = new InMemoryObservationPersistence();
    const policy = resolveCachePolicy('macro.gdp');
    const obs = observation({ capability: 'macro.gdp', resourceId: 'US.GDP', value: '27000' });
    const record = toPersistedRecord({
      observation: obs,
      policy,
      persistedAtUtc: clock().nowUtc(),
      rawPayload: '{"gdp":27000}',
    });
    assert.equal(await persistence.persist(record), 'accepted');
    const roundTrip = await persistence.get(obs.observationId);
    assert.equal(roundTrip?.observation.normalizedValue.rate, '27000');
    const listed = await persistence.listByResource({
      providerId: obs.providerId,
      capability: obs.capability,
      resourceId: obs.resourceId,
    });
    assert.equal(listed.length, 1);
  });

  it('15. retention cleanup', async () => {
    const persistence = new InMemoryObservationPersistence();
    const policy = resolveCachePolicy('fx.reference');
    const clk = clock(BASE_MS + 200_000_000);
    for (let i = 0; i < policy.maxHistoryEntries + 5; i += 1) {
      const obs = observation({ observationId: `obs_${i}`, value: String(i) });
      await persistence.persist(
        toPersistedRecord({
          observation: obs,
          policy,
          persistedAtUtc: new Date(BASE_MS + i * 1_000).toISOString(),
          rawPayload: '{"raw":true}',
        }),
      );
    }
    const removed = await persistence.cleanup({ nowUtc: clk.nowUtc(), policy });
    assert.ok(removed > 0);
    assert.ok((await persistence.snapshot()).length <= policy.maxHistoryEntries + 5);
  });

  it('16. no secrets in cache keys/metadata', () => {
    assert.throws(() =>
      buildCacheKey({ providerId: 'mock', capability: 'fx.reference', resourceId: 'token-abc' }),
    );
    assert.equal(
      metadataContainsForbiddenFragments({ account_number: '1234567890', safe: 'value' }),
      true,
    );
    assert.equal(metadataContainsForbiddenFragments({ region: 'us-east', metric: 'gdp' }), false);
    const hash = computeObservationContentHash(observation());
    assert.match(hash, /^[a-f0-9]{64}$/);
    const jobId = buildRefreshJobId({
      scheduleId: 'sched',
      providerId: 'mock-ecb',
      capability: 'fx.reference',
      resourceId: 'EURUSD',
      intervalBucket: '42',
    });
    assert.ok(!jobId.includes('password'));
  });
});
