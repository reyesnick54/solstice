import assert from 'node:assert/strict';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { lintProductizationFreeze } from './productization-guards.ts';

const REPO_ROOT = join(import.meta.dirname, '../../..');

describe('productization architecture freeze guards', () => {
  it('accepts the frozen authority map and forbids super-packages', () => {
    const findings = lintProductizationFreeze(REPO_ROOT);
    assert.deepEqual(findings, []);
  });
});
