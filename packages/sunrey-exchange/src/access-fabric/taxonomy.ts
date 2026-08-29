/**
 * ACCESS-09 — SunRey Exchange capacity markets and dual-economy clearing.
 *
 * This is not a second exchange and not a second matching engine. Capacity
 * discovery, offers, RFQ, auctions, and queue allocation extend the canonical
 * PRODUCTIVE_CAPACITY and INTELLIGENCE_COMPUTE families already owned by
 * `packages/sunrey-exchange`. Batch clearing delegates to the canonical
 * `clearAuction` in `../auction.ts`.
 *
 * Consideration never becomes a balance held here. Fiat moves on the canonical
 * Ledger, native assets move on canonical custody/chain rails, and entitlement
 * or reward consumption is delegated to the owning port.
 */

/** How capacity is discovered and awarded. Each mechanism reuses canonical Exchange primitives. */
export const CAPACITY_TRADE_MECHANISMS = [
  'FIXED_PRICE_OFFER',
  'REQUEST_FOR_QUOTE',
  'BATCH_AUCTION',
  'QUEUE_ALLOCATION',
] as const;
export type CapacityTradeMechanism = (typeof CAPACITY_TRADE_MECHANISMS)[number];

/**
 * Permitted consideration kinds. Product configuration decides which are
 * enabled for an instrument. There is no fixed SunRey/MoonRey ratio, no third
 * currency, and entitlement capacity is not transferable money.
 */
export const CONSIDERATION_KINDS = [
  'FIAT',
  'SUNREY_COIN',
  'MOONREY_COIN',
  'ACCESS_ENTITLEMENT',
  'REWARD_CREDIT',
] as const;
export type ConsiderationKind = (typeof CONSIDERATION_KINDS)[number];

/** Consideration kinds that move value on a canonical financial rail. */
export const MONETARY_CONSIDERATION_KINDS = ['FIAT', 'SUNREY_COIN', 'MOONREY_COIN'] as const;
export type MonetaryConsiderationKind = (typeof MONETARY_CONSIDERATION_KINDS)[number];

/** Consideration kinds that are consumed, never transferred or redeemed for money. */
export const NON_MONETARY_CONSIDERATION_KINDS = ['ACCESS_ENTITLEMENT', 'REWARD_CREDIT'] as const;
export type NonMonetaryConsiderationKind = (typeof NON_MONETARY_CONSIDERATION_KINDS)[number];

/**
 * Settlement semantics.
 * DELIVERY_VERSUS_PAYMENT — consideration commits only with attested delivery.
 * RESERVATION_VERSUS_CONSIDERATION — consideration commits against a confirmed
 * reservation of future capacity; delivery is attested later.
 */
export const ACCESS_SETTLEMENT_SEMANTICS = [
  'DELIVERY_VERSUS_PAYMENT',
  'RESERVATION_VERSUS_CONSIDERATION',
] as const;
export type AccessSettlementSemantics = (typeof ACCESS_SETTLEMENT_SEMANTICS)[number];

export const CAPACITY_RESERVATION_STATES = [
  'REQUESTED',
  'POLICY_REFUSED',
  'CONSIDERATION_RESERVED',
  'CONFIRMED',
  'PARTIALLY_DELIVERED',
  'DELIVERED',
  'CANCELLED',
  'EXPIRED',
  'REFUNDED',
  'FAILED',
  'REQUIRES_COMPENSATION',
] as const;
export type CapacityReservationState = (typeof CAPACITY_RESERVATION_STATES)[number];

export const CAPACITY_CLEARING_OUTCOMES = ['CLEARED', 'REFUSED', 'FAILED', 'REQUIRES_COMPENSATION'] as const;
export type CapacityClearingOutcome = (typeof CAPACITY_CLEARING_OUTCOMES)[number];

export const ACCESS_CLEARING_FAILURE_CODES = [
  'AUTHORITY_MISSING',
  'AUTHORITY_SCOPE_MISMATCH',
  'CONSIDERATION_NOT_PERMITTED',
  'CONSIDERATION_EMPTY',
  'LEDGER_RAIL_MISSING',
  'LEDGER_FAILURE',
  'CUSTODY_UNAVAILABLE',
  'CHAIN_UNAVAILABLE',
  'CUSTODY_RAIL_MISSING',
  'CHAIN_RAIL_MISSING',
  'ENTITLEMENT_PORT_MISSING',
  'ENTITLEMENT_INSUFFICIENT',
  'ENTITLEMENT_UNIT_MISMATCH',
  'REWARD_PORT_MISSING',
  'REWARD_NOT_PERMITTED',
  'DELIVERY_EVIDENCE_MISSING',
  'DELIVERY_EXCEEDS_RESERVED',
  'DVP_LEG_FAILED',
  'RESERVATION_STATE_INVALID',
  'DUPLICATE_CLEARING_BLOCKED',
  'IMPLIED_COIN_CONVERSION_FORBIDDEN',
] as const;
export type AccessClearingFailureCode = (typeof ACCESS_CLEARING_FAILURE_CODES)[number];

export const ACCESS_POLICY_REFUSAL_CODES = [
  'JURISDICTION_FORBIDDEN',
  'ELIGIBILITY_DENIED',
  'TERMS_INCOMPLETE',
  'MECHANISM_NOT_PERMITTED',
  'CONSIDERATION_NOT_PERMITTED',
  'INSTRUMENT_NOT_TRADEABLE',
  'AVAILABILITY_WINDOW_CLOSED',
  'SERVICE_CLASS_UNSUPPORTED',
  'RIGHTS_TERMS_MISSING',
  'PROVENANCE_MISSING',
] as const;
export type AccessPolicyRefusalCode = (typeof ACCESS_POLICY_REFUSAL_CODES)[number];

export const REFUND_REASONS = [
  'BUYER_CANCELLED',
  'PROVIDER_CANCELLED',
  'RESERVATION_EXPIRED',
  'UNDELIVERED_REMAINDER',
  'DELIVERY_FAILED',
  'CLEARING_COMPENSATION',
] as const;
export type RefundReason = (typeof REFUND_REASONS)[number];

export const QUEUE_PRIORITY_CLASSES = ['CRITICAL_SERVICE', 'COMMITTED', 'STANDARD', 'BEST_EFFORT'] as const;
export type QueuePriorityClass = (typeof QUEUE_PRIORITY_CLASSES)[number];

/** Deterministic priority order. Lower index allocates first. Ties break by sequence. */
export const QUEUE_PRIORITY_ORDER: { readonly [K in QueuePriorityClass]: number } = Object.freeze({
  CRITICAL_SERVICE: 0,
  COMMITTED: 1,
  STANDARD: 2,
  BEST_EFFORT: 3,
});

export const DELIVERY_EVIDENCE_QUALITIES = ['FINALIZED', 'CONFLICTED', 'STALE', 'SELF_REPORT'] as const;
export type DeliveryEvidenceQuality = (typeof DELIVERY_EVIDENCE_QUALITIES)[number];

export const RFQ_STATES = ['OPEN', 'CLOSED', 'AWARDED', 'CANCELLED'] as const;
export type RfqState = (typeof RFQ_STATES)[number];

export const CAPACITY_OFFER_STATES = ['LISTED', 'PARTIALLY_TAKEN', 'EXHAUSTED', 'WITHDRAWN'] as const;
export type CapacityOfferState = (typeof CAPACITY_OFFER_STATES)[number];

export const ACCESS_FABRIC_EVIDENCE_KIND = 'sunrey-exchange-access-fabric' as const;

/**
 * Structural posture of the capacity access fabric. Every value is a typed
 * literal so a future edit that activates production fails typecheck, not just
 * review.
 */
export const ACCESS_FABRIC_POSTURE = Object.freeze({
  productionActivated: false as const,
  liveProviderConnected: false as const,
  mintsSunReyCoin: false as const,
  mintsMoonReyCoin: false as const,
  fixedSunReyMoonReyRatio: false as const,
  createsThirdCurrency: false as const,
  entitlementIsTransferableMoney: false as const,
  entitlementRedeemableForMoney: false as const,
  storesCompetingBalanceLedger: false as const,
  fiatSettlesOnCanonicalLedger: true as const,
  digitalAssetSettlesOnCustodyOrChain: true as const,
  correctionsAreCompensating: true as const,
  regulatoryCompatibilityIsAFilter: true as const,
});

export function accessFabricPosture(): typeof ACCESS_FABRIC_POSTURE {
  return ACCESS_FABRIC_POSTURE;
}

export function isMonetaryConsideration(kind: ConsiderationKind): kind is MonetaryConsiderationKind {
  return kind === 'FIAT' || kind === 'SUNREY_COIN' || kind === 'MOONREY_COIN';
}

export function isNonMonetaryConsideration(
  kind: ConsiderationKind,
): kind is NonMonetaryConsiderationKind {
  return kind === 'ACCESS_ENTITLEMENT' || kind === 'REWARD_CREDIT';
}
