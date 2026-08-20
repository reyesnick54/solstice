import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { OperatingScopeFact } from '../../kernel/src/policy/operating-scope-fact.ts';
import { corridorLiveFromOperatingScope, fxFactDoesNotAuthorizeRail } from './corridor-scope.ts';

describe('payments corridor operating-scope binding', () => {
  it('does not enable live corridors from a Kernel fact', () => {
    const fact: OperatingScopeFact = {
      schemaVersion: 1,
      jurisdiction: 'US',
      activationDomain: 'PAYMENT_RAILS',
      eligibility: false,
      status: 'RESEARCH_REQUIRED',
      reasonCodes: ['CORRIDOR_DISABLED', 'FX_EVIDENCE_NOT_PAYMENT_RAIL'],
      evidenceReferences: [],
      productionActive: false,
      issuesExecutionAuthority: false,
      confirmedByCounsel: false,
    };
    const result = corridorLiveFromOperatingScope('US-SA-USD-SAR', fact);
    assert.equal(result.liveEnabled, false);
    assert.equal(result.policyStatus, 'RESEARCH_REQUIRED');
    assert.equal(fxFactDoesNotAuthorizeRail(fact), true);
  });
});
