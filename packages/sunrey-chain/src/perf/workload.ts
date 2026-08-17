import { createHash } from 'node:crypto';

import type { ExecutableTransaction, ProtocolOperation } from '../fees/types.ts';
import type { WorkloadKind } from './types.ts';

export const MIXED_WORKLOAD_WEIGHTS: Readonly<Record<WorkloadKind, number>> = Object.freeze({
  NATIVE_TRANSFER: 40,
  MOONREY_TRANSFER: 8,
  ASSET_LOCK: 10,
  EXCHANGE_SETTLEMENT: 12,
  ORACLE_OBSERVATION: 10,
  PRODUCTIVE_CLAIM: 8,
  MACHINE_COMMERCE: 8,
  GOVERNANCE_READ: 3,
  GOVERNANCE_WRITE: 1,
});

const OPERATION_FOR: Readonly<Record<WorkloadKind, ProtocolOperation>> = Object.freeze({
  NATIVE_TRANSFER: 'NATIVE_TRANSFER',
  MOONREY_TRANSFER: 'NATIVE_TRANSFER',
  ASSET_LOCK: 'NATIVE_LOCK',
  EXCHANGE_SETTLEMENT: 'ORDINARY_STATE_WRITE',
  ORACLE_OBSERVATION: 'ORDINARY_STATE_WRITE',
  PRODUCTIVE_CLAIM: 'NATIVE_ISSUANCE_VERIFY',
  MACHINE_COMMERCE: 'ORDINARY_STATE_WRITE',
  GOVERNANCE_READ: 'ORDINARY_STATE_READ',
  GOVERNANCE_WRITE: 'GOVERNANCE_SIGNATURE_VERIFY',
});

export function txId(label: string): string {
  return createHash('sha256').update(label).digest('hex');
}

export function mixedKindAt(index: number): WorkloadKind {
  const total = Object.values(MIXED_WORKLOAD_WEIGHTS).reduce((sum, weight) => sum + weight, 0);
  let cursor = index % total;
  for (const kind of Object.keys(MIXED_WORKLOAD_WEIGHTS) as WorkloadKind[]) {
    cursor -= MIXED_WORKLOAD_WEIGHTS[kind];
    if (cursor < 0) {
      return kind;
    }
  }
  return 'NATIVE_TRANSFER';
}

export function executableForKind(
  kind: WorkloadKind,
  index: number,
  payer: string,
  counterparty: string,
): ExecutableTransaction {
  const asset = kind === 'MOONREY_TRANSFER' ? 'MOONREY_COIN' : 'SUNREY_COIN';
  const amount = 10n + BigInt(index % 50);
  return {
    transactionId: txId(`mixed:${kind}:${index}`),
    operation: OPERATION_FOR[kind],
    payerAuthenticated: true,
    encodedBytes: 180 + (index % 80),
    signatureCount: 1,
    budget: {
      maxExecutionUnits: 12_000n,
      maxFee: 8_000n,
      feeAsset: 'SUNREY_COIN',
      feePayer: payer,
      exemption: 'NONE',
    },
    transfer:
      kind === 'NATIVE_TRANSFER' || kind === 'MOONREY_TRANSFER' || kind === 'ASSET_LOCK'
        ? {
            from: payer,
            to: counterparty,
            asset,
            amount,
          }
        : undefined,
  };
}

export function nativeTransferTx(label: string, payer: string, to: string, amount: bigint, maxFee = 5_000n): ExecutableTransaction {
  return {
    transactionId: txId(label),
    operation: 'NATIVE_TRANSFER',
    payerAuthenticated: true,
    encodedBytes: 240,
    signatureCount: 1,
    budget: {
      maxExecutionUnits: 10_000n,
      maxFee,
      feeAsset: 'SUNREY_COIN',
      feePayer: payer,
      exemption: 'NONE',
    },
    transfer: { from: payer, to, asset: 'SUNREY_COIN', amount },
  };
}

export function lockTx(label: string, payer: string, amount: bigint): ExecutableTransaction {
  return {
    transactionId: txId(label),
    operation: 'NATIVE_LOCK',
    payerAuthenticated: true,
    encodedBytes: 200,
    signatureCount: 1,
    budget: {
      maxExecutionUnits: 10_000n,
      maxFee: 5_000n,
      feeAsset: 'SUNREY_COIN',
      feePayer: payer,
      exemption: 'NONE',
    },
    transfer: { from: payer, to: payer, asset: 'SUNREY_COIN', amount },
  };
}

export function invalidTx(label: string, payer: string): ExecutableTransaction {
  return {
    transactionId: txId(label),
    operation: 'NATIVE_TRANSFER',
    payerAuthenticated: false,
    encodedBytes: 80,
    signatureCount: 0,
    budget: {
      maxExecutionUnits: 10_000n,
      maxFee: 1n,
      feeAsset: 'SUNREY_COIN',
      feePayer: payer,
      exemption: 'NONE',
    },
  };
}
