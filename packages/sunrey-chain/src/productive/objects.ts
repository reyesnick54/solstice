import { PRODUCTIVE_SCHEMA_VERSION, type GeographyRef, type ObjectStatus, type ProductiveCategory } from './types.ts';

export type ProductiveEconomicObject = {
  readonly schemaVersion: typeof PRODUCTIVE_SCHEMA_VERSION;
  readonly objectId: string;
  readonly category: ProductiveCategory;
  readonly owner: string;
  readonly controller: string;
  readonly operator: string;
  readonly geography: GeographyRef;
  readonly rightsReference: string;
  readonly oracleFeedReferences: readonly string[];
  readonly unitSchema: string;
  readonly capacityMetadata: Readonly<Record<string, string>>;
  readonly provenance: string;
  readonly status: ObjectStatus;
  readonly activationHeight: number;
  readonly expirationHeight: number | null;
  readonly validFromUnixSeconds: bigint;
  readonly validUntilUnixSeconds: bigint | null;
};

export function objectIsActive(
  object: ProductiveEconomicObject,
  height: number,
  blockTimeUnixSeconds: bigint,
): boolean {
  if (object.status !== 'REGISTERED' && object.status !== 'ACTIVE') {
    return false;
  }
  if (height < object.activationHeight) {
    return false;
  }
  if (object.expirationHeight !== null && height >= object.expirationHeight) {
    return false;
  }
  if (blockTimeUnixSeconds < object.validFromUnixSeconds) {
    return false;
  }
  if (object.validUntilUnixSeconds !== null && blockTimeUnixSeconds >= object.validUntilUnixSeconds) {
    return false;
  }
  return true;
}
