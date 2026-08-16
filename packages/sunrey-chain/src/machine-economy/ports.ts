/**
 * Ports for later SunRey modules. Chunk 45 does not create a second
 * exchange, a second ledger, or a MoonRey issuance package.
 *
 * Native asset locks, protocol fees, oracle facts, and productive
 * contribution verification are consumed through these ports. The
 * development adapters implement the contracts for simulation.
 */

import type { NativeAssetId } from '../protocol/assets.ts';
import { moonreyIssuanceActivated } from '../protocol/assets.ts';
import type {
  FutureMachineMarket,
  IntegerQuantity,
  MachinePurchaseOrder,
  MachineServiceOffer,
  MatchingMode,
  VerifiedEconomicFact,
} from './types.ts';

export type LockRecord = {
  readonly lockId: string;
  readonly ownerId: string;
  readonly assetId: NativeAssetId;
  readonly quantity: IntegerQuantity;
  readonly status: 'LOCKED' | 'RELEASED' | 'TRANSFERRED';
};

export type NativeAssetLockPort = {
  readonly source: 'NATIVE_ASSET_LOCK_PORT';
  credit(ownerId: string, assetId: NativeAssetId, quantity: IntegerQuantity): void;
  balance(ownerId: string, assetId: NativeAssetId): IntegerQuantity;
  lock(ownerId: string, assetId: NativeAssetId, quantity: IntegerQuantity): LockRecord;
  transferLocked(lockId: string, recipientId: string, quantity: IntegerQuantity): void;
  release(lockId: string, quantity: IntegerQuantity): void;
};

export type ProtocolFeePort = {
  readonly source: 'PROTOCOL_FEE_PORT';
  feeFor(purchaseAmount: IntegerQuantity): IntegerQuantity;
};

export type OracleFactPort = {
  readonly source: 'ORACLE_FACT_PORT';
  record(fact: VerifiedEconomicFact): void;
  factsFor(sessionId: string): readonly VerifiedEconomicFact[];
  hasConflict(sessionId: string): boolean;
};

export type ProductiveContributionPort = {
  readonly source: 'PRODUCTIVE_CONTRIBUTION_PORT';
  markEligible(proofId: string, deliveryQuantity: IntegerQuantity): { readonly eligible: true; readonly issued: false };
  issueMoonRey(): never;
};

export type MatchResult =
  | { readonly ok: true; readonly mode: MatchingMode; readonly offerId: string }
  | { readonly ok: false; readonly reason: string };

export type MachineMarketMatchingPort = {
  readonly source: 'MACHINE_MARKET_MATCHING_PORT';
  readonly markets: readonly FutureMachineMarket[];
  match(order: Pick<MachinePurchaseOrder, 'offerId' | 'providerMachineId' | 'matchingMode'>, offers: readonly MachineServiceOffer[]): MatchResult;
};

export class DevelopmentLockAdapter implements NativeAssetLockPort {
  readonly source = 'NATIVE_ASSET_LOCK_PORT' as const;
  private readonly balances = new Map<string, IntegerQuantity>();
  private readonly locks = new Map<string, LockRecord>();
  private seq = 0;

  credit(ownerId: string, assetId: NativeAssetId, quantity: IntegerQuantity): void {
    const key = `${ownerId}:${assetId}`;
    this.balances.set(key, (this.balances.get(key) ?? 0n) + quantity);
  }

  balance(ownerId: string, assetId: NativeAssetId): IntegerQuantity {
    return this.balances.get(`${ownerId}:${assetId}`) ?? 0n;
  }

  lock(ownerId: string, assetId: NativeAssetId, quantity: IntegerQuantity): LockRecord {
    const available = this.balance(ownerId, assetId);
    if (quantity <= 0n || quantity > available) {
      throw new Error('insufficient units for lock');
    }
    this.balances.set(`${ownerId}:${assetId}`, available - quantity);
    this.seq += 1;
    const record: LockRecord = {
      lockId: `lock_${this.seq}`,
      ownerId,
      assetId,
      quantity,
      status: 'LOCKED',
    };
    this.locks.set(record.lockId, record);
    return record;
  }

  transferLocked(lockId: string, recipientId: string, quantity: IntegerQuantity): void {
    const lock = this.locks.get(lockId);
    if (!lock || lock.status !== 'LOCKED' || quantity <= 0n || quantity > lock.quantity) {
      throw new Error('lock transfer refused');
    }
    this.locks.set(lockId, { ...lock, quantity: lock.quantity - quantity });
    this.credit(recipientId, lock.assetId, quantity);
  }

  release(lockId: string, quantity: IntegerQuantity): void {
    const lock = this.locks.get(lockId);
    if (!lock || lock.status !== 'LOCKED' || quantity <= 0n || quantity > lock.quantity) {
      throw new Error('lock release refused');
    }
    this.locks.set(lockId, { ...lock, quantity: lock.quantity - quantity });
    this.credit(lock.ownerId, lock.assetId, quantity);
  }
}

export class DevelopmentFeeAdapter implements ProtocolFeePort {
  readonly source = 'PROTOCOL_FEE_PORT' as const;
  constructor(private readonly rateNumerator = 1n, private readonly rateDenominator = 100n) {}

  feeFor(purchaseAmount: IntegerQuantity): IntegerQuantity {
    if (purchaseAmount <= 0n) {
      return 0n;
    }
    return (purchaseAmount * this.rateNumerator) / this.rateDenominator;
  }
}

export class DevelopmentOracleAdapter implements OracleFactPort {
  readonly source = 'ORACLE_FACT_PORT' as const;
  private readonly facts: VerifiedEconomicFact[] = [];

  record(fact: VerifiedEconomicFact): void {
    this.facts.push(fact);
  }

  factsFor(sessionId: string): readonly VerifiedEconomicFact[] {
    return this.facts.filter((fact) => fact.sessionId === sessionId);
  }

  hasConflict(sessionId: string): boolean {
    return this.factsFor(sessionId).some((fact) => fact.conflicted);
  }
}

export class DevelopmentProductiveAdapter implements ProductiveContributionPort {
  readonly source = 'PRODUCTIVE_CONTRIBUTION_PORT' as const;
  readonly eligibleProofs: string[] = [];

  markEligible(proofId: string, _deliveryQuantity: IntegerQuantity): { readonly eligible: true; readonly issued: false } {
    this.eligibleProofs.push(proofId);
    return { eligible: true, issued: false };
  }

  issueMoonRey(): never {
    if (moonreyIssuanceActivated()) {
      throw new Error('MoonRey issuance remains unavailable');
    }
    throw new Error('machine commerce cannot issue MoonRey; productive verification is separate');
  }
}

export class DevelopmentMatchingAdapter implements MachineMarketMatchingPort {
  readonly source = 'MACHINE_MARKET_MATCHING_PORT' as const;
  readonly markets = ['COMPUTE_CAPACITY', 'ENERGY', 'MACHINE_SERVICES', 'PRODUCTIVE_CAPACITY_RIGHTS'] as const;

  match(
    order: Pick<MachinePurchaseOrder, 'offerId' | 'providerMachineId' | 'matchingMode'>,
    offers: readonly MachineServiceOffer[],
  ): MatchResult {
    const offer = offers.find((item) => item.offerId === order.offerId && item.providerMachineId === order.providerMachineId);
    if (!offer) {
      return { ok: false, reason: 'offer not found for bilateral match' };
    }
    return { ok: true, mode: order.matchingMode, offerId: offer.offerId };
  }
}

export type MachineEconomyPorts = {
  readonly locks: NativeAssetLockPort;
  readonly fees: ProtocolFeePort;
  readonly oracles: OracleFactPort;
  readonly productive: ProductiveContributionPort;
  readonly matching: MachineMarketMatchingPort;
};

export function developmentPorts(): MachineEconomyPorts {
  return {
    locks: new DevelopmentLockAdapter(),
    fees: new DevelopmentFeeAdapter(),
    oracles: new DevelopmentOracleAdapter(),
    productive: new DevelopmentProductiveAdapter(),
    matching: new DevelopmentMatchingAdapter(),
  };
}
