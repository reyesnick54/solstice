import assert from 'node:assert/strict';
import { describe, it, beforeEach } from 'node:test';

import { defaultOpportunityNow } from './wave6/service.ts';
import { clearOpportunityHttpCache } from './wave6/http/cache.ts';
import { createOpportunityAdapter } from './wave6/adapters/index.ts';
import {
  parseArbeitnowJobs,
  parseRemoteOkJobs,
  validateArbeitnowPayload,
  validateRemoteOkPayload,
} from './wave6/http/parsers.ts';
import { detectDuplicateJobs } from './wave6/deduplication.ts';
import { deriveExecutionProvenance } from './certification/types.ts';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), 'wave6/adapters/fixtures');
const NOW = defaultOpportunityNow();

function load(name: string): unknown {
  return JSON.parse(readFileSync(join(FIXTURES, name), 'utf8'));
}

describe('Wave 4 Prompt 11 — live opportunity adapters', () => {
  beforeEach(() => clearOpportunityHttpCache());

  it('derives simulation provenance without claiming live network', async () => {
    const adapter = createOpportunityAdapter('arbeitnow', { mode: 'simulation' });
    const result = await adapter.searchJobs({}, NOW);
    assert.equal(result.ok, true);
    assert.equal(result.execution?.simulated, true);
    assert.equal(result.execution?.liveNetworkCallObserved, false);
  });

  it('parses arbeitnow fixture payload', () => {
    const raw = load('arbeitnow-jobs.json');
    assert.equal(validateArbeitnowPayload(raw), true);
    const jobs = parseArbeitnowJobs(raw as never, 'arbeitnow', NOW);
    assert.ok(jobs.length > 0);
    assert.equal(jobs[0]!.providerId, 'arbeitnow');
  });

  it('parses remoteok fixture payload', () => {
    const raw = load('remoteok-jobs.json');
    assert.equal(validateRemoteOkPayload(raw), true);
    const jobs = parseRemoteOkJobs(raw as never, 'remoteok', NOW);
    assert.equal(jobs[0]!.title, 'Senior Software Engineer');
  });

  it('handles live HTTP success via injected fetch', async () => {
    const arbeitnowBody = load('arbeitnow-jobs.json');
    const adapter = createOpportunityAdapter('arbeitnow', {
      mode: 'live',
      environment: 'test',
      fetchFn: async () =>
        new Response(JSON.stringify(arbeitnowBody), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
    });
    const result = await adapter.searchJobs({}, NOW);
    assert.equal(result.ok, true);
    assert.equal(result.execution?.liveNetworkCallObserved, true);
    assert.equal(result.execution?.simulated, false);
    assert.equal(result.fromCache, false);
  });

  it('classifies HTTP 429 without simulation fallback', async () => {
    const adapter = createOpportunityAdapter('remoteok', {
      mode: 'live',
      environment: 'test',
      fetchFn: async () => new Response('rate limited', { status: 429 }),
    });
    const result = await adapter.searchJobs({}, NOW);
    assert.equal(result.ok, false);
    assert.equal(result.code, 'RATE_LIMITED');
    assert.equal(result.execution?.liveNetworkCallObserved, true);
    assert.equal(result.execution?.simulated, false);
  });

  it('classifies HTTP 500 errors', async () => {
    const adapter = createOpportunityAdapter('remotive', {
      mode: 'live',
      environment: 'test',
      fetchFn: async () => new Response('error', { status: 500 }),
    });
    const result = await adapter.searchJobs({}, NOW);
    assert.equal(result.ok, false);
    assert.equal(result.code, 'HTTP_ERROR');
  });

  it('classifies malformed payload after successful HTTP', async () => {
    const adapter = createOpportunityAdapter('jobicy', {
      mode: 'live',
      environment: 'test',
      fetchFn: async () =>
        new Response(JSON.stringify({ unexpected: true }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
    });
    const result = await adapter.searchJobs({}, NOW);
    assert.equal(result.ok, false);
    assert.equal(result.code, 'INVALID_PAYLOAD');
  });

  it('reports unavailable catalog providers honestly', async () => {
    const adapter = createOpportunityAdapter('graphql-jobs', { mode: 'live' });
    const result = await adapter.searchJobs({}, NOW);
    assert.equal(result.ok, false);
    assert.equal(result.code, 'PROVIDER_UNAVAILABLE');
  });

  it('uses cache on repeated live requests', async () => {
    let calls = 0;
    const adapter = createOpportunityAdapter('himalayas', {
      mode: 'live',
      environment: 'test',
      fetchFn: async () => {
        calls += 1;
        return new Response(JSON.stringify(load('himalayas-jobs.json')), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      },
    });
    const first = await adapter.searchJobs({}, NOW);
    const second = await adapter.searchJobs({}, NOW);
    assert.equal(first.ok, true);
    assert.equal(second.ok, true);
    assert.equal(second.fromCache, true);
    assert.equal(calls, 1);
    assert.equal(second.execution?.fromCache, true);
  });

  it('deduplicates overlapping provider listings by employer/title/location/url', () => {
    const base = parseArbeitnowJobs(load('arbeitnow-jobs.json') as never, 'arbeitnow', NOW)[0]!;
    const duplicate = Object.freeze({
      ...base,
      opportunityId: 'remoteok:dup',
      providerId: 'remoteok',
      providerJobId: 'dup',
      mergedSourceIds: Object.freeze([]),
    });
    const sameFingerprint = Object.freeze({
      ...duplicate,
      employer: base.employer,
      title: base.title,
      location: base.location,
      applicationUrl: base.applicationUrl,
    });
    const merged = detectDuplicateJobs([base, sameFingerprint]);
    assert.equal(merged.length, 1);
    assert.equal(merged[0]!.mergedSourceIds.length, 2);
  });

  it('execution provenance never marks failed live call as simulated', () => {
    const provenance = deriveExecutionProvenance({
      simulated: false,
      liveNetworkCallObserved: true,
      httpStatus: 503,
      latencyMs: 120,
    });
    assert.equal(provenance.simulated, false);
    assert.equal(provenance.liveNetworkCallObserved, true);
  });
});
