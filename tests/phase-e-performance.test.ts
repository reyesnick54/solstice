import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { createPhaseEWorld } from './phase-e-world.ts';

function timed(label: string, fn: () => void): number {
  const start = process.hrtime.bigint();
  fn();
  const elapsedMs = Number(process.hrtime.bigint() - start) / 1_000_000;
  void label;
  return elapsedMs;
}

describe('Phase E Grow performance baseline', () => {
  it('records non-production sandbox timings without inventing SLAs', () => {
    const world = createPhaseEWorld('perf');
    const snapshotMs = timed('snapshot', () => {
      assert.equal(world.handle({ method: 'GET', path: '/api/v1/grow/snapshot', query: {} }).status, 200);
    });
    const opportunityMs = timed('opportunities', () => {
      assert.equal(world.handle({ method: 'GET', path: '/api/v1/grow/opportunities', query: {} }).status, 200);
    });
    const planMs = timed('plan', () => {
      assert.equal(world.handle({ method: 'GET', path: '/api/v1/grow/plan', query: {} }).status, 200);
    });
    const scenarioMs = timed('scenarios', () => {
      assert.equal(world.handle({ method: 'GET', path: '/api/v1/grow/scenarios', query: {} }).status, 200);
    });
    const proposalMs = timed('proposal', () => {
      assert.equal(world.handle({ method: 'POST', path: '/api/v1/grow/proposals', query: {}, body: {} }).status, 201);
    });
    const portfolioMs = timed('portfolio', () => {
      assert.equal(world.handle({ method: 'GET', path: '/api/v1/grow/portfolio', query: {} }).status, 200);
    });
    const monitorMs = timed('monitor', () => {
      assert.equal(world.handle({ method: 'POST', path: '/api/v1/grow/monitor', query: {}, body: {} }).status, 200);
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
