import type { FeeAssetId, NativeAssetPosition } from './types.ts';

type AccountKey = `${string}:${FeeAssetId}`;

function keyOf(accountId: string, asset: FeeAssetId): AccountKey {
  return `${accountId}:${asset}`;
}

/**
 * Development native-asset positions used for fee reservation and transfers.
 * Not a fiat ledger. Not customer-account truth. Integer minor units only.
 */
export class NativeAssetAccounts {
  private readonly positions = new Map<AccountKey, { available: bigint; reserved: bigint; locked: bigint }>();

  private slot(accountId: string, asset: FeeAssetId) {
    const key = keyOf(accountId, asset);
    let slot = this.positions.get(key);
    if (!slot) {
      slot = { available: 0n, reserved: 0n, locked: 0n };
      this.positions.set(key, slot);
    }
    return slot;
  }

  position(accountId: string, asset: FeeAssetId): NativeAssetPosition {
    const slot = this.positions.get(keyOf(accountId, asset)) ?? {
      available: 0n,
      reserved: 0n,
      locked: 0n,
    };
    return Object.freeze({
      accountId,
      asset,
      available: slot.available,
      reserved: slot.reserved,
      locked: slot.locked,
    });
  }

  credit(accountId: string, asset: FeeAssetId, amount: bigint): void {
    if (amount < 0n) {
      throw new TypeError('credit amount must be unsigned');
    }
    this.slot(accountId, asset).available += amount;
  }

  debitAvailable(accountId: string, asset: FeeAssetId, amount: bigint): boolean {
    const slot = this.slot(accountId, asset);
    if (slot.available < amount) {
      return false;
    }
    slot.available -= amount;
    return true;
  }

  reserve(accountId: string, asset: FeeAssetId, amount: bigint): boolean {
    const slot = this.slot(accountId, asset);
    if (slot.available < amount) {
      return false;
    }
    slot.available -= amount;
    slot.reserved += amount;
    return true;
  }

  chargeReserved(accountId: string, asset: FeeAssetId, charged: bigint, reserved: bigint): boolean {
    const slot = this.slot(accountId, asset);
    if (charged > reserved || slot.reserved < reserved) {
      return false;
    }
    slot.reserved -= reserved;
    slot.available += reserved - charged;
    return true;
  }

  releaseReserved(accountId: string, asset: FeeAssetId, amount: bigint): boolean {
    const slot = this.slot(accountId, asset);
    if (slot.reserved < amount) {
      return false;
    }
    slot.reserved -= amount;
    slot.available += amount;
    return true;
  }

  lock(accountId: string, asset: FeeAssetId, amount: bigint): boolean {
    const slot = this.slot(accountId, asset);
    if (slot.available < amount) {
      return false;
    }
    slot.available -= amount;
    slot.locked += amount;
    return true;
  }

  unlock(accountId: string, asset: FeeAssetId, amount: bigint): boolean {
    const slot = this.slot(accountId, asset);
    if (slot.locked < amount) {
      return false;
    }
    slot.locked -= amount;
    slot.available += amount;
    return true;
  }

  transfer(from: string, to: string, asset: FeeAssetId, amount: bigint): boolean {
    if (amount <= 0n) {
      return false;
    }
    if (!this.debitAvailable(from, asset, amount)) {
      return false;
    }
    this.credit(to, asset, amount);
    return true;
  }

  snapshot(): readonly NativeAssetPosition[] {
    return [...this.positions.entries()]
      .map(([key, slot]) => {
        const [accountId, asset] = key.split(':') as [string, FeeAssetId];
        return Object.freeze({
          accountId,
          asset,
          available: slot.available,
          reserved: slot.reserved,
          locked: slot.locked,
        });
      })
      .sort((left, right) =>
        left.accountId === right.accountId
          ? left.asset.localeCompare(right.asset)
          : left.accountId.localeCompare(right.accountId),
      );
  }

  clone(): NativeAssetAccounts {
    const copy = new NativeAssetAccounts();
    copy.copyFrom(this);
    return copy;
  }

  copyFrom(other: NativeAssetAccounts): void {
    this.positions.clear();
    for (const [key, slot] of other.positions) {
      this.positions.set(key, { ...slot });
    }
  }
}
