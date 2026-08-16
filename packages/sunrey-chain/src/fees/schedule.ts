import { commitCanonical } from '../hash.ts';
import {
  FEE_SCHEDULE_DOMAIN,
  assertUnsigned,
  type FeeSchedule,
  type ResourceUsage,
} from './types.ts';

export function developmentFeeSchedule(activationHeight = 0): FeeSchedule {
  return Object.freeze({
    version: 1,
    activationHeight,
    baseTransactionFee: 100n,
    perByteFee: 1n,
    computeUnitFee: 2n,
    stateReadFee: 3n,
    stateWriteFee: 5n,
    signatureVerifyFee: 20n,
    cryptographicProofFee: 25n,
    minimumFee: 100n,
  });
}

export function hashFeeSchedule(schedule: FeeSchedule): string {
  return commitCanonical({
    domain: FEE_SCHEDULE_DOMAIN,
    version: schedule.version,
    activationHeight: schedule.activationHeight,
    baseTransactionFee: schedule.baseTransactionFee.toString(),
    perByteFee: schedule.perByteFee.toString(),
    computeUnitFee: schedule.computeUnitFee.toString(),
    stateReadFee: schedule.stateReadFee.toString(),
    stateWriteFee: schedule.stateWriteFee.toString(),
    signatureVerifyFee: schedule.signatureVerifyFee.toString(),
    cryptographicProofFee: schedule.cryptographicProofFee.toString(),
    minimumFee: schedule.minimumFee.toString(),
  });
}

function mul(price: bigint, units: bigint, label: string): bigint {
  assertUnsigned(price, label);
  assertUnsigned(units, label);
  const product = price * units;
  if (product < 0n) {
    throw new TypeError(`${label} overflowed signed range`);
  }
  return product;
}

/**
 * actual_fee = resource usage × active fee schedule using exact integer arithmetic.
 */
export function calculateFee(schedule: FeeSchedule, usage: ResourceUsage): bigint {
  const parts = [
    schedule.baseTransactionFee,
    mul(schedule.perByteFee, usage.TRANSACTION_BYTE_UNITS, 'perByteFee'),
    mul(schedule.computeUnitFee, usage.COMPUTE_UNITS, 'computeUnitFee'),
    mul(schedule.stateReadFee, usage.STATE_READ_UNITS, 'stateReadFee'),
    mul(schedule.stateWriteFee, usage.STATE_WRITE_UNITS, 'stateWriteFee'),
    mul(schedule.signatureVerifyFee, usage.SIGNATURE_VERIFY_UNITS, 'signatureVerifyFee'),
    mul(schedule.cryptographicProofFee, usage.CRYPTOGRAPHIC_PROOF_UNITS, 'cryptographicProofFee'),
  ];
  return parts.reduce((sum, part) => sum + part, 0n);
}

export function validateFeeSchedule(schedule: FeeSchedule): string | null {
  const fields: Array<[keyof FeeSchedule, bigint | number]> = [
    ['version', schedule.version],
    ['activationHeight', schedule.activationHeight],
    ['baseTransactionFee', schedule.baseTransactionFee],
    ['perByteFee', schedule.perByteFee],
    ['computeUnitFee', schedule.computeUnitFee],
    ['stateReadFee', schedule.stateReadFee],
    ['stateWriteFee', schedule.stateWriteFee],
    ['signatureVerifyFee', schedule.signatureVerifyFee],
    ['cryptographicProofFee', schedule.cryptographicProofFee],
    ['minimumFee', schedule.minimumFee],
  ];
  for (const [key, value] of fields) {
    if (typeof value === 'number') {
      if (!Number.isInteger(value) || value < 0) {
        return `fee schedule ${key} must be a non-negative integer`;
      }
    } else if (value < 0n) {
      return `fee schedule ${key} must be a non-negative integer`;
    }
  }
  return null;
}
