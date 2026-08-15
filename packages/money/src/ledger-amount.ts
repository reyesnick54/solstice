import { AssetQuantity } from './asset-quantity.ts';
import { Money } from './money.ts';

/**
 * Amounts that may appear on a canonical ledger posting.
 * A journal is single-kind and single-asset: never mix Money with AssetQuantity.
 */
export type LedgerAmount = Money | AssetQuantity;

export function isLedgerAmount(value: unknown): value is LedgerAmount {
  return value instanceof Money || value instanceof AssetQuantity;
}

export function ledgerAssetKey(amount: LedgerAmount): string {
  return amount instanceof AssetQuantity ? amount.assetId : amount.currency;
}

export function ledgerScaledUnits(amount: LedgerAmount): bigint {
  return amount instanceof AssetQuantity ? amount.scaledUnits : amount.minorUnits;
}

export function ledgerAmountKind(amount: LedgerAmount): 'MONEY' | 'ASSET' {
  return amount instanceof AssetQuantity ? 'ASSET' : 'MONEY';
}
