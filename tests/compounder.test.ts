import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { COMPOUNDER_WATERFALL, runCompounder } from '../packages/agent/src/compounder/waterfall.ts';
import { compileMandate } from '../packages/agent/src/mandates/compile.ts';
import { claims, context, NOW, USD, account } from './helpers.ts';
import { Money } from '../packages/contracts/src/money.ts';
import type { CompiledMandate } from '../packages/contracts/src/mandate-types.ts';

function mustCompile(text: string, version: number): CompiledMandate {
  const result = compileMandate({
    customerId: 'cust_test',
    sourceText: text,
    claims: claims(),
    currency: 'USD',
    compiledAt: NOW,
    version,
  });
  assert.equal(result.ok, true);
  if (!result.ok) throw new Error(result.error.explanation);
  return result.value;
}

describe('Compounder waterfall', () => {
  it('has the required fixed order', () => {
    assert.deepEqual(COMPOUNDER_WATERFALL, [
      'EMERGENCY_RESERVE_TARGET',
      'NEAR_TERM_OBLIGATIONS',
      'HIGH_COST_DEBT',
      'REQUIRED_LIQUIDITY',
      'INVESTMENT_MANDATE',
      'USER_GOALS',
      'PERMITTED_ALLOCATION',
    ]);
  });

  it('fills gaps in waterfall order and leaves remainder to later steps', () => {
    const mandates = [
      mustCompile('maintain two months of expenses as reserves', 1),
      mustCompile('keep $350 liquid', 2),
    ];
    const ctx = context({
      monthlyEssentialSpending: USD(10_000n),
      balancesByClass: {
        deposits: USD(0n),
        investments: USD(0n),
        digital_assets: USD(0n),
        rewards: USD(0n),
        pending: USD(0n),
      },
      nearTermObligations: [
        {
          name: 'rent',
          amount: USD(5_000n),
          dueAt: NOW,
        },
      ],
      highCostDebt: [{ name: 'card', balance: USD(4_000n), isHighCost: true }],
      userGoals: [{ name: 'vacation', remaining: USD(3_000n) }],
    });

    const proposals = runCompounder({
      newMoney: USD(50_000n),
      context: ctx,
      claims: claims(),
      mandates,
      now: NOW,
      proposalIdPrefix: 'wf',
    });

    const steps = proposals.map(
      (p) => p.recordedFactors.find((f) => f.key === 'waterfall_step'),
    );
    const stepNames = steps.map((s) => (s && 'step' in s ? s.step : ''));
    assert.deepEqual(stepNames, [
      'EMERGENCY_RESERVE_TARGET',
      'NEAR_TERM_OBLIGATIONS',
      'HIGH_COST_DEBT',
      'REQUIRED_LIQUIDITY',
      'USER_GOALS',
      'PERMITTED_ALLOCATION',
    ]);
    assert.equal(proposals[0]?.actionType, 'ALLOCATE_TO_RESERVE');
    assert.equal(proposals[0]?.amount.minorUnits, 20_000n);
    assert.equal(proposals[1]?.actionType, 'HOLD_LIQUIDITY');
    assert.equal(proposals[2]?.actionType, 'PAY_HIGH_COST_DEBT');
    assert.equal(proposals[5]?.actionType, 'PERMITTED_ALLOCATION');
    const total = proposals.reduce((acc, p) => acc.plus(p.amount), Money.zero('USD'));
    assert.equal(total.minorUnits, 50_000n);
  });

  it('emits an investment sweep for surplus when the mandate is present', () => {
    const mandates = [mustCompile('invest surplus cash', 1)];
    const ctx = context({
      accounts: [
        account('acct_dep', 'deposits', USD(50_000_00n), true),
        account('acct_inv', 'investments', USD(0n), false),
      ],
      balancesByClass: {
        deposits: USD(50_000_00n),
        investments: USD(0n),
        digital_assets: USD(0n),
        rewards: USD(0n),
        pending: USD(0n),
      },
    });
    const proposals = runCompounder({
      newMoney: USD(10_000_00n),
      context: ctx,
      claims: claims(),
      mandates,
      now: NOW,
      proposalIdPrefix: 'inv',
    });
    assert.equal(proposals.length, 1);
    assert.equal(proposals[0]?.actionType, 'INVESTMENT_SWEEP');
    assert.equal(proposals[0]?.requiresDepositInvestmentAgreement, true);
  });
});
