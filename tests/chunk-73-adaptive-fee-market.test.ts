import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { evaluateDeclaredChunks } from '../tools/architectural-linter/src/constitution.ts';
import { evaluateCapability, loadManifest } from '../tools/architectural-linter/src/manifest.ts';
import { FORMAL_MODEL_IDS } from '../packages/sunrey-chain/src/formal/types.ts';
import { buildFeeMarketVerificationReport, developmentFeePolicyV2 } from '../packages/sunrey-chain/src/fees/v2/index.ts';

const REPO_ROOT = join(import.meta.dirname, '..');

describe('CHUNK-73 SunRey adaptive fee market', () => {
  it('marks sunrey-adaptive-fee-market implemented on sunrey-chain', () => {
    const manifest = loadManifest(REPO_ROOT);
    assert.equal(evaluateCapability(manifest, 'sunrey-adaptive-fee-market').status, 'IMPLEMENTED');
    assert.equal(evaluateCapability(manifest, 'sunrey-adaptive-fee-market').owner, 'packages/sunrey-chain');
    const declared = evaluateDeclaredChunks(REPO_ROOT, manifest).find(
      (evaluation) => evaluation.chunk === 'CHUNK-73',
    );
    assert.ok(declared, 'CHUNK-73 declaration must exist');
    assert.equal(declared.mustStop, false);
    assert.deepEqual(declared.missing, []);
  });

  it('does not invent a competing fee package and keeps production parameters unconfigured', () => {
    assert.equal(existsSync(join(REPO_ROOT, 'packages/sunrey-chain/src/fees/v2/policy.ts')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'docs/economics/chunk-73-fee-market.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/fees')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/sunrey-fees')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/gas')), false);
    assert.equal(developmentFeePolicyV2().productionParametersConfigured, false);
    assert.equal(FORMAL_MODEL_IDS.includes('ADAPTIVE_FEE_MARKET'), true);
    assert.equal(buildFeeMarketVerificationReport().passed, true);
  });
});
