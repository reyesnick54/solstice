import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { escalate, escalateAll } from './index.ts';

describe('monotonic escalation', () => {
  it('tightens posture and never loosens it', () => {
    assert.equal(escalate('ALLOW', 'DEFER'), 'DEFER');
    assert.equal(escalate('DEFER', 'ALLOW'), 'DEFER');
    assert.equal(escalate('REQUIRE_MANUAL_REVIEW', 'BLOCK'), 'BLOCK');
    assert.equal(escalate('BLOCK', 'ALLOW'), 'BLOCK');
    assert.equal(
      escalateAll(['ALLOW', 'DEFER', 'REQUIRE_MANUAL_REVIEW', 'ALLOW']),
      'REQUIRE_MANUAL_REVIEW',
    );
    assert.equal(escalateAll(['ALLOW', 'BLOCK', 'DEFER']), 'BLOCK');
  });
});
