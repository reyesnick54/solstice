/**
 * HELIOS EXECUTION CONNECTIVITY — EXEC11 custody movement and financial-action isolation.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  HELIOS_EXEC11_CUSTODY_ISOLATION_QUALIFIED,
  authorizeAgentWithdrawalAction,
  defaultGrowTradingAgentGrant,
  evaluateCustodyMovementIsolation,
  evaluateExec11CustodyIsolationQualification,
  evaluateWithdrawalAuthorityRequirements,
  resolveCustodyRailPath,
} from '../packages/custody/src/execution-connectivity/exec11/index.ts';

describe('HELIOS EXEC11 execution connectivity — custody isolation', () => {
  it('separates TRADE from WITHDRAW for Grow trading agents', () => {
    const grant = defaultGrowTradingAgentGrant('grant_helios_exec11');
    const trade = evaluateCustodyMovementIsolation({
      requestId: 'trade_1',
      authority: 'TRADE',
      rail: 'SECURITIES',
      grant,
    });
    const withdraw = evaluateCustodyMovementIsolation({
      requestId: 'withdraw_1',
      authority: 'WITHDRAW',
      rail: 'SECURITIES',
      grant,
    });
    assert.equal(trade.decision, 'PERMITTED');
    assert.equal(withdraw.decision, 'DENIED');
  });

  it('requires full withdrawal envelope before outbound movement', () => {
    const incomplete = evaluateWithdrawalAuthorityRequirements({
      rail: 'DIGITAL_ASSET',
      customerMandatePresent: true,
      destinationValidated: true,
      kernelAuthorizationPresent: false,
      stepUpSatisfied: true,
      complianceScreeningCleared: true,
      travelRuleComplete: true,
      travelRuleApplicable: true,
      custodyProviderAccepted: true,
    });
    assert.equal(incomplete.allSatisfied, false);
  });

  it('blocks agent forbidden withdrawal actions', () => {
    assert.equal(authorizeAgentWithdrawalAction('APPROVE_OWN_WITHDRAWAL').outcome, 'DENIED');
    assert.equal(authorizeAgentWithdrawalAction('PREPARE_WITHDRAWAL_PROPOSAL').outcome, 'ALLOWED');
  });

  it('preserves digital-asset provider boundaries and avoids crypto semantics on securities', () => {
    const digital = resolveCustodyRailPath('DIGITAL_ASSET', true);
    const securities = resolveCustodyRailPath('SECURITIES');
    assert.equal(digital.hsmMpcBoundaryPreserved, true);
    assert.equal(securities.rail, 'SECURITIES');
    assert.equal('forcedCryptoSemantics' in securities && securities.forcedCryptoSemantics, false);
  });

  it('emits HELIOS_EXEC11_CUSTODY_ISOLATION_QUALIFIED', () => {
    const q = evaluateExec11CustodyIsolationQualification();
    assert.equal(q.marker, HELIOS_EXEC11_CUSTODY_ISOLATION_QUALIFIED);
    assert.equal(q.qualified, true);
  });
});
