/**
 * ACCESS-19 cross-package qualification.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { runProductiveAccessBridgeDemo } from '../packages/access-economy/src/productive-access-bridge/demo.ts';
import { runProductiveAccessBridgeIntegrationDemo } from '../packages/sunrey-economics/src/productive-access-bridge/demo.ts';

describe('ACCESS-19 MoonRey Productive Capacity to Access Bridge', () => {
  it('qualifies the domain bridge demo', () => {
    const output = runProductiveAccessBridgeDemo();
    assert.match(output, /ACCESS_19_BRIDGE_QUALIFIED/);
    assert.match(output, /100000/);
    assert.match(output, /MR issued by Access usage:\s+0/);
  });

  it('qualifies the productive-engine integration demo', () => {
    const output = runProductiveAccessBridgeIntegrationDemo();
    assert.match(output, /ACCESS_19_INTEGRATED_QUALIFIED/);
    assert.match(output, /automatic SR\/MR mint:\s+false/);
  });
});
