import { err, ok, type Result } from '../../../domain/src/result.ts';
import type {
  AccessEntitlementPort,
  AccessFabricFailure,
  RewardCreditPort,
} from './types.ts';

/**
 * Simulation entitlement owner.
 *
 * Stands in for the owning access-entitlement service. Granted units live here,
 * not in the Exchange, and there is no transfer operation: an entitlement can be
 * granted, consumed, and restored, never moved between holders and never
 * redeemed for money.
 */
export class InMemoryAccessEntitlementPort implements AccessEntitlementPort {
  readonly transferable = false as const;
  readonly redeemableForMoney = false as const;
  private readonly grants = new Map<string, bigint>();
  private readonly consumptions = new Map<
    string,
    { readonly key: string; readonly units: bigint; readonly open: boolean }
  >();

  grant(input: {
    readonly entitlementId: string;
    readonly holderId: string;
    readonly unit: string;
    readonly units: bigint;
  }): void {
    const key = this.key(input.entitlementId, input.holderId, input.unit);
    this.grants.set(key, (this.grants.get(key) ?? 0n) + input.units);
  }

  grantedUnits(input: {
    readonly entitlementId: string;
    readonly holderId: string;
    readonly unit: string;
  }): bigint {
    return this.grants.get(this.key(input.entitlementId, input.holderId, input.unit)) ?? 0n;
  }

  consume(input: {
    readonly entitlementId: string;
    readonly holderId: string;
    readonly units: bigint;
    readonly unit: string;
    readonly reservationId: string;
  }): Result<{ readonly consumptionId: string }, AccessFabricFailure> {
    const key = this.key(input.entitlementId, input.holderId, input.unit);
    const granted = this.grants.get(key) ?? 0n;
    if (granted < input.units) {
      return err({
        code: 'ENTITLEMENT_INSUFFICIENT',
        message: 'entitlement consumption exceeds the granted units',
      });
    }
    this.grants.set(key, granted - input.units);
    const consumptionId = `ent_${input.reservationId}`;
    this.consumptions.set(consumptionId, { key, units: input.units, open: true });
    return ok({ consumptionId });
  }

  restore(input: {
    readonly consumptionId: string;
  }): Result<{ readonly restored: true }, AccessFabricFailure> {
    const record = this.consumptions.get(input.consumptionId);
    if (!record || !record.open) {
      return err({
        code: 'ENTITLEMENT_INSUFFICIENT',
        message: 'no open entitlement consumption to restore',
      });
    }
    this.grants.set(record.key, (this.grants.get(record.key) ?? 0n) + record.units);
    this.consumptions.set(input.consumptionId, { ...record, open: false });
    return ok({ restored: true });
  }

  private key(entitlementId: string, holderId: string, unit: string): string {
    return `${entitlementId}::${holderId}::${unit}`;
  }
}

/**
 * Simulation reward-credit owner. Reward credit is consumed for a permitted use
 * only. It is not money, is not transferable, and is not redeemable for money.
 */
export class InMemoryRewardCreditPort implements RewardCreditPort {
  readonly transferable = false as const;
  readonly redeemableForMoney = false as const;
  private readonly credits = new Map<string, bigint>();
  private readonly consumptions = new Map<
    string,
    { readonly key: string; readonly units: bigint; readonly open: boolean }
  >();

  award(input: {
    readonly programId: string;
    readonly holderId: string;
    readonly permittedUse: string;
    readonly units: bigint;
  }): void {
    const key = this.key(input.programId, input.holderId, input.permittedUse);
    this.credits.set(key, (this.credits.get(key) ?? 0n) + input.units);
  }

  permittedUnits(input: {
    readonly programId: string;
    readonly holderId: string;
    readonly permittedUse: string;
  }): bigint {
    return this.credits.get(this.key(input.programId, input.holderId, input.permittedUse)) ?? 0n;
  }

  consume(input: {
    readonly programId: string;
    readonly holderId: string;
    readonly units: bigint;
    readonly permittedUse: string;
    readonly reservationId: string;
  }): Result<{ readonly consumptionId: string }, AccessFabricFailure> {
    const key = this.key(input.programId, input.holderId, input.permittedUse);
    const available = this.credits.get(key) ?? 0n;
    if (available < input.units) {
      return err({
        code: 'REWARD_NOT_PERMITTED',
        message: 'reward credit consumption exceeds the permitted units',
      });
    }
    this.credits.set(key, available - input.units);
    const consumptionId = `rwd_${input.reservationId}`;
    this.consumptions.set(consumptionId, { key, units: input.units, open: true });
    return ok({ consumptionId });
  }

  restore(input: {
    readonly consumptionId: string;
  }): Result<{ readonly restored: true }, AccessFabricFailure> {
    const record = this.consumptions.get(input.consumptionId);
    if (!record || !record.open) {
      return err({
        code: 'REWARD_NOT_PERMITTED',
        message: 'no open reward-credit consumption to restore',
      });
    }
    this.credits.set(record.key, (this.credits.get(record.key) ?? 0n) + record.units);
    this.consumptions.set(input.consumptionId, { ...record, open: false });
    return ok({ restored: true });
  }

  private key(programId: string, holderId: string, permittedUse: string): string {
    return `${programId}::${holderId}::${permittedUse}`;
  }
}
