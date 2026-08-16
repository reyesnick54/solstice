import { AssetQuantity } from '../../../money/src/asset-quantity.ts';
import { NATIVE_ASSET_PROTOCOL_KEYS, type NativeAssetId } from './assets.ts';
import { MAX_QUANTITY_DIGITS, MAX_SCALED_UNITS, PROTOCOL_SCHEMA_VERSION } from './constants.ts';

const INTEGER_STRING = /^(0|[1-9]\d*)$/;

export type ProtocolQuantity = {
  readonly schemaVersion: 1;
  readonly assetId: NativeAssetId;
  readonly scaledUnits: bigint;
};

export function protocolQuantityFromAsset(
  quantity: AssetQuantity,
  assetId: NativeAssetId,
): ProtocolQuantity | null {
  if (quantity.assetId !== NATIVE_ASSET_PROTOCOL_KEYS[assetId]) {
    return null;
  }
  if (quantity.scaledUnits < 0n || quantity.scaledUnits > MAX_SCALED_UNITS) {
    return null;
  }
  return Object.freeze({
    schemaVersion: PROTOCOL_SCHEMA_VERSION,
    assetId,
    scaledUnits: quantity.scaledUnits,
  });
}

export function toAssetQuantity(quantity: ProtocolQuantity): AssetQuantity {
  return AssetQuantity.fromScaledUnits(quantity.scaledUnits, NATIVE_ASSET_PROTOCOL_KEYS[quantity.assetId]);
}

export function parseScaledUnits(text: string): bigint | null {
  if (!INTEGER_STRING.test(text) || text.length > MAX_QUANTITY_DIGITS) {
    return null;
  }
  const value = BigInt(text);
  if (value > MAX_SCALED_UNITS) {
    return null;
  }
  return value;
}

export function formatScaledUnits(value: bigint): string {
  if (value < 0n || value > MAX_SCALED_UNITS) {
    throw new TypeError('protocol quantity is outside the bound');
  }
  return value.toString();
}

export function isFiatMoneyField(_name: string): false {
  return false;
}
