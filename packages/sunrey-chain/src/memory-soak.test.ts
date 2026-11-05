import assert from 'node:assert/strict';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { FeeEngine } from './fees/engine.ts';
import { FeeReceiptRetentionStore } from './fees/receipt-retention.ts';
import { emptyUsage, type FeeReceipt } from './fees/types.ts';
import { ProductiveEconomyEngine } from './productive/engine.ts';
import { DEV_CLOCK, fixtureClaim, fixtureFacts, fixtureRight, solarFacility } from './productive/fixtures.ts';
import { runSoak } from './perf/soak.ts';
import { validatorDescriptors } from './perf/consensus.ts';
import { nativeTransferTx } from './perf/workload.ts';
import {
  evaluateHeliosMemorySoakQualification,
  HELIOS_MEMORY_SOAK_QUALIFIED,
} from './perf/memory-soak-qualification.ts';
import { assertIsolatedTestPass, shouldRunIsolatedTestBody } from './test/isolated-child.ts';

const ROOT = join(import.meta.dirname, '../../..');

function assertHealth05SoakIsolated(testNamePattern: string): void {
  assertIsolatedTestPass({
    envFlag: 'HELIOS_HEALTH05_SOAK_ISOLATED',
    testModuleUrl: import.meta.url,
    cwd: ROOT,
    testNamePattern,
  });
}

describe('HELIOS HEALTH05 memory soak repair', () => {
  it('bounds fee receipt hot memory while sealing evicted receipts', () => {
    const store = new FeeReceiptRetentionStore(4);
    for (let i = 0; i < 12; i += 1) {
      const receipt = Object.freeze({
        transactionId: `tx_${i}`,
        payer: 'alice',
        asset: 'SUNREY_COIN',
        reservedFee: 1n,
        actualFee: 1n,
        releasedFee: 0n,
        resourceUsage: emptyUsage(),
        feeScheduleVersion: 1,
        dispositionPolicyVersion: 1,
        blockHeight: i,
        blockId: `blk_${i}`,
        outcome: 'APPLIED',
        disposition: {
          asset: 'SUNREY_COIN',
          actualFee: 1n,
          burned: 0n,
          networkSink: 0n,
          validatorRewardPool: 0n,
          treasury: 1n,
        },
        policyVersion: 1,
        baseCharge: 1n,
        priorityFee: 0n,
      } satisfies FeeReceipt);
      store.record(receipt);
    }
    const stats = store.stats();
    assert.equal(stats.inMemoryReceipts, 4);
    assert.equal(stats.sealedReceipts, 8);
    assert.equal(stats.uniqueTransactionIds, 12);
  });

  it('keeps deterministic soak RSS within the default budget', () => {
    assertHealth05SoakIsolated('keeps deterministic soak RSS');
    if (!shouldRunIsolatedTestBody('HELIOS_HEALTH05_SOAK_ISOLATED')) {
      return;
    }
    const report = runSoak({ durationMs: 30_000, memoryThresholdBytes: 64 * 1024 * 1024 });
    const memory = report.invariants.find((row) => row.id === 'MEMORY_GROWTH_BUDGET');
    assert.equal(memory?.ok, true, memory?.detail);
    assert.ok((report.memorySnapshots.length ?? 0) >= 3);
    const growth = report.cases[0]?.extras?.rssDeltaBytes;
    assert.ok(typeof growth === 'number');
    assert.ok(Number(growth) < 256 * 1024 * 1024);
  });

  it('survives provider reconnect cycles without monotonic fee receipt growth beyond retention', () => {
    const engine = new FeeEngine();
    engine.faucet('alice', 10_000_000n);
    const validators = validatorDescriptors(4);
    for (let i = 0; i < 10_000; i += 1) {
      const tx = nativeTransferTx(`reconnect:${i}`, 'alice', 'bob', 1n);
      const admission = engine.validateAdmission(tx);
      assert.equal(admission, null);
      engine.execute({
        tx,
        blockHeight: i + 1,
        blockId: `blk_${i}`,
        proposerId: validators[0]!.validatorId,
        validators,
      });
    }
    const stats = engine.feeReceiptRetentionStats();
    assert.ok(stats.inMemoryReceipts <= 8_192);
    assert.ok(stats.sealedReceipts > 0);
    assert.equal(stats.uniqueTransactionIds, 10_000);
  });

  it('emits HELIOS_MEMORY_SOAK_QUALIFIED when soak invariants pass', () => {
    assertHealth05SoakIsolated('emits HELIOS_MEMORY_SOAK_QUALIFIED');
    if (!shouldRunIsolatedTestBody('HELIOS_HEALTH05_SOAK_ISOLATED')) {
      return;
    }
    const report = runSoak({ durationMs: 30_000, memoryThresholdBytes: 64 * 1024 * 1024 });
    const qualification = evaluateHeliosMemorySoakQualification({
      invariants: report.invariants,
      memorySnapshots: report.memorySnapshots,
      durationMs: 30_000,
    });
    assert.equal(qualification.marker, HELIOS_MEMORY_SOAK_QUALIFIED);
    assert.equal(qualification.ok, true);
  });
});
