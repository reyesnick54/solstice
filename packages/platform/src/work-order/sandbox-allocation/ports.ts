import type { UtcInstant } from '../../../../domain/src/time.ts';
import { err, ok, type Result } from '../../../../domain/src/result.ts';
import type { GrowAllocationFailure } from './types.ts';

export type SandboxAccountPosition = {
  readonly accountId: string;
  readonly customerId: string;
  readonly currency: string;
  readonly ledgerBalanceMinorUnits: string;
  readonly settledMinorUnits: string;
  readonly heldMinorUnits: string;
  readonly availableMinorUnits: string;
  readonly epoch: number;
  readonly asOf: UtcInstant;
};

export type SandboxReservationRequest = {
  readonly customerId: string;
  readonly accountId: string;
  readonly currency: string;
  readonly requestedAmountMinorUnits: string;
  readonly capitalCeilingMinorUnits: string;
  readonly liquidityRetentionMinorUnits: string;
  readonly idempotencyKey: string;
  readonly allocationId: string;
  readonly workOrderId: string;
};

export type SandboxReservationResult = {
  readonly holdId: string;
  readonly reservationReference: string;
  readonly reservedAmountMinorUnits: string;
  readonly epoch: number;
};

export interface SandboxAccountFundsPort {
  ownsAccount(customerId: string, accountId: string): boolean;
  getPosition(customerId: string, accountId: string): Result<SandboxAccountPosition, GrowAllocationFailure>;
}

export interface SandboxCapitalReservationPort {
  reserve(request: SandboxReservationRequest): Promise<Result<SandboxReservationResult, GrowAllocationFailure>>;
  release(holdId: string, reason: string): Promise<Result<true, GrowAllocationFailure>>;
}

export function parseMinorUnits(value: string): bigint {
  return BigInt(value);
}

export function formatMinorUnits(value: bigint): string {
  return value.toString();
}

export function minMinorUnits(a: string, b: string): string {
  const left = parseMinorUnits(a);
  const right = parseMinorUnits(b);
  return formatMinorUnits(left <= right ? left : right);
}

export function subtractMinorUnits(a: string, b: string): string {
  const result = parseMinorUnits(a) - parseMinorUnits(b);
  return formatMinorUnits(result >= 0n ? result : 0n);
}

export function assertPositiveMinorUnits(value: string): Result<true, GrowAllocationFailure> {
  if (parseMinorUnits(value) <= 0n) {
    return err({ code: 'INSUFFICIENT_FUNDS', message: 'allocation amount must be positive' });
  }
  return ok(true);
}
