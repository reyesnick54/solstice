import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { hrtime } from 'node:process';

import { createPhaseHWorld } from './phase-h-world.ts';

function measure(label: string, fn: () => void): { readonly label: string; readonly ns: string } {
  const start = hrtime.bigint();
  fn();
  const elapsed = hrtime.bigint() - start;
  return { label, ns: elapsed.toString() };
}

describe('Phase H performance baseline', () => {
  it('measures non-production Vault/HIN/economy reads without inventing an SLA', () => {
    const world = createPhaseHWorld();
    world.handle({ method: 'POST', path: '/api/v1/data/records', body: { idempotencyKey: 'perf_pref' } });
    world.handle({ method: 'POST', path: '/api/v1/data/hin/participate' });
    const samples = [
      measure('vault_summary', () => world.handle({ method: 'GET', path: '/api/v1/data' })),
      measure('permissions', () => world.handle({ method: 'GET', path: '/api/v1/data/permissions' })),
      measure('access_history', () => world.handle({ method: 'GET', path: '/api/v1/data/access-history' })),
      measure('hin_contribution_summary', () => world.handle({ method: 'GET', path: '/api/v1/data/contributions' })),
      measure('aggregate_hin_metrics', () => world.handle({ method: 'GET', path: '/api/v1/economy/hin' })),
      measure('earnings', () => world.handle({ method: 'GET', path: '/api/v1/data/earnings' })),
      measure('productive_overview', () => world.handle({ method: 'GET', path: '/api/v1/economy/productive' })),
      measure('category_metric_history', () => world.handle({ method: 'GET', path: '/api/v1/economy/productive/ENERGY' })),
    ];
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
