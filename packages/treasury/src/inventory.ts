import { Money } from '../../money/src/money.ts';
import type { UtcInstant } from '../../domain/src/time.ts';
import type { FxInventoryId } from './ids.ts';

/**
 * Treasury-side FX inventory. Not customer deposits.
 */
export type FxInventoryPosition = {
  readonly inventoryId: FxInventoryId;
  readonly currency: string;
  readonly owned: Money;
  readonly reserved: Money;
  readonly unsettledExposure: Money;
  readonly updatedAt: UtcInstant;
};

export function freezeFxInventory(row: FxInventoryPosition): FxInventoryPosition {
  if (row.owned.currency !== row.currency || row.reserved.currency !== row.currency) {
    throw new Error('FX inventory must stay currency-separated');
  }
  if (row.owned.isNegative() || row.reserved.isNegative() || row.unsettledExposure.isNegative()) {
    throw new Error('FX inventory cannot be negative');
  }
  return Object.freeze({ ...row });
}

export function emptyFxInventory(id: FxInventoryId, currency: string, now: UtcInstant): FxInventoryPosition {
  return freezeFxInventory({
    inventoryId: id,
    currency,
    owned: Money.zero(currency),
    reserved: Money.zero(currency),
    unsettledExposure: Money.zero(currency),
    updatedAt: now,
  });
}
