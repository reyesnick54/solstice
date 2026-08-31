/** PCI-sensitive field names — local copy for access-economy boundary checks. */
export const PCI_SENSITIVE_KEYS = [
  'pan',
  'PAN',
  'primaryAccountNumber',
  'cardNumber',
  'cvv',
  'CVV',
  'cvc',
  'CVC',
  'cvv2',
  'cvc2',
  'pin',
  'PIN',
  'trackData',
  'track1',
  'track2',
  'magstripe',
  'magneticStripe',
  'tokenizedPan',
  'tokenizedPAN',
  'tokenPAN',
] as const;

export function assertNoSensitiveCardPayload(value: unknown, path = 'payload'): void {
  if (value === null || value === undefined || typeof value !== 'object') {
    return;
  }
  if (Array.isArray(value)) {
    for (const [index, item] of value.entries()) {
      assertNoSensitiveCardPayload(item, `${path}[${String(index)}]`);
    }
    return;
  }
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if ((PCI_SENSITIVE_KEYS as readonly string[]).includes(key)) {
      throw Object.assign(new Error(`sensitive card field '${key}' is forbidden`), {
        code: 'PCI_BOUNDARY_VIOLATION',
        field: `${path}.${key}`,
      });
    }
    assertNoSensitiveCardPayload(child, `${path}.${key}`);
  }
}
