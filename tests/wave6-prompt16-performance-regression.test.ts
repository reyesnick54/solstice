/**
 * Wave 6 Prompt 16 — CI performance regression tests.
 * Conservative deterministic envelopes only. No external-network thresholds.
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';

import { runDatabaseBaseline } from '../performance/database/baseline.ts';
import { runExchangeBaseline } from '../performance/exchange/baseline.ts';
import { runAccessBaseline } from '../performance/access/allocation-baseline.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const thresholds = JSON.parse(
  readFileSync(join(ROOT, 'performance/regression/thresholds.json'), 'utf8'),
) as {
  suites: {
    database: { ledgerPostingMedianMs: number; ledgerLookupMedianMs: number };
    access: { overviewP99Ms: number; allocationP99Ms: number };
    exchange: { orderIngressP99Ms: number };
  };
};

describe('Wave 6 Prompt 16 performance regression', () => {
  it('ledger posting and lookup stay within engineering envelopes', async () => {
    const result = await runDatabaseBaseline();
    const posting = result.cases.find((row) => row.name === 'single-row-posting');
    const lookup = result.cases.find((row) => row.name === 'journal-lookup');
    assert.ok(posting);
    assert.ok(lookup);
    const postingLatency = posting.latency as { medianMs: number };
    const lookupLatency = lookup.latency as { medianMs: number };
    assert.ok(
      postingLatency.medianMs < thresholds.suites.database.ledgerPostingMedianMs,
      `posting median ${postingLatency.medianMs}ms`,
    );
    assert.ok(
      lookupLatency.medianMs < thresholds.suites.database.ledgerLookupMedianMs,
      `lookup median ${lookupLatency.medianMs}ms`,
    );
  });

  it('access overview and search stay within engineering envelopes', async () => {
    const result = await runAccessBaseline();
    const overview = result.cases.find((row) => row.name === 'overview-read');
    const search = result.cases.find((row) => row.name === 'provider-search');
    assert.ok(overview);
    assert.ok(search);
    const overviewLatency = overview.latency as { p99Ms: number };
    const searchLatency = search.latency as { p99Ms: number };
    assert.ok(overviewLatency.p99Ms < thresholds.suites.access.overviewP99Ms);
    assert.ok(searchLatency.p99Ms < thresholds.suites.access.allocationP99Ms);
  });

  it('exchange order ingress stays within engineering envelope', async () => {
    const result = await runExchangeBaseline();
    const ingress = result.cases.find((row) => String(row.name).startsWith('order_ingress'));
    assert.ok(ingress);
    const latency = ingress.latencyMs as { p99Ms: number };
    assert.ok(latency.p99Ms < thresholds.suites.exchange.orderIngressP99Ms);
  });
});
