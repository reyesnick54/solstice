import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  HELIOS_EXEC11_CUSTODY_ISOLATION_QUALIFIED,
  defaultGrowTradingAgentGrant,
  evaluateCustodyMovementIsolation,
  evaluateExec11CustodyIsolationQualification,
  tradeGrantImpliesWithdraw,
} from './index.ts';

describe('HELIOS EXEC11 custody movement isolation', () => {
  it('does not grant WITHDRAW to Grow trading agents authorized only for TRADE', () => {
    const grant = defaultGrowTradingAgentGrant('grant_test');
    assert.equal(tradeGrantImpliesWithdraw(grant), false);
    const withdraw = evaluateCustodyMovementIsolation({
      requestId: 'req_withdraw',
      authority: 'WITHDRAW',
      rail: 'SECURITIES',
      grant,
    });
    assert.equal(withdraw.decision, 'DENIED');
    assert.ok(withdraw.reasonCodes.includes('OUTBOUND_AUTHORITY_NOT_GRANTED'));
  });

  it('qualifies HELIOS_EXEC11_CUSTODY_ISOLATION_QUALIFIED', () => {
    const result = evaluateExec11CustodyIsolationQualification();
    assert.equal(result.qualified, true, result.blockers.join(', '));
    assert.equal(result.marker, HELIOS_EXEC11_CUSTODY_ISOLATION_QUALIFIED);
  });
});
