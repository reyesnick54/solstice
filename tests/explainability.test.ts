import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { explainProposal } from '../packages/agent/src/explain/explain.ts';
import { Money } from '../packages/contracts/src/money.ts';
import { asAgentId, asCustomerId, asMandateClauseId, asProposalId } from '../packages/contracts/src/ids.ts';
import { asUtcInstant } from '../packages/contracts/src/time.ts';
import type { AgentProposal } from '../packages/contracts/src/proposal.ts';

describe('explainability', () => {
  it('builds the reserve explanation from recorded factors only', () => {
    const proposal: AgentProposal = Object.freeze({
      proposalId: asProposalId('exp_1'),
      agentId: asAgentId('agent_test'),
      customerId: asCustomerId('cust_test'),
      actionType: 'ALLOCATE_TO_RESERVE',
      amount: Money.fromMinorUnits(100n, 'USD'),
      targetAccountClass: 'deposits',
      reasonCode: 'RESERVE_BELOW_TARGET',
      mandateClauseId: asMandateClauseId('clause_1'),
      recordedFactors: Object.freeze([
        { key: 'waterfall_step' as const, step: 'EMERGENCY_RESERVE_TARGET' },
        { key: 'savings_balance' as const, amount: Money.fromMinorUnits(820_000n, 'USD') },
        { key: 'monthly_essential_spending' as const, amount: Money.fromMinorUnits(410_000n, 'USD') },
        { key: 'reserve_months' as const, months: 2n },
        { key: 'reason_code' as const, code: 'RESERVE_BELOW_TARGET' },
      ]),
      sourceAccountId: null,
      targetAccountId: null,
      requiresDepositInvestmentAgreement: false,
      emittedAt: asUtcInstant('2026-08-13T15:00:00.000Z'),
    });

    const text = explainProposal(proposal);
    assert.equal(
      text,
      'Keeping $8,200.00 USD in savings because average monthly essential spending is $4,100.00 USD and your reserve setting is 2 months.',
    );
    assert.equal(text.includes('chain-of-thought'), false);
  });
});
