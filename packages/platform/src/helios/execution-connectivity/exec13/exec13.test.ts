import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  EXEC13_CHAOS_SCENARIOS,
  EXEC13_RESILIENCE_STATES,
  evaluateExec13ExecutionResilienceQualification,
  gateExec13OrderAction,
  mergeExec13ResilienceContext,
  planBrokerFailover,
} from './index.ts';

describe('HELIOS EXEC13 execution connectivity', () => {
  it('declares seven resilience states', () => {
    assert.equal(EXEC13_RESILIENCE_STATES.length, 7);
    assert.ok(EXEC13_RESILIENCE_STATES.includes('FAILED_SAFE'));
  });

  it('blocks blind broker failover after timeout', () => {
    const plan = planBrokerFailover({
      businessKey: 'ord_1',
      brokerAId: 'broker_a',
      brokerBId: 'broker_b',
      submitTimedOut: true,
      acceptanceProbe: Object.freeze({ known: false, reason: 'timeout' }),
    });
    assert.equal(plan.ok, false);
    if (!plan.ok) {
      assert.equal(plan.code, 'BROKER_A_ACCEPTANCE_UNKNOWN');
    }
  });

  it('gates new orders under FAILED_SAFE', () => {
    const ctx = mergeExec13ResilienceContext({
      killSwitchState: 'FAILED_SAFE',
      killSwitchReasons: Object.freeze(['global:GLOBAL:FAIL_SAFE']),
      dependencyUnavailable: Object.freeze([]),
    });
    const gate = gateExec13OrderAction(ctx, 'SUBMIT_NEW');
    assert.equal(gate.ok, false);
  });

  it('qualifies when harness passes', () => {
    assert.equal(EXEC13_CHAOS_SCENARIOS.length, 25);
    const result = evaluateExec13ExecutionResilienceQualification();
    assert.equal(result.qualified, true, result.blockers.join('; '));
  });
});
