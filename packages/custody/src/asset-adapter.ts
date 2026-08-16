import { randomUUID } from 'node:crypto';

import { err, ok, type Result } from '../../domain/src/result.ts';
import { AssetQuantity } from '../../money/src/asset-quantity.ts';
import type { CustomerAssetPort } from './ports.ts';
import type { CustodyFailure } from './types.ts';

type Position = { available: bigint; held: bigint };

export class InMemoryCustomerAssetPort implements CustomerAssetPort {
  private readonly positions = new Map<string, Position>();
  private readonly holds = new Map<string, { ownerId: string; amount: bigint; assetId: string }>();
  private readonly accountOwners = new Map<string, string>();
  private lastAssetId = 'sunrey-coin';

  seed(ownerId: string, amount: AssetQuantity, custodyAccountId = ownerId): void {
    const current = this.positions.get(ownerId) ?? { available: 0n, held: 0n };
    current.available += amount.scaledUnits;
    this.positions.set(ownerId, current);
    this.accountOwners.set(custodyAccountId, ownerId);
    this.lastAssetId = amount.assetId;
  }

  credit(ownerId: string, amount: AssetQuantity): Result<{ journalId: string }, CustodyFailure> {
    const current = this.positions.get(ownerId) ?? { available: 0n, held: 0n };
    current.available += amount.scaledUnits;
    this.positions.set(ownerId, current);
    return ok({ journalId: `cjn_${randomUUID().replace(/-/g, '')}` });
  }

  placeHold(accountId: string, amount: AssetQuantity): Result<{ holdId: string }, CustodyFailure> {
    const ownerId = this.accountOwners.get(accountId) ?? accountId;
    const position = this.positions.get(ownerId);
    if (!position || position.available < amount.scaledUnits) {
      return err({ code: 'INSUFFICIENT_ASSET', message: 'hold exceeds available asset' });
    }
    position.available -= amount.scaledUnits;
    position.held += amount.scaledUnits;
    const holdId = `ahold_${randomUUID().replace(/-/g, '')}`;
    this.holds.set(holdId, { ownerId, amount: amount.scaledUnits, assetId: amount.assetId });
    return ok({ holdId });
  }

  releaseHold(holdId: string): Result<unknown, CustodyFailure> {
    const hold = this.holds.get(holdId);
    if (!hold) {
      return err({ code: 'UNKNOWN_HOLD', message: 'asset hold not found' });
    }
    const position = this.positions.get(hold.ownerId);
    if (position) {
      position.held -= hold.amount;
      position.available += hold.amount;
    }
    this.holds.delete(holdId);
    return ok(true);
  }

  debitHeld(holdId: string, amount: AssetQuantity): Result<{ journalId: string }, CustodyFailure> {
    const hold = this.holds.get(holdId);
    if (!hold || hold.amount < amount.scaledUnits) {
      return err({ code: 'HOLD_MISMATCH', message: 'debit exceeds held asset' });
    }
    const position = this.positions.get(hold.ownerId);
    if (position) {
      position.held -= amount.scaledUnits;
    }
    hold.amount -= amount.scaledUnits;
    if (hold.amount === 0n) {
      this.holds.delete(holdId);
    }
    return ok({ journalId: `wjn_${randomUUID().replace(/-/g, '')}` });
  }

  position(ownerId: string): { available: AssetQuantity; held: AssetQuantity; settled: AssetQuantity } {
    const position = this.positions.get(ownerId) ?? { available: 0n, held: 0n };
    const assetId = this.lastAssetId;
    return {
      available: AssetQuantity.fromScaledUnits(position.available, assetId),
      held: AssetQuantity.fromScaledUnits(position.held, assetId),
      settled: AssetQuantity.fromScaledUnits(position.available + position.held, assetId),
    };
  }
}
