import { Money } from '@solstice/domain';

/**
 * PYR is a distinct participation asset ("The Currency of You").
 * It is an economic settlement and participation asset powered by
 * activity in the Solstice Personal Data Economy.
 * It is not collateralized by personal data, not backed by personal
 * data, and not redeemable for personal data.
 *
 * Amounts are integer minor units (bigint). Floating-point is forbidden.
 */
export const PYR_ASSET = 'PYR' as const;
export type PyrAsset = typeof PYR_ASSET;

export const PYR_ASSET_CLASS = 'PYR_PARTICIPATION' as const;

export class PyrAmount {
  readonly minorUnits: bigint;
  readonly asset: PyrAsset;

  private constructor(minorUnits: bigint) {
    if (typeof minorUnits !== 'bigint') {
      throw new TypeError('PyrAmount requires bigint minor units; floating-point is forbidden');
    }
    this.minorUnits = minorUnits;
    this.asset = PYR_ASSET;
    Object.freeze(this);
  }

  static fromMinorUnits(minorUnits: bigint): PyrAmount {
    if (typeof minorUnits !== 'bigint') {
      throw new TypeError('PyrAmount.fromMinorUnits requires bigint; number and float are forbidden');
    }
    return new PyrAmount(minorUnits);
  }

  static zero(): PyrAmount {
    return new PyrAmount(0n);
  }

  add(other: PyrAmount): PyrAmount {
    return new PyrAmount(this.minorUnits + other.minorUnits);
  }

  subtract(other: PyrAmount): PyrAmount {
    return new PyrAmount(this.minorUnits - other.minorUnits);
  }

  equals(other: PyrAmount): boolean {
    return this.minorUnits === other.minorUnits;
  }

  isZero(): boolean {
    return this.minorUnits === 0n;
  }

  isPositive(): boolean {
    return this.minorUnits > 0n;
  }

  toLedgerMoney(): Money {
    return Money.of(this.minorUnits, PYR_ASSET);
  }
}
