import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import {
  createUniversalProviderRuntime,
  seedSimulationProviders,
} from '../../../sunrey-chain/src/provider-runtime/universal/index.ts';
import { DurableUniversalProviderStore } from './universal-store.ts';

const NOW = '2026-08-21T16:00:00.000Z';

describe('durable universal provider store', () => {
  it('survives restart without secrets or production activation', () => {
    const dir = mkdtempSync(join(tmpdir(), 'universal-provider-'));
    const runtime = createUniversalProviderRuntime();
    seedSimulationProviders(runtime, NOW);
    const store = new DurableUniversalProviderStore(dir);
    store.replace(runtime.snapshot());
    const reopened = store.reopen();
    const restored = createUniversalProviderRuntime();
    restored.restore(reopened.list());
    assert.equal(restored.get('sim-payments')?.lifecycleState, 'SIMULATED');
    assert.equal(restored.get('sim-payments')?.rawCredentialPresent, false);
    assert.equal(reopened.list().productionActive, false);
    assert.equal(reopened.list().secretsForbidden, true);
    assert.equal(restored.featureAvailability('payments').enabled, true);
  });
});
