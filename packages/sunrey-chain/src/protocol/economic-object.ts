import type { NativeAssetId } from './assets.ts';
import type { ProtocolQuantity } from './quantity.ts';
import type { RevocationState } from './actor.ts';

export const ECONOMIC_OBJECT_TYPES = [
  'FUNGIBLE_NATIVE_ASSET',
  'VERIFIED_ATTRIBUTE',
  'ATTESTATION',
  'CREDENTIAL',
  'PERMISSION_RIGHT',
  'COMPUTE_RIGHT',
  'PRODUCTIVE_CAPACITY_RIGHT',
  'OUTPUT_DELIVERY_CLAIM',
  'RESOURCE_USAGE_RIGHT',
  'SETTLEMENT_CLAIM',
  'EVIDENCE_ANCHOR',
  'COMPOSITE_ECONOMIC_WORKFLOW',
] as const;
export type EconomicObjectType = (typeof ECONOMIC_OBJECT_TYPES)[number];

export const ECONOMIC_OBJECT_TYPE_IDS: { readonly [K in EconomicObjectType]: number } = {
  FUNGIBLE_NATIVE_ASSET: 1,
  VERIFIED_ATTRIBUTE: 2,
  ATTESTATION: 3,
  CREDENTIAL: 4,
  PERMISSION_RIGHT: 5,
  COMPUTE_RIGHT: 6,
  PRODUCTIVE_CAPACITY_RIGHT: 7,
  OUTPUT_DELIVERY_CLAIM: 8,
  RESOURCE_USAGE_RIGHT: 9,
  SETTLEMENT_CLAIM: 10,
  EVIDENCE_ANCHOR: 11,
  COMPOSITE_ECONOMIC_WORKFLOW: 12,
};

export type EconomicObject = {
  readonly schemaVersion: 1;
  readonly objectId: string;
  readonly objectType: EconomicObjectType;
  readonly commitmentHex: string;
  readonly schemaRef: string;
  readonly issuerRef: string;
  readonly subjectRef: string;
  readonly revocationState: RevocationState;
  readonly jurisdiction: string;
  readonly quantity: ProtocolQuantity | null;
  readonly attestationRef: string;
  readonly evidenceRef: string;
};

export function economicObjectTypeFromId(id: number): EconomicObjectType | null {
  const found = (Object.entries(ECONOMIC_OBJECT_TYPE_IDS) as Array<[EconomicObjectType, number]>).find(
    ([, value]) => value === id,
  );
  return found ? found[0] : null;
}

export function objectRequiresCommitment(type: EconomicObjectType): boolean {
  return (
    type === 'ATTESTATION' ||
    type === 'CREDENTIAL' ||
    type === 'VERIFIED_ATTRIBUTE' ||
    type === 'EVIDENCE_ANCHOR' ||
    type === 'SETTLEMENT_CLAIM'
  );
}

export function nativeAssetObjectId(assetId: NativeAssetId): string {
  return `obj.native.${assetId.toLowerCase()}`;
}
