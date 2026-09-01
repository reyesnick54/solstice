import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { createPhaseEWorld } from './phase-e-world.ts';

async function timed(label: string, fn: () => Promise<void>): Promise<number> {
  const start = process.hrtime.bigint();
  await fn();
  const elapsedMs = Number(process.hrtime.bigint() - start) / 1_000_000;
  void label;
  return elapsedMs;
}

describe('Phase E Grow performance baseline', () => {
  it('records non-production sandbox timings without inventing SLAs', async () => {
    const world = createPhaseEWorld('perf');
    const snapshotMs = await timed('snapshot', async () => {
      assert.equal((await world.handle({ method: 'GET', path: '/api/v1/grow/snapshot', query: {} })).status, 200);
    });
    const opportunityMs = await timed('opportunities', async () => {
      assert.equal((await world.handle({ method: 'GET', path: '/api/v1/grow/opportunities', query: {} })).status, 200);
    });
    const planMs = await timed('plan', async () => {
      assert.equal((await world.handle({ method: 'GET', path: '/api/v1/grow/plan', query: {} })).status, 200);
    });
    const scenarioMs = await timed('scenarios', async () => {
      assert.equal((await world.handle({ method: 'GET', path: '/api/v1/grow/scenarios', query: {} })).status, 200);
    });
    const proposalMs = await timed('proposal', async () => {
      assert.equal((await world.handle({ method: 'POST', path: '/api/v1/grow/proposals', query: {}, body: {} })).status, 201);
    });
    const portfolioMs = await timed('portfolio', async () => {
      assert.equal((await world.handle({ method: 'GET', path: '/api/v1/grow/portfolio', query: {} })).status, 200);
    });
    const monitorMs = await timed('monitor', async () => {
      assert.equal((await world.handle({ method: 'POST', path: '/api/v1/grow/monitor', query: {}, body: {} })).status, 200);
    });
    const baseline = {
      environment: 'simulation',
      production: false,
      slaInvented: false,
      volume: {
        customers: 1,
        proposals: 1,
        monitoringCycles: 1,
      },
      elapsedMs: {
        pegSnapshot: snapshotMs,
        opportunityGeneration: opportunityMs,
        growthPlan: planMs,
        scenarioAnalysis: scenarioMs,
        proposalGeneration: proposalMs,
        portfolioRead: portfolioMs,
        monitoringCycle: monitorMs,
      },
    };
    writeFileSync(
      join('/tmp', 'phase-e-performance-baseline.json'),
      `${JSON.stringify(baseline, null, 2)}\n`,
    );
    assert.equal(baseline.slaInvented, false);
    assert.ok(snapshotMs >= 0);
  });
});
