import {
  MAX_TX_EXECUTION_UNITS,
  addUsage,
  assertUnsigned,
  emptyUsage,
  totalUnits,
  type ProtocolOperation,
  type ResourceUsage,
} from './types.ts';

/**
 * Deterministic resource-cost table for protocol-native operations.
 * Oracle and productive-capacity modules may add versioned classes later.
 */
export const RESOURCE_COST_TABLE: Readonly<Record<ProtocolOperation, ResourceUsage>> = Object.freeze({
  NATIVE_TRANSFER: Object.freeze({
    COMPUTE_UNITS: 100n,
    STATE_READ_UNITS: 2n,
    STATE_WRITE_UNITS: 2n,
    TRANSACTION_BYTE_UNITS: 0n,
    SIGNATURE_VERIFY_UNITS: 0n,
    CRYPTOGRAPHIC_PROOF_UNITS: 0n,
  }),
  NATIVE_ISSUANCE_VERIFY: Object.freeze({
    COMPUTE_UNITS: 50n,
    STATE_READ_UNITS: 1n,
    STATE_WRITE_UNITS: 0n,
    TRANSACTION_BYTE_UNITS: 0n,
    SIGNATURE_VERIFY_UNITS: 0n,
    CRYPTOGRAPHIC_PROOF_UNITS: 0n,
  }),
  NATIVE_LOCK: Object.freeze({
    COMPUTE_UNITS: 80n,
    STATE_READ_UNITS: 1n,
    STATE_WRITE_UNITS: 1n,
    TRANSACTION_BYTE_UNITS: 0n,
    SIGNATURE_VERIFY_UNITS: 0n,
    CRYPTOGRAPHIC_PROOF_UNITS: 0n,
  }),
  NATIVE_UNLOCK: Object.freeze({
    COMPUTE_UNITS: 80n,
    STATE_READ_UNITS: 1n,
    STATE_WRITE_UNITS: 1n,
    TRANSACTION_BYTE_UNITS: 0n,
    SIGNATURE_VERIFY_UNITS: 0n,
    CRYPTOGRAPHIC_PROOF_UNITS: 0n,
  }),
  GOVERNANCE_SIGNATURE_VERIFY: Object.freeze({
    COMPUTE_UNITS: 40n,
    STATE_READ_UNITS: 0n,
    STATE_WRITE_UNITS: 0n,
    TRANSACTION_BYTE_UNITS: 0n,
    SIGNATURE_VERIFY_UNITS: 1n,
    CRYPTOGRAPHIC_PROOF_UNITS: 0n,
  }),
  VALIDATOR_OPERATION: Object.freeze({
    COMPUTE_UNITS: 120n,
    STATE_READ_UNITS: 2n,
    STATE_WRITE_UNITS: 1n,
    TRANSACTION_BYTE_UNITS: 0n,
    SIGNATURE_VERIFY_UNITS: 0n,
    CRYPTOGRAPHIC_PROOF_UNITS: 0n,
  }),
  EVIDENCE_VERIFICATION: Object.freeze({
    COMPUTE_UNITS: 90n,
    STATE_READ_UNITS: 1n,
    STATE_WRITE_UNITS: 1n,
    TRANSACTION_BYTE_UNITS: 0n,
    SIGNATURE_VERIFY_UNITS: 0n,
    CRYPTOGRAPHIC_PROOF_UNITS: 1n,
  }),
  ORDINARY_STATE_READ: Object.freeze({
    COMPUTE_UNITS: 10n,
    STATE_READ_UNITS: 1n,
    STATE_WRITE_UNITS: 0n,
    TRANSACTION_BYTE_UNITS: 0n,
    SIGNATURE_VERIFY_UNITS: 0n,
    CRYPTOGRAPHIC_PROOF_UNITS: 0n,
  }),
  ORDINARY_STATE_WRITE: Object.freeze({
    COMPUTE_UNITS: 20n,
    STATE_READ_UNITS: 0n,
    STATE_WRITE_UNITS: 1n,
    TRANSACTION_BYTE_UNITS: 0n,
    SIGNATURE_VERIFY_UNITS: 0n,
    CRYPTOGRAPHIC_PROOF_UNITS: 0n,
  }),
  SYSTEM_SET_OBJECT: Object.freeze({
    COMPUTE_UNITS: 20n,
    STATE_READ_UNITS: 0n,
    STATE_WRITE_UNITS: 1n,
    TRANSACTION_BYTE_UNITS: 0n,
    SIGNATURE_VERIFY_UNITS: 0n,
    CRYPTOGRAPHIC_PROOF_UNITS: 0n,
  }),
  SYSTEM_NOTE: Object.freeze({
    COMPUTE_UNITS: 10n,
    STATE_READ_UNITS: 0n,
    STATE_WRITE_UNITS: 1n,
    TRANSACTION_BYTE_UNITS: 0n,
    SIGNATURE_VERIFY_UNITS: 0n,
    CRYPTOGRAPHIC_PROOF_UNITS: 0n,
  }),
  DEVELOPMENT_FAUCET: Object.freeze({
    COMPUTE_UNITS: 30n,
    STATE_READ_UNITS: 0n,
    STATE_WRITE_UNITS: 1n,
    TRANSACTION_BYTE_UNITS: 0n,
    SIGNATURE_VERIFY_UNITS: 0n,
    CRYPTOGRAPHIC_PROOF_UNITS: 0n,
  }),
});

export function usageForOperation(
  operation: ProtocolOperation,
  encodedBytes: number,
  signatureCount: number,
): ResourceUsage {
  if (!Number.isInteger(encodedBytes) || encodedBytes < 0) {
    throw new TypeError('encodedBytes must be a non-negative integer');
  }
  if (!Number.isInteger(signatureCount) || signatureCount < 0) {
    throw new TypeError('signatureCount must be a non-negative integer');
  }
  const base = RESOURCE_COST_TABLE[operation];
  return Object.freeze({
    ...base,
    TRANSACTION_BYTE_UNITS: BigInt(encodedBytes),
    SIGNATURE_VERIFY_UNITS: base.SIGNATURE_VERIFY_UNITS + BigInt(signatureCount),
  });
}

export class ResourceMeter {
  private usage: ResourceUsage;
  private readonly budget: bigint;
  private exceeded = false;

  constructor(maxExecutionUnits: bigint) {
    assertUnsigned(maxExecutionUnits, 'maxExecutionUnits');
    this.budget = maxExecutionUnits;
    this.usage = emptyUsage();
  }

  charge(delta: ResourceUsage): boolean {
    const next = addUsage(this.usage, delta);
    if (totalUnits(next) > this.budget) {
      this.exceeded = true;
      return false;
    }
    this.usage = next;
    return true;
  }

  snapshot(): ResourceUsage {
    return this.usage;
  }

  isExceeded(): boolean {
    return this.exceeded;
  }
}

export function declarationIsOversized(maxExecutionUnits: bigint): boolean {
  return maxExecutionUnits > MAX_TX_EXECUTION_UNITS || maxExecutionUnits === 0n;
}
