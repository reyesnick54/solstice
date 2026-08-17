import { err, ok, type Result } from '../../domain/src/result.ts';
import { asEscrowId, newDeliveryId, newEscrowId, type ContractId, type EscrowId } from './ids.ts';
import type { ExchangeFailure } from './types.ts';
import type { DeliveryRecord, EscrowRecord, PartialSettlement } from './types-universal.ts';
import type { OracleFactRecord } from './ports.ts';
import type { OracleFactPolicy, PartialDeliveryPolicy } from './taxonomy.ts';
import type { UtcInstant } from '../../domain/src/time.ts';

export function openEscrow(input: {
  readonly ownerAccountId: EscrowRecord['ownerAccountId'];
  readonly assetId: string;
  readonly amount: bigint;
  readonly escrowId?: string;
}): EscrowRecord {
  if (input.amount <= 0n) {
    throw new TypeError('escrow amount must be positive');
  }
  return Object.freeze({
    escrowId: input.escrowId ? asEscrowId(input.escrowId) : newEscrowId(),
    ownerAccountId: input.ownerAccountId,
    assetId: input.assetId,
    locked: input.amount,
    released: 0n,
    paid: 0n,
    state: 'LOCKED',
  });
}

export function oracleAllowsSettlement(
  fact: OracleFactRecord | null,
  policy: { readonly conflict: OracleFactPolicy; readonly stale: OracleFactPolicy; readonly required: boolean },
): Result<OracleFactRecord, ExchangeFailure> {
  if (!fact) {
    return err({ code: 'ORACLE_REQUIREMENT_UNMET', message: 'verified economic fact required' });
  }
  if (fact.quality === 'CONFLICTED' && policy.conflict === 'BLOCK_ON_CONFLICT') {
    return err({ code: 'ORACLE_CONFLICT', message: 'conflicted oracle fact blocks ordinary delivery settlement' });
  }
  if (fact.quality === 'STALE' && policy.stale === 'BLOCK_ON_STALE') {
    return err({ code: 'ORACLE_CONFLICT', message: 'stale oracle fact blocks ordinary delivery settlement' });
  }
  if (policy.required && fact.quality !== 'FINALIZED') {
    return err({ code: 'ORACLE_REQUIREMENT_UNMET', message: `oracle quality ${fact.quality} is not finalized` });
  }
  return ok(fact);
}

/**
 * Exact partial settlement. 100 ordered / 72 delivered pays 72 and
 * releases 28 when policy is PAY_VERIFIED_RELEASE_UNUSED.
 */
export function settlePartialDelivery(input: {
  readonly contractId: ContractId;
  readonly ordered: bigint;
  readonly delivered: bigint;
  readonly unitPrice: bigint;
  readonly escrow: EscrowRecord;
  readonly policy: PartialDeliveryPolicy;
}): Result<{ readonly escrow: EscrowRecord; readonly settlement: PartialSettlement }, ExchangeFailure> {
  if (input.ordered <= 0n || input.delivered < 0n || input.delivered > input.ordered) {
    return err({ code: 'DELIVERY_MISMATCH', message: 'delivered quantity is outside [0, ordered]' });
  }
  if (input.policy === 'ALL_OR_NOTHING' && input.delivered !== input.ordered) {
    return err({ code: 'DELIVERY_MISMATCH', message: 'all-or-nothing contract rejected partial delivery' });
  }
  const paid = input.delivered * input.unitPrice;
  const unusedUnits = input.ordered - input.delivered;
  const unused = unusedUnits * input.unitPrice;
  if (paid + unused !== input.escrow.locked) {
    return err({
      code: 'SETTLEMENT_FAILURE',
      message: 'partial settlement is not exact against locked escrow',
    });
  }
  const releaseUnused = input.policy === 'PAY_VERIFIED_RELEASE_UNUSED';
  const next: EscrowRecord = Object.freeze({
    ...input.escrow,
    paid,
    released: releaseUnused ? unused : 0n,
    locked: releaseUnused ? 0n : unused,
    state: releaseUnused ? 'SETTLED' : unused === 0n ? 'SETTLED' : 'PARTIALLY_RELEASED',
  });
  return ok({
    escrow: next,
    settlement: Object.freeze({
      contractId: input.contractId,
      ordered: input.ordered,
      delivered: input.delivered,
      paid,
      releasedUnused: next.released,
      remainingEscrow: next.locked,
      exact: true as const,
    }),
  });
}

export function recordDelivery(input: {
  readonly contractId: ContractId;
  readonly fact: OracleFactRecord | null;
  readonly quantity: bigint;
  readonly unit: string;
  readonly at: UtcInstant;
}): DeliveryRecord {
  return Object.freeze({
    deliveryId: newDeliveryId(),
    contractId: input.contractId,
    factId: input.fact?.factId ?? null,
    quantity: input.quantity,
    unit: input.unit,
    quality: input.fact?.quality ?? 'SELF_REPORT',
    recordedAt: input.at,
  });
}

export function escrowIdOf(record: EscrowRecord): EscrowId {
  return record.escrowId;
}
