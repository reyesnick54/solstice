import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { ENVIRONMENT, LIVE_EXCHANGE_ENABLED, LIVE_MONEY_ENABLED } from '../packages/config/src/flags.ts';
import { createPublicDataPlaneReport } from '../packages/sunrey-chain/src/public-data-plane/index.ts';

const ROOT = join(import.meta.dirname, '..');

describe('Chunk 93 public data plane exit criteria', () => {
  it('implements the public RPC and Explorer owner without a second ledger', () => {
    assert.equal(existsSync(join(ROOT, 'packages/sunrey-chain/src/public-data-plane/index.ts')), true);
    assert.equal(existsSync(join(ROOT, 'docs/network/chunk-93-public-data-plane.md')), true);
    assert.equal(existsSync(join(ROOT, 'docs/network/public-rpc.md')), true);
    assert.equal(existsSync(join(ROOT, 'docs/network/rpc-security.md')), true);
    assert.equal(existsSync(join(ROOT, 'docs/network/rpc-rate-limits.md')), true);
    assert.equal(existsSync(join(ROOT, 'docs/network/explorer-ha.md')), true);
    assert.equal(existsSync(join(ROOT, 'docs/network/archive-query.md')), true);
    assert.equal(existsSync(join(ROOT, 'docs/runbooks/public-rpc-incident.md')), true);
    assert.equal(existsSync(join(ROOT, 'docs/runbooks/explorer-rebuild.md')), true);
    assert.equal(existsSync(join(ROOT, 'packages/public-rpc')), false);
    assert.equal(existsSync(join(ROOT, 'packages/sunrey-rpc-edge')), false);
    assert.equal(existsSync(join(ROOT, 'packages/rpc-gateway')), false);
    assert.equal(existsSync(join(ROOT, 'packages/explorer-ha')), false);
    assert.equal(existsSync(join(ROOT, 'packages/public-data-plane')), false);

    assert.equal(ENVIRONMENT, 'simulation');
    assert.equal(LIVE_MONEY_ENABLED, false);
    assert.equal(LIVE_EXCHANGE_ENABLED, false);

    const report = createPublicDataPlaneReport();
    assert.equal(report.secondConsensus, false);
    assert.equal(report.secondLedger, false);
    assert.equal(report.explorerAuthoritative, false);
    assert.equal(report.publicValidatorAdminExposed, false);
    assert.equal(report.liveFlagsEnabled, false);
    assert.equal(report.network.apiVersion, 'v1');
  });
});
