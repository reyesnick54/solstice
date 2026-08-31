/**
 * ACCESS Wave 5 — provider payload privacy checks.
 */

const FORBIDDEN_PROVIDER_FIELDS = [
  'hinRecord',
  'dnaSequence',
  'healthRecord',
  'bankBalance',
  'tokenHolding',
  'sunreyBalance',
  'moonreyBalance',
  'privateCommunication',
  'geneticData',
] as const;

export type PrivacyViolation = {
  readonly field: string;
  readonly context: string;
};

export function scanPayloadForForbiddenPii(payload: unknown, context = 'provider-payload'): readonly PrivacyViolation[] {
  const serialized = JSON.stringify(payload, (_key, value) =>
    typeof value === 'bigint' ? value.toString() : value,
  ).toLowerCase();
  const violations: PrivacyViolation[] = [];
  for (const field of FORBIDDEN_PROVIDER_FIELDS) {
    if (serialized.includes(field.toLowerCase())) {
      violations.push(Object.freeze({ field, context }));
    }
  }
  return Object.freeze(violations);
}

export function assertProviderPayloadMinimal(payload: Record<string, unknown>): boolean {
  const allowedKeys = new Set([
    'subjectRef',
    'customerId',
    'bookingReference',
    'catalogItemId',
    'quantity',
    'startsAt',
    'endsAt',
    'location',
    'idempotencyKey',
    'providerId',
    'quoteId',
    'reservationId',
  ]);
  return Object.keys(payload).every((key) => allowedKeys.has(key));
}
