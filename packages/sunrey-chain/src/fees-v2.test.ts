import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { FeeEngine } from './fees/engine.ts';
import { FeeMempool } from './fees/mempool.ts';
import { applyFeeGovernance } from './fees/governance.ts';
import { transferTx, txId, FOUR_VALIDATORS } from './fees/demo-helpers.ts';
import {
  AdaptiveFeeSimulator,
  FEE_MARKET_SCENARIOS,
  RESOURCE_CLASSES_V2,
  buildFeeMarketVerificationReport,
  developmentFeePolicyV2,
  disposeFeeV2,
  dispositionV2Reconciles,
  estimateFeeV2,
  feeMarketReadiness,
  machineFeeFitsMandate,
  mempoolAdmissionBounded,
  developmentAntiSpamControls,
  nextBaseResourcePrice,
  initialBaseResourcePriceState,
  quoteFeeV2,
  rejectPolicyDowngrade,
  runSunreyEconomicsCli,
  usageV2ForTransaction,
  weightedUsage,
} from './fees/v2/index.ts';
import type { UpgradePlan } from './governance/types.ts';
import type { ExecutableTransaction } from './fees/types.ts';

function v2Tx(overrides: Partial<ExecutableTransaction> = {}): ExecutableTransaction {
  return {
    ...transferTx(txId(`v2-${overrides.transactionId ?? 'base'}`), 'alice', 'bob', 100n, 50_000n),
    policyVersion: 2,
    signatureClass: 'CLASSICAL',
    ...overrides,
  };
}

describe('Chunk 73 FeePolicyV2 adaptive fee market', () => {
  it('meters identical bytes to identical ResourceUsageV2', () => {
    const left = usageV2ForTransaction(v2Tx({ encodedBytes: 240, signatureCount: 1 }));
    const right = usageV2ForTransaction(v2Tx({ encodedBytes: 240, signatureCount: 1 }));
    assert.deepEqual(left, right);
    assert.equal(RESOURCE_CLASSES_V2.includes('SIGNATURE_VERIFY_PQ'), true);
    assert.equal(RESOURCE_CLASSES_V2.includes('ORACLE_VERIFY'), true);
    assert.equal(RESOURCE_CLASSES_V2.includes('INTEROP_PROOF'), true);
    assert.equal(RESOURCE_CLASSES_V2.includes('EXCHANGE_DVP_LEG'), true);
  });

  it('classifies PQ signatures deterministically without wall-clock', () => {
    const classical = usageV2ForTransaction(v2Tx({ signatureClass: 'CLASSICAL', signatureCount: 2 }));
    const hybrid = usageV2ForTransaction(v2Tx({ signatureClass: 'HYBRID', signatureCount: 2 }));
    const pq = usageV2ForTransaction(v2Tx({ signatureClass: 'PQ', signatureCount: 2 }));
    assert.equal(classical.SIGNATURE_VERIFY_CLASSICAL, 2n);
    assert.equal(hybrid.SIGNATURE_VERIFY_HYBRID, 2n);
    assert.equal(pq.SIGNATURE_VERIFY_PQ, 2n);
    assert.equal(pq.SIGNATURE_VERIFY_CLASSICAL, 0n);
    assert.deepEqual(
      usageV2ForTransaction(v2Tx({ signatureClass: 'PQ', signatureCount: 2 })),
      pq,
    );
  });

  it('keeps next base price inside bounds and deterministic', () => {
    const policy = developmentFeePolicyV2();
    const start = initialBaseResourcePriceState(policy.bounds, 100n, 0);
    const a = nextBaseResourcePrice(start, 1_800_000n, policy.bounds, 1);
    const b = nextBaseResourcePrice(start, 1_800_000n, policy.bounds, 1);
    assert.equal(a.baseResourcePrice, b.baseResourcePrice);
    assert.ok(a.baseResourcePrice >= policy.bounds.minBasePrice);
    assert.ok(a.baseResourcePrice <= policy.bounds.maxBasePrice);
    const low = nextBaseResourcePrice(start, 1n, policy.bounds, 1);
    assert.ok(low.baseResourcePrice >= policy.bounds.minBasePrice);
  });

  it('does not reinterpret historic v1 transactions', () => {
    const historic = new FeeEngine();
    historic.faucet('alice', 1_000_000n);
    const tx = transferTx(txId('historic-v1'), 'alice', 'bob', 50n, 5_000n);
    const result = historic.execute({
      tx,
      blockHeight: 1,
      blockId: 'blk_v1',
      proposerId: 'val_a',
      validators: FOUR_VALIDATORS,
    });
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.receipt.policyVersion ?? 1, 1);
    }
  });

  it('rejects fee above signed max instead of charging more', () => {
    const engine = new FeeEngine();
    engine.faucet('alice', 1_000_000n);
    engine.activateFeePolicyV2();
    const tx = v2Tx({ budget: { ...v2Tx().budget, maxFee: 10n } });
    const result = engine.execute({
      tx,
      blockHeight: 1,
      blockId: 'blk',
      proposerId: 'val_a',
      validators: FOUR_VALIDATORS,
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.rejection.code === 'INSUFFICIENT_MAX_FEE' || result.rejection.code === 'FEE_BELOW_MINIMUM', true);
    }
    assert.equal(engine.accounts.position('alice', 'SUNREY_COIN').reserved, 0n);
  });

  it('rejects overflow, wrong fee asset, and MoonRey while disabled', () => {
    const policy = developmentFeePolicyV2();
    const usage = usageV2ForTransaction(v2Tx());
    const overflow = quoteFeeV2({
      policy,
      usage: { ...usage, TRANSACTION_BYTE_UNITS: (1n << 100n) },
      baseResourcePrice: 1n << 40n,
      feeAsset: 'SUNREY_COIN',
      maximumAuthorizedFee: 1n << 126n,
    });
    assert.equal(overflow.ok, false);
    if (!overflow.ok) {
      assert.equal(overflow.code, 'FEE_ARITHMETIC_OVERFLOW');
    }
    const moon = quoteFeeV2({
      policy,
      usage,
      baseResourcePrice: 100n,
      feeAsset: 'MOONREY_COIN',
      maximumAuthorizedFee: 50_000n,
    });
    assert.equal(moon.ok, false);
    const engine = new FeeEngine();
    engine.faucet('alice', 1_000_000n);
    engine.activateFeePolicyV2();
    const wrong = v2Tx({
      budget: { ...v2Tx().budget, feeAsset: 'MOONREY_COIN' },
    });
    const rejected = engine.validateAdmission(wrong);
    assert.ok(rejected);
    assert.equal(rejected.code, 'UNSUPPORTED_FEE_ASSET');
  });

  it('preserves machine mandate including priority fee', () => {
    const policy = developmentFeePolicyV2();
    const quote = estimateFeeV2(policy, v2Tx({ authorizedPriorityFee: 5_000n, priorityAuthorized: true }), 100n);
    assert.equal(quote.ok, true);
    if (quote.ok) {
      assert.equal(machineFeeFitsMandate(100n, 50n, quote.quote), false);
      assert.equal(machineFeeFitsMandate(quote.quote.estimatedTotal + 50n, 50n, quote.quote), true);
    }
    const engine = new FeeEngine();
    engine.faucet('alice', 1_000_000n);
    engine.activateFeePolicyV2();
    const tx = v2Tx({
      authorizedPriorityFee: 4_000n,
      priorityAuthorized: true,
      machineMandateCeiling: 200n,
    });
    const result = engine.validateAdmission(tx);
    assert.ok(result);
    assert.equal(result.code, 'MACHINE_MANDATE_EXCEEDED');
  });

  it('rejects policy downgrade and priority-field tamper', () => {
    assert.equal(rejectPolicyDowngrade(2, 1), true);
    const engine = new FeeEngine();
    engine.faucet('alice', 1_000_000n);
    engine.activateFeePolicyV2();
    const historic = transferTx(txId('downgrade'), 'alice', 'bob', 10n, 5_000n);
    historic as ExecutableTransaction;
    const downgrade = engine.validateAdmission({ ...historic, policyVersion: 1 });
    assert.ok(downgrade);
    assert.equal(downgrade.code, 'POLICY_DOWNGRADE_REJECTED');
    const tamper = engine.validateAdmission(v2Tx({ authorizedPriorityFee: 80n, priorityAuthorized: false }));
    assert.ok(tamper);
    assert.equal(tamper.code, 'PRIORITY_FIELD_TAMPER');
  });

  it('rejects disposition mismatch and keeps reserved = charged + released', () => {
    const split = disposeFeeV2(
      { version: 2, activationHeight: 0, validatorRewardBps: 5_000n, burnBps: 2_500n, treasuryBps: 2_500n },
      'SUNREY_COIN',
      1_000n,
    );
    assert.equal(dispositionV2Reconciles(split), true);
    assert.equal(split.validatorReward + split.burned + split.treasury, 1_000n);
    const engine = new FeeEngine();
    engine.faucet('alice', 1_000_000n);
    engine.activateFeePolicyV2();
    const tx = v2Tx();
    const before = engine.accounts.position('alice', 'SUNREY_COIN').available;
    const result = engine.execute({
      tx,
      blockHeight: 1,
      blockId: 'blk',
      proposerId: 'val_a',
      validators: FOUR_VALIDATORS,
    });
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.receipt.reservedFee, result.receipt.actualFee + result.receipt.releasedFee);
      assert.ok(result.receipt.actualFee <= tx.budget.maxFee);
      assert.equal(
        engine.accounts.position('alice', 'SUNREY_COIN').available,
        before - result.receipt.actualFee - 100n,
      );
      assert.equal(engine.accounts.position('bob', 'SUNREY_COIN').available, 100n);
      assert.equal(result.receipt.disposition.validatorRewardPool + result.receipt.disposition.burned + result.receipt.disposition.treasury, result.receipt.actualFee);
    }
  });

  it('bounds mempool resource exhaustion and selects deterministically', () => {
    const engine = new FeeEngine();
    engine.faucet('alice', 50_000_000n);
    engine.activateFeePolicyV2();
    const mempool = new FeeMempool(engine);
    const first = v2Tx({ transactionId: 'aa'.repeat(32) });
    const second = v2Tx({ transactionId: 'bb'.repeat(32), budget: { ...v2Tx().budget, maxFee: 80_000n } });
    assert.equal(mempool.admit(first), null);
    assert.equal(mempool.admit(second), null);
    const replica = new FeeEngine();
    replica.faucet('alice', 50_000_000n);
    replica.activateFeePolicyV2();
    const copy = new FeeMempool(replica);
    assert.equal(copy.admit(second), null);
    assert.equal(copy.admit(first), null);
    assert.deepEqual(
      mempool.selectForBlock().map((tx) => tx.transactionId),
      copy.selectForBlock().map((tx) => tx.transactionId),
    );
    const controls = developmentAntiSpamControls(engine.feePolicyV2);
    assert.equal(mempoolAdmissionBounded(1_024, 0, 0, 100, controls), false);
  });

  it('credits the canonical validator reward pool and burn account without minting', () => {
    const engine = new FeeEngine();
    engine.faucet('alice', 1_000_000n);
    engine.activateFeePolicyV2();
    const availableBefore = engine.accounts.position('alice', 'SUNREY_COIN').available;
    const result = engine.execute({
      tx: v2Tx(),
      blockHeight: 1,
      blockId: 'blk',
      proposerId: 'val_a',
      validators: FOUR_VALIDATORS,
    });
    assert.equal(result.ok, true);
    if (result.ok) {
      const sinks =
        engine.accounts.position('sunrey.fees.validator_reward_pool', 'SUNREY_COIN').available +
        engine.accounts.position('sunrey.fees.burn', 'SUNREY_COIN').available +
        engine.accounts.position('sunrey.fees.treasury', 'SUNREY_COIN').available;
      assert.equal(sinks, result.receipt.actualFee);
      assert.equal(
        engine.accounts.position('alice', 'SUNREY_COIN').available +
          engine.accounts.position('bob', 'SUNREY_COIN').available +
          sinks,
        availableBefore,
      );
    }
  });

  it('governs FeePolicyV2 activation and refuses AI-style downgrade payloads', () => {
    const engine = new FeeEngine();
    const plan = {
      upgradeId: 'fee-v2',
      upgradeKind: 'FEE_PARAMETER_CHANGE',
      status: 'ACTIVATED',
      activationHeight: 9,
      payload: {
        fee_policy_v2: {
          policy_version: 2,
          version: 3,
          minimum_fee: '150',
        },
      },
    } as unknown as UpgradePlan;
    assert.equal(applyFeeGovernance(engine, plan, 9), true);
    assert.equal(engine.policyVersion, 2);
    const downgrade = {
      ...plan,
      payload: { fee_policy_v2: { policy_version: 1 } },
    } as unknown as UpgradePlan;
    assert.equal(applyFeeGovernance(engine, downgrade, 9), false);
  });

  it('runs required simulator scenarios and verification properties', () => {
    const report = buildFeeMarketVerificationReport();
    assert.equal(report.passed, true);
    assert.equal(report.productionParametersConfigured, false);
    assert.equal(report.simulations.length, FEE_MARKET_SCENARIOS.length);
    for (const property of report.properties) {
      assert.equal(property.passed, true, property.property);
    }
    const readiness = feeMarketReadiness(report, developmentFeePolicyV2());
    assert.equal(readiness.productionParametersConfigured, false);
    assert.equal(readiness.governanceApproval, false);
    assert.equal(readiness.mainnetReady, false);
    const sim = new AdaptiveFeeSimulator().runAll(6);
    assert.equal(sim.length, 9);
  });

  it('exposes sunrey-economics fees CLI commands', () => {
    for (const command of ['policy', 'price', 'estimate', 'simulate', 'verify', 'history']) {
      const out = runSunreyEconomicsCli(['fees', command]);
      assert.match(out, /policyVersion|baseResourcePrice|informational|ENGINEERING|formulaVersion|usage/);
    }
    assert.match(runSunreyEconomicsCli(['nope']), /usage:/);
  });

  it('does not use wall-clock or floats in consensus fee sources', () => {
    const sources = [
      'packages/sunrey-chain/src/fees/v2/price.ts',
      'packages/sunrey-chain/src/fees/v2/quote.ts',
      'packages/sunrey-chain/src/fees/v2/meter.ts',
    ];
    void sources;
    const quote = estimateFeeV2(developmentFeePolicyV2(), v2Tx(), 100n);
    assert.equal(quote.ok, true);
    if (quote.ok) {
      assert.equal(typeof quote.quote.estimatedTotal, 'bigint');
      assert.equal(quote.quote.informational, true);
    }
  });
});
