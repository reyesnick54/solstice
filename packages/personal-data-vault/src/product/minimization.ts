/**
 * Field / payload minimization. Authoritative external systems stay
 * outside the Vault. Store references or verified claims instead.
 */

export const FORBIDDEN_PAYLOAD_KEYS = [
  'kycDocument',
  'kycDocumentImage',
  'passportNumber',
  'ssn',
  'nationalId',
  'bankAccountNumber',
  'iban',
  'routingNumber',
  'cardPan',
  'cardNumber',
  'cvv',
  'cvc',
  'pin',
  'privateKey',
  'mnemonic',
  'seedPhrase',
  'providerSecret',
  'apiKey',
  'password',
  'rawCredential',
  'dna',
  'geneticSequence',
  'geneticData',
  'locationHistory',
  'consentDocument',
  'governmentId',
  'communications',
] as const;

export type MinimizationFailure = {
  readonly code: 'FORBIDDEN_PAYLOAD_FIELD';
  readonly message: string;
  readonly field: string;
};

export function findForbiddenPayloadField(value: unknown, path = ''): MinimizationFailure | null {
  if (value === null || typeof value !== 'object') {
    return null;
  }
  if (Array.isArray(value)) {
    for (const [index, item] of value.entries()) {
      const found = findForbiddenPayloadField(item, `${path}[${index}]`);
      if (found) {
        return found;
      }
    }
    return null;
  }
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    const next = path ? `${path}.${key}` : key;
    if ((FORBIDDEN_PAYLOAD_KEYS as readonly string[]).includes(key)) {
      return {
        code: 'FORBIDDEN_PAYLOAD_FIELD',
        message: `Vault must not store ${key}; keep a reference on the authoritative system`,
        field: next,
      };
    }
    const nested = findForbiddenPayloadField(item, next);
    if (nested) {
      return nested;
    }
  }
  return null;
}
