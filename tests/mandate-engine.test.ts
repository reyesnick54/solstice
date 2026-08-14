import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { compileMandate } from '../packages/agent/src/mandates/compile.ts';
import { claims, NOW } from './helpers.ts';

describe('mandate engine', () => {
  const base = {
    customerId: 'cust_test',
    claims: claims(),
    currency: 'USD',
    compiledAt: NOW,
    version: 1,
  };

  it('compiles keep $10,000 liquid', () => {
    const result = compileMandate({ ...base, sourceText: 'keep $10,000 liquid' });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.value.constraint.kind, 'KEEP_LIQUID');
    if (result.value.constraint.kind === 'KEEP_LIQUID') {
      assert.equal(result.value.constraint.amount.minorUnits, 1_000_000n);
    }
  });

  it('compiles six months of expenses as reserves', () => {
    const result = compileMandate({
      ...base,
      sourceText: 'maintain six months of expenses as reserves',
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.value.constraint.kind, 'RESERVE_MONTHS');
    if (result.value.constraint.kind === 'RESERVE_MONTHS') {
      assert.equal(result.value.constraint.months, 6n);
    }
  });

  it('compiles invest surplus cash', () => {
    const result = compileMandate({ ...base, sourceText: 'invest surplus cash' });
    assert.equal(result.ok, true);
    if (result.ok) assert.equal(result.value.constraint.kind, 'INVEST_SURPLUS');
  });

  it('compiles never exceed Moderate risk', () => {
    const result = compileMandate({ ...base, sourceText: 'never exceed Moderate risk' });
    assert.equal(result.ok, true);
    if (result.ok && result.value.constraint.kind === 'RISK_CEILING') {
      assert.equal(result.value.constraint.max, 'MODERATE');
    }
  });

  it('compiles reinvest 75% of realized gains as a rational share, not a return', () => {
    const result = compileMandate({ ...base, sourceText: 'reinvest 75% of realized gains' });
    assert.equal(result.ok, true);
    if (result.ok && result.value.constraint.kind === 'REINVEST_REALIZED_GAINS') {
      assert.equal(result.value.constraint.share.numerator, 75n);
      assert.equal(result.value.constraint.share.denominator, 100n);
    }
  });

  it('compiles move 25% of realized gains to savings weekly', () => {
    const result = compileMandate({
      ...base,
      sourceText: 'move 25% of realized gains to savings weekly',
    });
    assert.equal(result.ok, true);
    if (result.ok && result.value.constraint.kind === 'WEEKLY_GAINS_TO_SAVINGS') {
      assert.equal(result.value.constraint.share.numerator, 25n);
      assert.equal(result.value.constraint.share.denominator, 100n);
    }
  });

  it('compiles research opportunities paying more than $20', () => {
    const result = compileMandate({
      ...base,
      sourceText: 'show me research opportunities paying more than $20',
    });
    assert.equal(result.ok, true);
    if (result.ok && result.value.constraint.kind === 'RESEARCH_PAY_FLOOR') {
      assert.equal(result.value.constraint.minCompensation.minorUnits, 2000n);
    }
  });

  it('rejects an uncompilable mandate with an explanation', () => {
    const result = compileMandate({
      ...base,
      sourceText: 'beat the market and do whatever seems smart',
    });
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.error.code, 'MANDATE_UNCOMPILABLE');
    assert.match(result.error.explanation, /cannot be compiled deterministically/);
    assert.match(result.error.explanation, /never approximated/);
  });

  it('rejects a mandate that would widen token risk ceiling', () => {
    const result = compileMandate({
      ...base,
      sourceText: 'never exceed Aggressive risk',
    });
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.error.code, 'MANDATE_WIDENS_TOKEN');
  });

  it('rejects invest surplus when the token does not allow INVESTMENT_SWEEP', () => {
    const result = compileMandate({
      ...base,
      claims: claims({ allowedProposalTypes: ['HOLD_LIQUIDITY'] }),
      sourceText: 'invest surplus cash',
    });
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.error.code, 'MANDATE_WIDENS_TOKEN');
  });
});
