/**
 * Generic non-fiat asset quantity.
 *
 * Scaled units are bigint only. This is not Money: it has an assetId, not an
 * ISO currency, and must never be summed with Money in one journal.
 */

import { assertSafeMinorUnits } from './money.ts';

const INTEGER_STRING = /^-?\d+$/;

export class AssetQuantity {
  readonly scaledUnits: bigint;
  readonly assetId: string;

  private constructor(scaledUnits: bigint, assetId: string) {
    assertSafeMinorUnits(scaledUnits, 'asset quantity');
    if (typeof assetId !== 'string' || assetId.length === 0) {
      throw new TypeError('AssetQuantity requires a non-empty asset id');
    }
    this.scaledUnits = scaledUnits;
    this.assetId = assetId;
    Object.freeze(this);
  }

  static fromScaledUnits(scaledUnits: bigint, assetId: string): AssetQuantity {
    if (typeof scaledUnits !== 'bigint') {
      throw new TypeError(
        'AssetQuantity.fromScaledUnits requires bigint; number and float are forbidden',
      );
    }
    return new AssetQuantity(scaledUnits, assetId);
  }

  static fromScaledUnitsString(scaledUnits: string, assetId: string): AssetQuantity {
    if (typeof scaledUnits !== 'string' || !INTEGER_STRING.test(scaledUnits)) {
      throw new TypeError(
        'AssetQuantity string must be a signed integer in scaled units; no decimal point',
      );
    }
    return new AssetQuantity(BigInt(scaledUnits), assetId);
  }

  static zero(assetId: string): AssetQuantity {
    return new AssetQuantity(0n, assetId);
  }

  plus(other: AssetQuantity): AssetQuantity {
    this.assertSameAsset(other);
    const sum = this.scaledUnits + other.scaledUnits;
    assertSafeMinorUnits(sum, 'asset quantity addition');
    return new AssetQuantity(sum, this.assetId);
  }

  minus(other: AssetQuantity): AssetQuantity {
    this.assertSameAsset(other);
    const difference = this.scaledUnits - other.scaledUnits;
    assertSafeMinorUnits(difference, 'asset quantity subtraction');
    return new AssetQuantity(difference, this.assetId);
  }

  isZero(): boolean {
    return this.scaledUnits === 0n;
  }

  isPositive(): boolean {
    return this.scaledUnits > 0n;
  }

  isNegative(): boolean {
    return this.scaledUnits < 0n;
  }

  equals(other: AssetQuantity): boolean {
    return this.assetId === other.assetId && this.scaledUnits === other.scaledUnits;
  }

  toJSON(): { scaledUnits: string; assetId: string } {
    return { scaledUnits: this.scaledUnits.toString(), assetId: this.assetId };
  }

  private assertSameAsset(other: AssetQuantity): void {
    if (this.assetId !== other.assetId) {
      throw new TypeError(`Asset mismatch: ${this.assetId} vs ${other.assetId}`);
    }
  }
}

export function isAssetQuantity(value: unknown): value is AssetQuantity {
  return value instanceof AssetQuantity;
}
