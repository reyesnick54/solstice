import { createHash } from 'node:crypto';

import { FeeEngine, type ValidatorDescriptor } from './engine.ts';
import { FeeMempool } from './mempool.ts';
import { applyFeeGovernance } from './governance.ts';
import { calculateFee } from './schedule.ts';
import { usageForOperation } from './meter.ts';
import { dispositionReconciles } from './policy.ts';
import type { ExecutableTransaction, FeeReceipt } from './types.ts';
import type { UpgradePlan } from '../governance/types.ts';

export const FOUR_VALIDATORS: readonly ValidatorDescriptor[] = Object.freeze([
  { validatorId: 'val_a', votingPower: 1n },
  { validatorId: 'val_b', votingPower: 1n },
  { validatorId: 'val_c', votingPower: 1n },
  { validatorId: 'val_d', votingPower: 1n },
]);

export function txId(label: string): string {
  return createHash('sha256').update(label).digest('hex');
}

export function transferTx(
  id: string,
  payer: string,
  to: string,
  amount: bigint,
  maxFee: bigint,
  maxExecutionUnits = 10_000n,
): ExecutableTransaction {
  return {
    transactionId: id,
    operation: 'NATIVE_TRANSFER',
    payerAuthenticated: true,
    encodedBytes: 240,
    signatureCount: 1,
    budget: {
      maxExecutionUnits,
      maxFee,
      feeAsset: 'SUNREY_COIN',
      feePayer: payer,
      exemption: 'NONE',
    },
    transfer: {
      from: payer,
      to,
      asset: 'SUNREY_COIN',
      amount,
    },
  };
}

export function runFourValidatorFeeDemo(): {
  readonly receipts: readonly FeeReceipt[];
  readonly stateRoots: readonly string[];
  readonly insufficientRejected: true;
  readonly overBudget: { readonly code: string; readonly aliceAvailable: bigint; readonly bobAvailable: bigint };
  readonly sampleFee: bigint;
} {
  const engines = [0, 1, 2, 3].map(() => new FeeEngine());
  const primary = engines[0];
  if (!primary) {
    throw new Error('four-validator set is empty');
  }
  for (const engine of engines) {
    engine.faucet('alice', 1_000_000n);
  }

  const transfer = transferTx(txId('alice-to-bob-1'), 'alice', 'bob', 1_000n, 5_000n);
  const sampleFee = calculateFee(
    primary.schedule,
    usageForOperation(transfer.operation, transfer.encodedBytes, transfer.signatureCount),
  );

  const receipts: FeeReceipt[] = [];
  const stateRoots: string[] = [];
  for (const engine of engines) {
    const mempool = new FeeMempool(engine);
    const admitted = mempool.admit(transfer);
    if (admitted) {
      throw new Error(`admission failed: ${admitted.code}`);
    }
    const selected = mempool.selectForBlock();
    const first = selected[0];
    if (!first) {
      throw new Error('mempool selected no transactions');
    }
    engine.activateAt(1);
    const result = engine.execute({
      tx: first,
      blockHeight: 1,
      blockId: 'block:1',
      proposerId: 'val_a',
      validators: FOUR_VALIDATORS,
    });
    if (!result.ok) {
      throw new Error(`execution failed: ${result.rejection.code}`);
    }
    receipts.push(result.receipt);
    mempool.removeCommitted([transfer.transactionId]);
    stateRoots.push(engine.receiptHash(result.receipt));
  }

  const insufficient = transferTx(txId('alice-low-fee'), 'alice', 'bob', 1n, 1n);
  const insufficientRejected = primary.validateAdmission(insufficient);
  if (!insufficientRejected || insufficientRejected.code !== 'FEE_BELOW_MINIMUM') {
    throw new Error('expected insufficient max fee to be rejected');
  }

  const overBudgetTx: ExecutableTransaction = {
    ...transferTx(txId('alice-over-budget'), 'alice', 'carol', 50n, 5_000n, 20n),
    forceOverBudget: true,
  };
  const beforeCarol = primary.accounts.position('carol', 'SUNREY_COIN').available;
  const over = primary.execute({
    tx: overBudgetTx,
    blockHeight: 2,
    blockId: 'block:2',
    proposerId: 'val_a',
    validators: FOUR_VALIDATORS,
  });
  if (over.ok || over.rejection.code !== 'OUT_OF_EXECUTION_UNITS') {
    throw new Error('expected OUT_OF_EXECUTION_UNITS');
  }
  const afterCarol = primary.accounts.position('carol', 'SUNREY_COIN').available;
  if (afterCarol !== beforeCarol) {
    throw new Error('over-budget transfer mutated application state');
  }

  return {
    receipts,
    stateRoots,
    insufficientRejected: true,
    overBudget: {
      code: 'OUT_OF_EXECUTION_UNITS',
      aliceAvailable: primary.accounts.position('alice', 'SUNREY_COIN').available,
      bobAvailable: primary.accounts.position('bob', 'SUNREY_COIN').available,
    },
    sampleFee,
  };
}

export function runFeeGovernanceActivation(): { readonly before: bigint; readonly after: bigint } {
  const engine = new FeeEngine();
  const before = engine.schedule.minimumFee;
  const plan = {
    upgradeId: 'upg_fee_1',
    upgradeKind: 'FEE_PARAMETER_CHANGE',
    status: 'ACTIVATED',
    activationHeight: 8,
    payload: {
      fee_schedule: {
        version: 2,
        minimum_fee: 250,
      },
    },
  } as unknown as UpgradePlan;
  applyFeeGovernance(engine, plan, 7);
  if (engine.schedule.minimumFee !== before) {
    throw new Error('fee schedule changed before activation height');
  }
  applyFeeGovernance(engine, plan, 8);
  return { before, after: engine.schedule.minimumFee };
}

export function receiptReconciles(receipt: FeeReceipt): boolean {
  return (
    receipt.reservedFee === receipt.actualFee + receipt.releasedFee && dispositionReconciles(receipt.disposition)
  );
}
