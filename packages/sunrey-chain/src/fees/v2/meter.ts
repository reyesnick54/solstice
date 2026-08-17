import { usageForOperation } from '../meter.ts';
import type { ExecutableTransaction, ResourceUsage } from '../types.ts';
import { checkedAdd, checkedMul } from './arithmetic.ts';
import {
  emptyUsageV2,
  type ResourceUsageV2,
  type ResourceWeightSchedule,
  type SignatureClass,
  type V2TransactionExtras,
} from './types.ts';

/**
 * Deterministic V2 metering.
 *
 * Identical transaction bytes and identical protocol state produce
 * identical ResourceUsageV2 on every validator. Signature class is a
 * declared protocol attribute, never a measured verification duration.
 */
export function usageV2ForTransaction(
  tx: ExecutableTransaction & V2TransactionExtras,
): ResourceUsageV2 {
  const historic = usageForOperation(tx.operation, tx.encodedBytes, tx.signatureCount);
  return projectUsageV2(historic, {
    signatureClass: tx.signatureClass ?? 'CLASSICAL',
    signatureCount: tx.signatureCount,
    oracleVerifyCount: tx.oracleVerifyCount ?? 0,
    interopProofCount: tx.interopProofCount ?? 0,
    exchangeDvpLegs: tx.exchangeDvpLegs ?? 0,
    otherGovernedUnits: tx.otherGovernedUnits ?? historic.COMPUTE_UNITS,
  });
}

export function projectUsageV2(
  historic: ResourceUsage,
  extras: {
    readonly signatureClass: SignatureClass;
    readonly signatureCount: number;
    readonly oracleVerifyCount: number;
    readonly interopProofCount: number;
    readonly exchangeDvpLegs: number;
    readonly otherGovernedUnits: bigint;
  },
): ResourceUsageV2 {
  const sigs = BigInt(extras.signatureCount);
  const classical = extras.signatureClass === 'CLASSICAL' ? sigs : 0n;
  const hybrid = extras.signatureClass === 'HYBRID' ? sigs : 0n;
  const pq = extras.signatureClass === 'PQ' ? sigs : 0n;
  return Object.freeze({
    TRANSACTION_BYTE_UNITS: historic.TRANSACTION_BYTE_UNITS,
    SIGNATURE_VERIFY_CLASSICAL: classical,
    SIGNATURE_VERIFY_HYBRID: hybrid,
    SIGNATURE_VERIFY_PQ: pq,
    STATE_READ_UNITS: historic.STATE_READ_UNITS,
    STATE_WRITE_UNITS: historic.STATE_WRITE_UNITS,
    CRYPTOGRAPHIC_PROOF_UNITS: historic.CRYPTOGRAPHIC_PROOF_UNITS,
    ORACLE_VERIFY: BigInt(extras.oracleVerifyCount),
    EXCHANGE_DVP_LEG: BigInt(extras.exchangeDvpLegs),
    INTEROP_PROOF: BigInt(extras.interopProofCount),
    OTHER_GOVERNED_RESOURCE: extras.otherGovernedUnits,
  });
}

export function weightedUsage(
  usage: ResourceUsageV2,
  schedule: ResourceWeightSchedule,
): bigint {
  let total = 0n;
  for (const [key, quantity] of Object.entries(usage) as Array<[keyof ResourceUsageV2, bigint]>) {
    const weight = schedule.weights[key];
    total = checkedAdd(total, checkedMul(quantity, weight, `weight:${key}`), 'weightedUsage');
  }
  return total;
}

export function totalUnitsV2(usage: ResourceUsageV2): bigint {
  return (
    usage.TRANSACTION_BYTE_UNITS +
    usage.SIGNATURE_VERIFY_CLASSICAL +
    usage.SIGNATURE_VERIFY_HYBRID +
    usage.SIGNATURE_VERIFY_PQ +
    usage.STATE_READ_UNITS +
    usage.STATE_WRITE_UNITS +
    usage.CRYPTOGRAPHIC_PROOF_UNITS +
    usage.ORACLE_VERIFY +
    usage.EXCHANGE_DVP_LEG +
    usage.INTEROP_PROOF +
    usage.OTHER_GOVERNED_RESOURCE
  );
}

export function emptyBlockUsage(): ResourceUsageV2 {
  return emptyUsageV2();
}
