import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { STATE_CHANGING_PATHS } from '@solstice/kernel';
import { ENVIRONMENT, LIVE_FLAGS } from '@solstice/kernel';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');

describe('Phase 2 exit: nothing executes outside the Kernel', () => {
  it('every registered state-changing path is Kernel-gated', () => {
    assert.ok(STATE_CHANGING_PATHS.length >= 9);
    for (const path of STATE_CHANGING_PATHS) {
      assert.equal(path.gated, true, `${path.id} is not marked gated`);
      const source = readFileSync(resolve(ROOT, path.file), 'utf8');
      assert.ok(
        source.includes(`function ${path.symbol}`) || source.includes(`${path.symbol}(`),
        `${path.symbol} missing in ${path.file}`,
      );
      assert.ok(
        source.includes('@kernelGated') || source.includes('assertKernelAuthorization'),
        `${path.symbol} in ${path.file} lacks Kernel authorization`,
      );
      const fnIndex = source.indexOf(`${path.symbol}(`);
      assert.ok(fnIndex >= 0, `${path.symbol} not found`);
      const window = source.slice(fnIndex, fnIndex + 400);
      assert.ok(
        window.includes('KernelAuthorization') || window.includes('authorization'),
        `${path.file}:${path.symbol} signature is missing Kernel authorization (file ${path.file})`,
      );
    }
  });

  it('LIVE_* flags remain false (Phase 2/3 simulation only)', () => {
    assert.equal(ENVIRONMENT, 'simulation');
    for (const [name, value] of Object.entries(LIVE_FLAGS)) {
      assert.equal(value, false, `${name} changed`);
    }
  });
});
