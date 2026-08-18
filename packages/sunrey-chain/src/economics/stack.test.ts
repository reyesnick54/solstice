import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { explorerSupplyReport } from './explorer.ts';
import { createIntegratedEconomicStack } from './stack.ts';

describe('Chunk 76 integrated economic stack', () => {
  it('routes FeePolicyV2 validator rewards into ValidatorEconomicsEngine', () => {
    const stack = createIntegratedEconomicStack();
    const executed = stack.executeTransferFee({
      label: 'stack-fee-1',
      amount: 25n,
      maxFee: 50_000n,
    });
    assert.equal(executed.ok, true);
    assert.equal(stack.feeRewards > 0n, true);
    assert.equal(stack.ingestedRewards, stack.feeRewards);
    assert.equal(stack.fees.rewardsOf('val_a').SUNREY_COIN, 0n);
    const settled = stack.settleValidatorEpoch();
    assert.equal(settled.ok, true);
    assert.equal(settled.paid > 0n, true);
    assert.equal(stack.reconcile().validatorRewardMatchesIngested, true);
  });

  it('records fee burn on the canonical monetary book', () => {
    const stack = createIntegratedEconomicStack();
    stack.executeTransferFee({ label: 'stack-burn-1', amount: 10n, maxFee: 50_000n });
    assert.equal(stack.sunrey.burned, stack.feeBurned);
    assert.equal(stack.feeBurned > 0n, true);
    const explorer = explorerSupplyReport([stack.sunrey, stack.moonrey], { SUNREY_COIN: stack.feeBurned });
    assert.equal(explorer.assets[0]!.feeBurn, stack.feeBurned);
    assert.equal(explorer.assets[0]!.reconciliation, 'EXACT');
    assert.equal(explorer.tickerStatus, 'NOT_ASSIGNED');
  });

  it('authorizes MoonRey through MonetaryIssuanceAuthority', () => {
    const stack = createIntegratedEconomicStack();
    stack.registerProductiveObject({
      objectId: 'obj.energy.0',
      category: 'ENERGY',
      unit: 'kWh',
      owner: 'ctl.op_0',
    });
    const issued = stack.issueMoonReyFromClaim({
      claimId: 'claim.obj.energy.0.1',
      objectId: 'obj.energy.0',
      category: 'ENERGY',
      quantity: 100n,
      unit: 'kWh',
      controller: 'ctl.op_0',
      epoch: 1,
      providerCount: 3,
    });
    assert.equal(issued.ok, true);
    assert.equal(stack.moonrey.issuedPostGenesis > 0n, true);
    const replay = stack.issueMoonReyFromClaim({
      claimId: 'claim.obj.energy.0.1b',
      objectId: 'obj.energy.0',
      category: 'ENERGY',
      quantity: 100n,
      unit: 'kWh',
      controller: 'ctl.op_0',
      epoch: 1,
      providerCount: 3,
    });
    assert.equal(replay.ok, false);
    assert.equal(stack.duplicateMoonReyAttempts > 0 || replay.ok === false, true);
    assert.equal(stack.reconcile().productiveMatchesConstitution, true);
  });

  it('does not advance economic state without finality', () => {
    const stack = createIntegratedEconomicStack();
    stack.finalityAvailable = false;
    const executed = stack.executeTransferFee({ label: 'no-quorum', amount: 1n, maxFee: 1_000n });
    assert.equal(executed.ok, false);
    assert.equal(stack.feeCharged, 0n);
    assert.equal(stack.pendingOperations > 0, true);
  });

  it('keeps customer holdings isolated from validator penalties', () => {
    const stack = createIntegratedEconomicStack();
    const before = stack.validators.customerBalance('household');
    stack.applyValidatorPenalty('val_a', 'ev_stack_1');
    assert.equal(stack.validators.customerBalance('household'), before);
    assert.equal(stack.penalizedUnits > 0n, true);
  });
});
