import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import {
  BURN_ACCOUNT,
  FAILED_TX_FEE_POLICY,
  FeeEngine,
  FeeMempool,
  MAX_TX_EXECUTION_UNITS,
  NETWORK_SINK_ACCOUNT,
  RESOURCE_CLASSES,
  applyFeeGovernance,
  blockFitsLimits,
  calculateFee,
  compareForSelection,
  developmentBlockLimits,
  developmentFeeSchedule,
  dispositionReconciles,
  hashFeeSchedule,
  usageForOperation,
} from './fees/index.ts';
import {
  FOUR_VALIDATORS,
  receiptReconciles,
  runFeeGovernanceActivation,
  runFourValidatorFeeDemo,
  transferTx,
  txId,
} from './fees/demo-helpers.ts';
import type { ExecutableTransaction } from './fees/index.ts';
import type { UpgradePlan as GovernancePlan } from './governance/types.ts';

function sourceOf(relative: string): string {
  return readFileSync(join(import.meta.dirname, relative), 'utf8');
}

describe('SunRey native fees and resource metering', () => {
  it('meters the same transaction to the same resource usage', () => {
    const left = usageForOperation('NATIVE_TRANSFER', 240, 1);
    const right = usageForOperation('NATIVE_TRANSFER', 240, 1);
    assert.deepEqual(left, right);
    assert.equal(RESOURCE_CLASSES.length, 6);
  });

  it('computes the same fee from the same usage without floating point', () => {
    const schedule = developmentFeeSchedule();
    const usage = usageForOperation('NATIVE_TRANSFER', 240, 1);
    assert.equal(calculateFee(schedule, usage), calculateFee(schedule, usage));
    const sources = [
      sourceOf('fees/types.ts'),
      sourceOf('fees/meter.ts'),
      sourceOf('fees/schedule.ts'),
      sourceOf('fees/policy.ts'),
      sourceOf('fees/engine.ts'),
    ].join('\n');
    assert.equal(/\b(parseFloat|Number\(|Math\.(pow|log|exp)|\/\s*\d+\.\d+)/.test(sources), false);
  });

  it('enforces max fee and returns unused reserved quantity', () => {
    const engine = new FeeEngine();
    engine.faucet('alice', 50_000n);
    const tx = transferTx(txId('max-fee'), 'alice', 'bob', 100n, 5_000n);
    const result = engine.execute({
      tx,
      blockHeight: 1,
      blockId: 'b1',
      proposerId: 'val_a',
      validators: FOUR_VALIDATORS,
    });
    assert.equal(result.ok, true);
    if (!result.ok) {
      return;
    }
    assert.equal(result.receipt.actualFee <= result.receipt.reservedFee, true);
    assert.equal(result.receipt.reservedFee, result.receipt.actualFee + result.receipt.releasedFee);
    assert.equal(engine.accounts.position('alice', 'SUNREY_COIN').reserved, 0n);
    assert.equal(engine.accounts.position('bob', 'SUNREY_COIN').available, 100n);
  });

  it('rejects insufficient max fee, unsupported asset, and unauthenticated payer', () => {
    const engine = new FeeEngine();
    engine.faucet('alice', 50_000n);
    const low = engine.validateAdmission(transferTx(txId('low'), 'alice', 'bob', 1n, 1n));
    assert.equal(low?.code === 'FEE_BELOW_MINIMUM' || low?.code === 'INSUFFICIENT_MAX_FEE', true);

    const moon: ExecutableTransaction = {
      ...transferTx(txId('moon'), 'alice', 'bob', 1n, 5_000n),
      budget: {
        maxExecutionUnits: 10_000n,
        maxFee: 5_000n,
        feeAsset: 'MOONREY_COIN',
        feePayer: 'alice',
        exemption: 'NONE',
      },
    };
    assert.equal(engine.validateAdmission(moon)?.code, 'UNSUPPORTED_FEE_ASSET');

    const unauth: ExecutableTransaction = { ...transferTx(txId('unauth'), 'alice', 'bob', 1n, 5_000n), payerAuthenticated: false };
    assert.equal(engine.validateAdmission(unauth)?.code, 'FEE_PAYER_UNAUTHENTICATED');
  });

  it('enforces the execution budget atomically', () => {
    const engine = new FeeEngine();
    engine.faucet('alice', 50_000n);
    const before = engine.accounts.position('bob', 'SUNREY_COIN').available;
    const result = engine.execute({
      tx: { ...transferTx(txId('oob'), 'alice', 'bob', 25n, 5_000n, 20n), forceOverBudget: true },
      blockHeight: 1,
      blockId: 'b1',
      proposerId: 'val_a',
      validators: FOUR_VALIDATORS,
    });
    assert.equal(result.ok, false);
    if (result.ok) {
      return;
    }
    assert.equal(result.rejection.code, 'OUT_OF_EXECUTION_UNITS');
    assert.equal(engine.accounts.position('bob', 'SUNREY_COIN').available, before);
    const receipt = engine.receiptOf(txId('oob'));
    assert.ok(receipt);
    assert.equal(receipt.outcome, 'OUT_OF_EXECUTION_UNITS');
    assert.equal(receipt.actualFee > 0n, true);
  });

  it('keeps failed application execution atomic while charging metered fees', () => {
    const engine = new FeeEngine();
    engine.faucet('alice', 50_000n);
    const result = engine.execute({
      tx: { ...transferTx(txId('fail'), 'alice', 'bob', 25n, 5_000n), applicationShouldFail: true },
      blockHeight: 1,
      blockId: 'b1',
      proposerId: 'val_a',
      validators: FOUR_VALIDATORS,
    });
    assert.equal(result.ok, true);
    if (!result.ok) {
      return;
    }
    assert.equal(result.applicationApplied, false);
    assert.equal(engine.accounts.position('bob', 'SUNREY_COIN').available, 0n);
    assert.equal(result.receipt.actualFee > 0n, true);
    assert.equal(FAILED_TX_FEE_POLICY.enteredBlockControlledFailure, 'CHARGE_METERED_USAGE_ATOMIC_APP_ROLLBACK');
  });

  it('reconciles fee disposition and validator reward calculation', () => {
    const engine = new FeeEngine();
    engine.faucet('alice', 50_000n);
    const result = engine.execute({
      tx: transferTx(txId('disp'), 'alice', 'bob', 10n, 5_000n),
      blockHeight: 1,
      blockId: 'b1',
      proposerId: 'val_a',
      validators: FOUR_VALIDATORS,
    });
    assert.equal(result.ok, true);
    if (!result.ok) {
      return;
    }
    assert.equal(dispositionReconciles(result.receipt.disposition), true);
    assert.equal(receiptReconciles(result.receipt), true);
    const accrued =
      engine.rewardsOf('val_a').SUNREY_COIN +
      engine.rewardsOf('val_b').SUNREY_COIN +
      engine.rewardsOf('val_c').SUNREY_COIN +
      engine.rewardsOf('val_d').SUNREY_COIN;
    assert.equal(accrued, result.receipt.disposition.validatorRewardPool);
    const claimed = engine.claimRewards('val_a', 'SUNREY_COIN');
    assert.equal(engine.accounts.position('val_a', 'SUNREY_COIN').available, claimed);
    assert.equal(engine.rewardsOf('val_a').SUNREY_COIN, 0n);
    assert.equal(engine.accounts.position(NETWORK_SINK_ACCOUNT, 'SUNREY_COIN').available, result.receipt.disposition.networkSink);
    assert.equal(engine.accounts.position(BURN_ACCOUNT, 'SUNREY_COIN').available, result.receipt.disposition.burned);
  });

  it('changes the fee schedule only at the activation height', () => {
    const activation = runFeeGovernanceActivation();
    assert.equal(activation.before, 100n);
    assert.equal(activation.after, 250n);
    const engine = new FeeEngine();
    const plan = {
      upgradeId: 'upg',
      upgradeKind: 'FEE_PARAMETER_CHANGE',
      status: 'ACTIVATED',
      activationHeight: 12,
      payload: { fee_schedule: { version: 2, minimum_fee: 300 } },
    } as unknown as GovernancePlan;
    applyFeeGovernance(engine, plan, 11);
    assert.equal(engine.schedule.minimumFee, 100n);
    applyFeeGovernance(engine, plan, 12);
    assert.equal(engine.schedule.minimumFee, 300n);
    assert.equal(engine.schedule.activationHeight, 12);
  });

  it('orders the mempool deterministically and enforces block resource limits', () => {
    const engine = new FeeEngine();
    engine.faucet('alice', 1_000_000n);
    const mempool = new FeeMempool(engine);
    const cheap = transferTx(txId('cheap'), 'alice', 'bob', 1n, 1_000n, 50_000n);
    const expensive = transferTx(txId('expensive'), 'alice', 'bob', 1n, 9_000n, 10_000n);
    assert.equal(mempool.admit(cheap), null);
    assert.equal(mempool.admit(expensive), null);
    const selected = mempool.selectForBlock();
    const first = selected[0];
    assert.ok(first);
    assert.equal(first.transactionId, expensive.transactionId);
    assert.equal(compareForSelection(expensive, cheap) < 0, true);
    const tight = developmentBlockLimits();
    const limited = { ...tight, maxBytes: 100n };
    assert.equal(blockFitsLimits([cheap], limited), false);
    assert.equal(MAX_TX_EXECUTION_UNITS > 0n, true);
  });

  it('produces identical fee receipts across four validators', () => {
    const demo = runFourValidatorFeeDemo();
    assert.equal(demo.receipts.length, 4);
    assert.equal(new Set(demo.stateRoots).size, 1);
    assert.equal(demo.insufficientRejected, true);
    assert.equal(demo.overBudget.code, 'OUT_OF_EXECUTION_UNITS');
    assert.equal(demo.overBudget.bobAvailable, 1_000n);
    assert.equal(hashFeeSchedule(developmentFeeSchedule()).length, 64);
  });

  it('does not debit a fiat ledger and isolates the development faucet', () => {
    const engine = new FeeEngine();
    engine.faucet('alice', 10_000n);
    assert.equal(engine.accounts.position('alice', 'SUNREY_COIN').available, 10_000n);
    const faucetTx: ExecutableTransaction = {
      transactionId: txId('faucet'),
      operation: 'DEVELOPMENT_FAUCET',
      payerAuthenticated: true,
      encodedBytes: 80,
      signatureCount: 1,
      budget: {
        maxExecutionUnits: 1_000n,
        maxFee: 0n,
        feeAsset: 'SUNREY_COIN',
        feePayer: 'faucet',
        exemption: 'DEVELOPMENT_FAUCET',
      },
      transfer: { from: 'faucet', to: 'dave', asset: 'SUNREY_COIN', amount: 500n },
    };
    const result = engine.execute({
      tx: faucetTx,
      blockHeight: 1,
      blockId: 'b1',
      proposerId: 'val_a',
      validators: FOUR_VALIDATORS,
    });
    assert.equal(result.ok, true);
    if (!result.ok) {
      return;
    }
    assert.equal(result.receipt.actualFee, 0n);
    assert.equal(engine.accounts.position('dave', 'SUNREY_COIN').available, 500n);
    const src = sourceOf('fees/engine.ts');
    assert.equal(/postJournal|debitCustomer|fiat ledger/i.test(src), false);
  });
});
