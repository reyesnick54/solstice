import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { describe, it } from 'node:test';
import { join } from 'node:path';

import { runEconomicsCommand } from '../packages/sunrey-economics/src/cli.ts';
import { simulateScenario } from '../packages/sunrey-economics/src/engine.ts';
import { allPropertiesHold } from '../packages/sunrey-economics/src/properties.ts';
import { requiredCatalogComplete } from '../packages/sunrey-economics/src/scenarios.ts';

const ROOT = join(import.meta.dirname, '..');

describe('Chunk 75 exit criteria', () => {
  it('implements the dual-economy laboratory without production activation', () => {
    assert.equal(requiredCatalogComplete(), true);
    const report = simulateScenario('baseline', { epochs: 3, seed: 75 });
    assert.equal(report.productionActivation.moonreyIssuanceActivated, false);
    assert.equal(report.productionActivation.liveFlags, false);
    assert.equal(report.bridge.policy.algorithmicPeg, false);
    assert.equal(allPropertiesHold(report.properties), true);
  });

  it('exposes the dual CLI planes', () => {
    const help = runEconomicsCommand(['dual']);
    assert.match(help, /simulate/);
    assert.match(help, /compare/);
    assert.match(help, /stability/);
    assert.match(help, /export/);
  });

  it('publishes the required documentation and forbids alias packages', () => {
    for (const relative of [
      'docs/economics/chunk-75-dual-economy-simulator.md',
      'docs/economics/human-economic-layer.md',
      'docs/economics/autonomous-productive-layer.md',
      'docs/economics/economic-bridge.md',
      'docs/economics/automation-transition.md',
      'docs/economics/dual-economy-scenarios.md',
      'docs/economics/dual-economy-stability.md',
      'docs/architecture/chunk-75-dual-economy.md',
      'docs/architecture/chunks/chunk-75-dual-economy.json',
      'packages/sunrey-economics/src/index.ts',
    ]) {
      assert.equal(existsSync(join(ROOT, relative)), true, relative);
    }
    assert.equal(existsSync(join(ROOT, 'packages/dual-economy')), false);
    assert.equal(existsSync(join(ROOT, 'packages/moonrey-macro')), false);
    assert.equal(existsSync(join(ROOT, 'packages/economic-bridge')), false);
  });
});
