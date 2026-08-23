export const KEY_ROLES = [
  'VALIDATOR_CONSENSUS',
  'WALLET_USER',
  'NODE_IDENTITY',
  'ADMINISTRATIVE',
] as const;
export type KeyRole = (typeof KEY_ROLES)[number];

export type KeyReference = {
  readonly role: KeyRole;
  readonly keyId: string;
  readonly publicKeyHex: string | null;
  readonly hsmOrKmsRef: string | null;
  readonly privateMaterialPresent: false;
};

export function assertSeparatedRoles(refs: readonly KeyReference[]): 'OK' | 'UNIVERSAL_KEY' {
  const ids = refs.map((ref) => ref.keyId);
  return new Set(ids).size === ids.length ? 'OK' : 'UNIVERSAL_KEY';
}

export function rotateReference(
  current: KeyReference,
  nextKeyId: string,
): { readonly previous: KeyReference; readonly next: KeyReference } {
  return {
    previous: current,
    next: {
      ...current,
      keyId: nextKeyId,
      publicKeyHex: null,
      privateMaterialPresent: false,
    },
  };
}

export const PRODUCTION_PRIVATE_KEYS_COMMITTED = false;
