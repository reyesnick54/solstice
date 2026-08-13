import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createControlPlane } from '../packages/platform/src/runtime.ts';
import { PersonalEconomyAgent } from '../packages/agent/src/runtime/PersonalEconomyAgent.ts';
import { compileMandate } from '../packages/agent/src/mandates/compile.ts';
import { explainProposal, explainRefusal } from '../packages/agent/src/explain/explain.ts';
import { issueToken, context, NOW, USD, account } from './helpers.ts';
import { GROWTH_SOURCES, CANONICAL_REALIZATION } from '../packages/contracts/src/growth-catalog.ts';
import { LIVE_FLAGS } from '../packages/platform/src/flags/live.ts';

describe('Phase 4 exit: propose, be refused, explain, cannot execute', () => {
  it('meets the phase 4 criterion', () => {
    const runtime = createControlPlane();
    const token = issueToken(runtime.tokens);
    const invest = compileMandate({
      customerId: 'cust_test',
      sourceText: 'invest surplus cash',
      claims: token,
      currency: 'USD',
      compiledAt: NOW,
      version: 1,
    });
    assert.equal(invest.ok, true);
    if (!invest.ok) return;

    const agent = new PersonalEconomyAgent({
      context: context({
        accounts: [
          account('acct_dep_ok', 'deposits', USD(1_000n), true),
          account('acct_dep_no', 'deposits', USD(1_000n), false),
          account('acct_inv', 'investments', USD(0n), false),
        ],
      }),
      claims: token,
      mandates: [invest.value],
    });

    const allowed = agent.proposeInvestmentSweep({
      sourceAccountId: 'acct_dep_ok',
      targetAccountId: 'acct_inv',
      amount: USD(500n),
      now: NOW,
      proposalId: 'p4_allow',
    });
    const refused = agent.proposeInvestmentSweep({
      sourceAccountId: 'acct_dep_no',
      targetAccountId: 'acct_inv',
      amount: USD(500n),
      now: NOW,
      proposalId: 'p4_refuse',
    });

    const allowDecision = runtime.gate.submitProposal(allowed, token, NOW);
    const refuseDecision = runtime.gate.submitProposal(refused, token, NOW);

    assert.equal(allowDecision.outcome, 'ALLOWED');
    assert.equal(refuseDecision.outcome, 'REFUSED');
    assert.match(explainProposal(allowed), /investment sweep/);
    assert.match(
      explainRefusal(refused, refuseDecision.outcome === 'REFUSED' ? refuseDecision.reason : ''),
      /refuse/i,
    );
    assert.equal(runtime.ledger.count(), 0);
    assert.equal(runtime.authorityIssuer.issuedCount(), 0);
    assert.equal(LIVE_FLAGS.LIVE_MONEY_MOVEMENT, false);
    assert.equal(LIVE_FLAGS.LIVE_EXTERNAL_EXECUTION, false);
  });
});

describe('Phase 5 exit: weekly delta is real, sourced, honest about realization class', () => {
  it('meets the phase 5 criterion', () => {
    const runtime = createControlPlane();
    const token = issueToken(runtime.tokens);

    for (const source of GROWTH_SOURCES) {
      const event = runtime.events.append('growth.entry.recorded', NOW, { source });
      runtime.growth.record({
        customerId: token.customerId,
        source,
        amount: USD(100n),
        originatingEventId: event.id,
        recordedAt: NOW,
      });
    }

    const weekly = runtime.growth.summarize({
      customerId: token.customerId,
      period: 'WEEKLY',
      from: NOW,
      to: NOW,
      currency: 'USD',
    });

    for (const source of GROWTH_SOURCES) {
      assert.equal(weekly.bySource[source].minorUnits, 100n);
      assert.equal(CANONICAL_REALIZATION[source] in weekly.byRealizationClass, true);
    }
    assert.ok(weekly.settledCashTotal.isPositive());
    assert.ok(weekly.costAvoidedTotal.isPositive());
    assert.ok(weekly.unrealizedTotal.isPositive());
    assert.ok(weekly.pendingTotal.isPositive());
    assert.equal('income' in weekly, false);
    assert.equal(JSON.stringify(weekly).includes('%'), false);
    assert.equal(LIVE_FLAGS.REAL_MONEY_ENABLED, false);
  });
});
