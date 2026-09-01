import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { hrtime } from 'node:process';

import { createPhaseHWorld } from './phase-h-world.ts';

async function measureAsync(label: string, fn: () => Promise<void>): Promise<{ readonly label: string; readonly ns: string }> {
  const start = hrtime.bigint();
  await fn();
  const elapsed = hrtime.bigint() - start;
  return { label, ns: elapsed.toString() };
}

describe('Phase H performance baseline', () => {
  it('measures non-production Vault/HIN/economy reads without inventing an SLA', async () => {
    const world = createPhaseHWorld();
    await world.handle({ method: 'POST', path: '/api/v1/data/records', body: { idempotencyKey: 'perf_pref' } });
    await world.handle({ method: 'POST', path: '/api/v1/data/hin/participate' });
    const samples = await Promise.all([
      measureAsync('vault_summary', async () => {
        await world.handle({ method: 'GET', path: '/api/v1/data' });
      }),
      measureAsync('permissions', async () => {
        await world.handle({ method: 'GET', path: '/api/v1/data/permissions' });
      }),
      measureAsync('access_history', async () => {
        await world.handle({ method: 'GET', path: '/api/v1/data/access-history' });
      }),
      measureAsync('hin_contribution_summary', async () => {
        await world.handle({ method: 'GET', path: '/api/v1/data/contributions' });
      }),
      measureAsync('aggregate_hin_metrics', async () => {
        await world.handle({ method: 'GET', path: '/api/v1/economy/hin' });
      }),
      measureAsync('earnings', async () => {
        await world.handle({ method: 'GET', path: '/api/v1/data/earnings' });
      }),
      measureAsync('productive_overview', async () => {
        await world.handle({ method: 'GET', path: '/api/v1/economy/productive' });
      }),
      measureAsync('category_metric_history', async () => {
        await world.handle({ method: 'GET', path: '/api/v1/economy/productive/ENERGY' });
      }),
    ]);
    writeFileSync(
      join(import.meta.dirname, '../docs/productization/PHASE_H_PERFORMANCE_BASELINE.json'),
      `${JSON.stringify(
        {
          schema: 'sunrey.phase-h.performance-baseline.v1',
          productionSlaClaimed: false,
          environment: 'simulation',
          notes: 'Non-production Cloud Agent harness. Not an SLA.',
          samples,
        },
        null,
        2,
      )}\n`,
    );
    assert.equal(samples.length, 8);
    for (const sample of samples) {
      assert.ok(BigInt(sample.ns) >= 0n);
    }
  });
});
