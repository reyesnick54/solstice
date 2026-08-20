import { randomUUID } from 'node:crypto';

import { err, ok, type Result } from '../../domain/src/result.ts';
import { AssetQuantity } from '../../money/src/asset-quantity.ts';
import { ownerAssetPositionKey } from './native-assets.ts';
import type { CustomerAssetPort, CustomerAssetPosition } from './ports.ts';
import type { CustodyFailure } from './types.ts';

type Position = { available: bigint; held: bigint };

type StoredHold = {
  readonly holdId: string;
  readonly ownerId: string;
  readonly assetId: string;
  amount: bigint;
};

export class InMemoryCustomerAssetPort implements CustomerAssetPort {
  private readonly positions = new Map<string, Position>();
  private readonly holds = new Map<string, StoredHold>();
  private readonly accountOwners = new Map<string, string>();

  seed(ownerId: string, amount: AssetQuantity, custodyAccountId = ownerId): void {
    const current = this.positionRecord(ownerId, amount.assetId);
    current.available += amount.scaledUnits;
    this.accountOwners.set(custodyAccountId, ownerId);
  }

  credit(ownerId: string, amount: AssetQuantity): Result<{ journalId: string }, CustodyFailure> {
    const current = this.positionRecord(ownerId, amount.assetId);
    current.available += amount.scaledUnits;
    return ok({ journalId: `cjn_${randomUUID().replace(/-/g, '')}` });
  }

  placeHold(accountId: string, amount: AssetQuantity): Result<{ holdId: string }, CustodyFailure> {
    const ownerId = this.accountOwners.get(accountId) ?? accountId;
    const position = this.positions.get(ownerAssetPositionKey(ownerId, amount.assetId));
    if (!position || position.available < amount.scaledUnits) {
      return err({ code: 'INSUFFICIENT_ASSET', message: 'hold exceeds available asset' });
    }
    position.available -= amount.scaledUnits;
    position.held += amount.scaledUnits;
    const holdId = `ahold_${randomUUID().replace(/-/g, '')}`;
    this.holds.set(holdId, {
      holdId,
      ownerId,
      amount: amount.scaledUnits,
      assetId: amount.assetId,
    });
    return ok({ holdId });
  }

  releaseHold(holdId: string): Result<unknown, CustodyFailure> {
    const hold = this.holds.get(holdId);
    if (!hold) {
      return err({ code: 'UNKNOWN_HOLD', message: 'asset hold not found' });
    }
    const position = this.positions.get(ownerAssetPositionKey(hold.ownerId, hold.assetId));
    if (position) {
      position.held -= hold.amount;
      position.available += hold.amount;
    }
    this.holds.delete(holdId);
    return ok(true);
  }

  debitHeld(holdId: string, amount: AssetQuantity): Result<{ journalId: string }, CustodyFailure> {
    const hold = this.holds.get(holdId);
    if (!hold) {
      return err({ code: 'HOLD_MISMATCH', message: 'debit exceeds held asset' });
    }
    if (amount.assetId !== hold.assetId) {
      return err({
        code: 'CROSS_ASSET_DEBIT',
        message: `debit asset ${amount.assetId} does not match hold asset ${hold.assetId}`,
      });
    }
    if (hold.amount < amount.scaledUnits) {
      return err({ code: 'HOLD_MISMATCH', message: 'debit exceeds held asset' });
    }
    const position = this.positions.get(ownerAssetPositionKey(hold.ownerId, hold.assetId));
    if (position) {
      position.held -= amount.scaledUnits;
    }
    hold.amount -= amount.scaledUnits;
    if (hold.amount === 0n) {
      this.holds.delete(holdId);
    }
    return ok({ journalId: `wjn_${randomUUID().replace(/-/g, '')}` });
  }

  position(ownerId: string, assetId: string): CustomerAssetPosition {
    return this.positionForAsset(ownerId, assetId);
  }

  positionForAsset(ownerId: string, assetId: string): CustomerAssetPosition {
    const position = this.positions.get(ownerAssetPositionKey(ownerId, assetId)) ?? {
      available: 0n,
      held: 0n,
    };
    return {
      available: AssetQuantity.fromScaledUnits(position.available, assetId),
      held: AssetQuantity.fromScaledUnits(position.held, assetId),
      settled: AssetQuantity.fromScaledUnits(position.available + position.held, assetId),
    };
  }

  /**
   * @deprecated Dual-asset ambiguous. New flows must pass assetId.
   */
  positionLegacy(_ownerId: string): { readonly error: 'ASSET_IDENTITY_REQUIRED' } {
    return { error: 'ASSET_IDENTITY_REQUIRED' };
  }

  hold(holdId: string): StoredHold | undefined {
    const hold = this.holds.get(holdId);
    return hold ? { ...hold } : undefined;
  }

  private positionRecord(ownerId: string, assetId: string): Position {
    const key = ownerAssetPositionKey(ownerId, assetId);
    const current = this.positions.get(key) ?? { available: 0n, held: 0n };
    this.positions.set(key, current);
    return current;
  }
}
