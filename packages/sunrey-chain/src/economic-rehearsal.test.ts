import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { ProtocolTreasuryRehearsal } from './economic-rehearsal/treasury.ts';
import { rehearseFeePolicyV2Loads, rehearseMoonReyEconomy, rehearseSunReyMoonReyExchange } from './economic-rehearsal/workflows.ts';
import { extendedEconomicRunPlan } from './economic-rehearsal/extended-run.ts';

describe('Chunk 80 economic rehearsal units', () => {
  it('rejects treasury reach into customer, custody, exchange, and fiat paths', () => {
    const engine = new ProtocolTreasuryRehearsal();
    engine.fundFromFees(100n);
    engine.reserve('r1', 50n);
    assert.equal(engine.disburse('r1', 'd1', 'wallet.customer.synthetic'), false);
    assert.equal(engine.disburse('r1', 'd2', 'custody.customer.account'), false);
    assert.equal(engine.disburse('r1', 'd3', 'exchange.customer.obligation'), false);
    assert.equal(engine.disburse('r1', 'd4', 'ledger.fiat.customer'), false);
    assert.equal(engine.disburse('r1', 'd5', 'rehearsal.treasury.ops'), true);
    assert.equal(engine.disburse('r1', 'd5', 'rehearsal.treasury.ops'), false);
    assert.equal(engine.reconcile(), true);
  });

  it('rejects MoonRey double-count paths and keeps FeePolicyV2 exact', () => {
    const moonrey = rehearseMoonReyEconomy();
    assert.equal(moonrey.duplicateRejected, true);
    assert.equal(moonrey.crossCategoryDuplicateRejected, true);
    const fees = rehearseFeePolicyV2Loads();
    assert.equal(fees.dispositionExact, true);
    assert.equal(fees.maxFeeProtection, true);
    assert.equal(fees.productionParametersConfigured, false);
  });

  it('discovers SUNREY/MOONREY price from synthetic flow with no peg', () => {
    const market = rehearseSunReyMoonReyExchange();
    assert.equal(market.noPeg, true);
    assert.equal(market.noGuaranteedRatio, true);
    assert.equal(market.duplicateDvpRejected, true);
    assert.equal(market.reconciled, true);
  });

  it('does not claim an unexecuted extended run', () => {
    const plan = extendedEconomicRunPlan();
    assert.equal(plan.executed, false);
    assert.equal(plan.epochs, 48);
  });
});
