import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { ENVIRONMENT, LIVE_EXCHANGE_ENABLED, LIVE_MONEY_ENABLED } from '../packages/config/src/flags.ts';
import {
  createHandoffReport,
  runProductionLifecycleRehearsal,
} from '../packages/sunrey-chain/src/production-handoff/index.ts';

const ROOT = join(import.meta.dirname, '..');

describe('Chunk 90 production handoff exit criteria', () => {
  it('implements the production handoff owner without launching mainnet', () => {
    assert.equal(existsSync(join(ROOT, 'packages/sunrey-chain/src/production-handoff/index.ts')), true);
    assert.equal(existsSync(join(ROOT, 'docs/mainnet/chunk-90-production-handoff.md')), true);
    assert.equal(existsSync(join(ROOT, 'docs/operations/production-system-inventory.md')), true);
    assert.equal(existsSync(join(ROOT, 'docs/operations/production-responsibility-matrix.md')), true);
    assert.equal(existsSync(join(ROOT, 'docs/operations/production-slos.md')), true);
    assert.equal(existsSync(join(ROOT, 'docs/operations/production-change-management.md')), true);
    assert.equal(existsSync(join(ROOT, 'docs/operations/production-incident-command.md')), true);
    assert.equal(existsSync(join(ROOT, 'docs/operations/production-backup-recovery.md')), true);
    assert.equal(existsSync(join(ROOT, 'docs/operations/production-evidence-seal.md')), true);
    assert.equal(existsSync(join(ROOT, 'docs/runbooks/production-handoff.md')), true);
    assert.equal(existsSync(join(ROOT, 'docs/runbooks/day-2-operations.md')), true);
    assert.equal(existsSync(join(ROOT, 'packages/production-handoff')), false);
    assert.equal(existsSync(join(ROOT, 'packages/sunrey-handoff')), false);
    assert.equal(existsSync(join(ROOT, 'packages/day-2-ops')), false);
    assert.equal(existsSync(join(ROOT, 'packages/production-ops')), false);
    assert.equal(existsSync(join(ROOT, 'packages/operator-acceptance')), false);

    assert.equal(ENVIRONMENT, 'simulation');
    assert.equal(LIVE_MONEY_ENABLED, false);
    assert.equal(LIVE_EXCHANGE_ENABLED, false);

    const rehearsal = runProductionLifecycleRehearsal(ROOT);
    assert.equal(rehearsal.observedProduction, false);
    assert.equal(rehearsal.usableForProduction, false);
    assert.equal(rehearsal.phases.length, 5);

    const report = createHandoffReport(ROOT);
    assert.equal(report.observedProduction, false);
    assert.equal(report.package.productionEnvironment, 'simulation');
  });
});
