export const RIGHT_TYPES = [
  'OWN',
  'CONTROL',
  'ACCESS',
  'USE',
  'COMPUTE',
  'LEASE',
  'DELIVER',
  'PARTICIPATE',
  'TRANSFER',
  'REVOKE',
] as const;
export type RightType = (typeof RIGHT_TYPES)[number];

export const RIGHT_TYPE_IDS: { readonly [K in RightType]: number } = {
  OWN: 1,
  CONTROL: 2,
  ACCESS: 3,
  USE: 4,
  COMPUTE: 5,
  LEASE: 6,
  DELIVER: 7,
  PARTICIPATE: 8,
  TRANSFER: 9,
  REVOKE: 10,
};

export type RightObject = {
  readonly schemaVersion: 1;
  readonly rightId: string;
  readonly rightType: RightType;
  readonly subjectId: string;
  readonly objectId: string;
  readonly holderId: string;
  readonly issuerId: string;
  readonly scope: string;
  readonly purpose: string;
  readonly permittedOperations: readonly string[];
  readonly jurisdiction: string;
  readonly startUnixSeconds: bigint;
  readonly expirationUnixSeconds: bigint;
  readonly revocationState: 'ACTIVE' | 'REVOKED';
  readonly transferable: boolean;
  readonly compensationRef: string;
  readonly provenanceRef: string;
};

export function rightTypeFromId(id: number): RightType | null {
  const found = (Object.entries(RIGHT_TYPE_IDS) as Array<[RightType, number]>).find(
    ([, value]) => value === id,
  );
  return found ? found[0] : null;
}

export function ownershipImpliesUnlimitedUse(): false {
  return false;
}
