import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  asIntentId,
  createActionIntent,
  type ActionIntent,
} from './index.ts';

describe('ActionIntent envelope', () => {
  it('freezes intentId, actionType, payload, actor, and proposedAt', () => {
    const intent: ActionIntent<'EXAMPLE', { readonly n: number }> = createActionIntent({
      intentId: asIntentId('int_1'),
      actionType: 'EXAMPLE',
      payload: Object.freeze({ n: 1 }),
      actor: { kind: 'SYSTEM', id: 'sys_test' },
      proposedAt: '2026-08-13T14:55:00.000Z',
    });

    assert.equal(intent.intentId, 'int_1');
    assert.equal(intent.actionType, 'EXAMPLE');
    assert.deepEqual(intent.payload, { n: 1 });
    assert.equal(intent.actor.kind, 'SYSTEM');
    assert.equal(intent.actor.id, 'sys_test');
    assert.equal(intent.proposedAt, '2026-08-13T14:55:00.000Z');
    assert.ok(Object.isFrozen(intent));
    assert.ok(Object.isFrozen(intent.actor));
  });
});
