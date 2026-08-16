export const TRANSACTION_FAMILIES = [
  'SYSTEM',
  'IDENTITY',
  'ATTESTATION',
  'NATIVE_ASSET',
  'RIGHTS',
  'CONSENT_REFERENCE',
  'ORACLE',
  'PRODUCTIVE_CAPACITY',
  'DELIVERY',
  'EXCHANGE_SETTLEMENT',
  'GOVERNANCE',
  'VALIDATOR',
  'EVIDENCE_ANCHOR',
] as const;
export type TransactionFamily = (typeof TRANSACTION_FAMILIES)[number];

export const TRANSACTION_FAMILY_IDS: { readonly [K in TransactionFamily]: number } = {
  SYSTEM: 1,
  IDENTITY: 2,
  ATTESTATION: 3,
  NATIVE_ASSET: 4,
  RIGHTS: 5,
  CONSENT_REFERENCE: 6,
  ORACLE: 7,
  PRODUCTIVE_CAPACITY: 8,
  DELIVERY: 9,
  EXCHANGE_SETTLEMENT: 10,
  GOVERNANCE: 11,
  VALIDATOR: 12,
  EVIDENCE_ANCHOR: 13,
};

export const TRANSACTION_FAMILY_ACTIVATION = {
  SYSTEM: 'RESERVED',
  IDENTITY: 'ACTIVE',
  ATTESTATION: 'ACTIVE',
  NATIVE_ASSET: 'ACTIVE',
  RIGHTS: 'ACTIVE',
  CONSENT_REFERENCE: 'ACTIVE',
  ORACLE: 'NOT_ACTIVATED',
  PRODUCTIVE_CAPACITY: 'ACTIVE',
  DELIVERY: 'ACTIVE',
  EXCHANGE_SETTLEMENT: 'NOT_ACTIVATED',
  GOVERNANCE: 'RESERVED',
  VALIDATOR: 'RESERVED',
  EVIDENCE_ANCHOR: 'ACTIVE',
} as const;

export type FamilyActivation = 'ACTIVE' | 'RESERVED' | 'NOT_ACTIVATED';

export function transactionFamilyFromId(id: number): TransactionFamily | null {
  const found = (Object.entries(TRANSACTION_FAMILY_IDS) as Array<[TransactionFamily, number]>).find(
    ([, value]) => value === id,
  );
  return found ? found[0] : null;
}

export function familyIsActivated(family: TransactionFamily): boolean {
  return TRANSACTION_FAMILY_ACTIVATION[family] === 'ACTIVE';
}
