/**
 * ACCESS-14 permanent invariants.
 */

export const ACCESS_PROVIDER_INVARIANT_IDS = [
  'ENTITLEMENT_IS_NOT_CASH',
  'ENTITLEMENT_CANNOT_BE_WITHDRAWN',
  'ENTITLEMENT_CANNOT_BE_PEER_TRANSFERRED_UNLESS_EXPLICITLY_LEGAL_AND_CONFIGURED',
  'PROVIDER_CANNOT_MINT_ENTITLEMENT',
  'PROVIDER_QUOTE_CANNOT_CHANGE_CANONICAL_BALANCE',
  'BFF_CANNOT_INVENT_PROVIDER_AVAILABILITY',
  'BFF_CANNOT_INVENT_PROVIDER_PRICE',
  'NO_REDEMPTION_WITHOUT_PROVIDER_QUOTE_OR_APPROVED_INTERNAL_CAPACITY',
  'NO_DOUBLE_REDEMPTION',
  'FAILED_BOOKING_RELEASES_ENTITLEMENT_HOLD',
  'FAILED_SETTLEMENT_DOES_NOT_CONSUME_ENTITLEMENT',
  'CANCELLED_BOOKING_FOLLOWS_REFUND_POLICY',
  'OWNERSHIP_PURCHASE_IS_NOT_ACCESS_RIGHT',
  'NO_UNOFFICIAL_PROVIDER_SCRAPING',
  'NO_LIVE_PROVIDER_WITHOUT_CAPABILITY_GATE',
  'NO_PROVIDER_SECRET_IN_SOURCE',
  'PROVIDER_WEBHOOK_REPLAY_IS_IDEMPOTENT',
] as const;

export type AccessProviderInvariantId = (typeof ACCESS_PROVIDER_INVARIANT_IDS)[number];

export const ACCESS_PROVIDER_INVARIANT_STATEMENTS: Readonly<Record<AccessProviderInvariantId, string>> = Object.freeze({
  ENTITLEMENT_IS_NOT_CASH: 'Access entitlements are governed units, not monetary balances.',
  ENTITLEMENT_CANNOT_BE_WITHDRAWN: 'Entitlement USD-equivalent coverage is never withdrawable as cash.',
  ENTITLEMENT_CANNOT_BE_PEER_TRANSFERRED_UNLESS_EXPLICITLY_LEGAL_AND_CONFIGURED:
    'Entitlements are non-transferable unless explicitly legal and configured.',
  PROVIDER_CANNOT_MINT_ENTITLEMENT: 'External providers cannot mint SunRey entitlements.',
  PROVIDER_QUOTE_CANNOT_CHANGE_CANONICAL_BALANCE: 'Provider quotes do not mutate canonical ledger balances.',
  BFF_CANNOT_INVENT_PROVIDER_AVAILABILITY: 'Consumer BFF must source availability from provider gateway or approved capacity.',
  BFF_CANNOT_INVENT_PROVIDER_PRICE: 'Consumer BFF must source pricing from provider gateway quotes.',
  NO_REDEMPTION_WITHOUT_PROVIDER_QUOTE_OR_APPROVED_INTERNAL_CAPACITY:
    'Redemption requires a provider quote or approved internal capacity record.',
  NO_DOUBLE_REDEMPTION: 'The same entitlement hold cannot be redeemed twice.',
  FAILED_BOOKING_RELEASES_ENTITLEMENT_HOLD: 'Failed provider booking releases held entitlement units.',
  FAILED_SETTLEMENT_DOES_NOT_CONSUME_ENTITLEMENT: 'Failed settlement must not consume entitlement units.',
  CANCELLED_BOOKING_FOLLOWS_REFUND_POLICY: 'Cancelled bookings follow configured refund and reinstatement policy.',
  OWNERSHIP_PURCHASE_IS_NOT_ACCESS_RIGHT: 'Permanent ownership purchase is not modeled as temporary AccessRight.',
  NO_UNOFFICIAL_PROVIDER_SCRAPING: 'No unofficial scraping or private API reverse engineering is permitted.',
  NO_LIVE_PROVIDER_WITHOUT_CAPABILITY_GATE: 'Live provider connectivity requires explicit capability gate approval.',
  NO_PROVIDER_SECRET_IN_SOURCE: 'Provider secrets never appear in source code.',
  PROVIDER_WEBHOOK_REPLAY_IS_IDEMPOTENT: 'Duplicate provider webhook deliveries are idempotent.',
});

export type InvariantCheckResult = {
  readonly invariantId: AccessProviderInvariantId;
  readonly passed: boolean;
  readonly detail: string;
};

export function scanSourceForForbiddenSecrets(source: string): readonly string[] {
  const patterns = [/api[_-]?key\s*[:=]\s*['"][a-z0-9]{16,}/i, /secret\s*[:=]\s*['"][a-z0-9]{16,}/i];
  return patterns.filter((pattern) => pattern.test(source)).map((pattern) => pattern.source);
}

export function assertProviderInvariant(id: AccessProviderInvariantId, passed: boolean, detail: string): InvariantCheckResult {
  return Object.freeze({ invariantId: id, passed, detail });
}
