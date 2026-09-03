// @ts-nocheck
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { findCaseCollisions, formatCaseCollisionReport } from '../scripts/check-case-collisions.mjs';

describe('repository case-collision detection', () => {
  it('reports no collisions for a clean path list', () => {
    const collisions = findCaseCollisions(['docs/build-status.md', 'README.md', 'package.json']);
    assert.equal(collisions.length, 0);
  });

  it('detects paths that differ only by case', () => {
    const collisions = findCaseCollisions(['docs/build-status.md', 'docs/BUILD-STATUS.md', 'README.md']);
    assert.equal(collisions.length, 1);
    assert.deepEqual(collisions[0].variants, ['docs/BUILD-STATUS.md', 'docs/build-status.md']);
    assert.match(formatCaseCollisionReport(collisions), /docs\/build-status\.md/);
  });
});
