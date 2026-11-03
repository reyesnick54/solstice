import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { resolveExecutionTwinEnvironment, HELIOS_OS02_EXECUTION_TWIN_QUALIFIED } from './index.ts';

describe('HELIOS execution-twin module', () => {
  it('resolves environment aliases', () => {
    assert.equal(resolveExecutionTwinEnvironment('FORWARD_SHADOW'), 'SHADOW');
    assert.equal(resolveExecutionTwinEnvironment('SANDBOX_LIVE_DATA'), 'SANDBOX_LIVE_DATA');
  });

  it('exports qualification marker', () => {
    assert.equal(HELIOS_OS02_EXECUTION_TWIN_QUALIFIED, 'HELIOS_OS02_EXECUTION_TWIN_QUALIFIED');
  });
});
