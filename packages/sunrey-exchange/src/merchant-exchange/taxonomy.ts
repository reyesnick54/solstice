/** Purchase intent lifecycle states. */
export const PURCHASE_INTENT_STATUSES = [
  'DRAFT',
  'SUBMITTED',
  'VERIFIED',
  'MATCHING',
  'OPEN_FOR_OFFERS',
  'OFFER_SELECTION',
  'AUTHORIZED',
  'FULFILLMENT',
  'SETTLED',
  'CANCELLED',
  'EXPIRED',
  'FAILED',
] as const;
export type PurchaseIntentStatus = (typeof PURCHASE_INTENT_STATUSES)[number];

/** Merchant offer lifecycle states. */
export const MERCHANT_OFFER_STATUSES = [
  'DRAFT',
  'SUBMITTED',
  'ACTIVE',
  'WITHDRAWN',
  'EXPIRED',
  'SELECTED',
  'REJECTED',
] as const;
export type MerchantOfferStatus = (typeof MERCHANT_OFFER_STATUSES)[number];

/** Post-purchase fulfillment states. */
export const FULFILLMENT_STATUSES = [
  'ORDERED',
  'ACCEPTED_BY_MERCHANT',
  'PROCESSING',
  'SHIPPED',
  'SERVICE_SCHEDULED',
  'DELIVERED',
  'COMPLETED',
  'DISPUTED',
  'REFUNDED',
] as const;
export type FulfillmentStatus = (typeof FULFILLMENT_STATUSES)[number];

/** Purchase authorization / payment boundary states. */
export const PURCHASE_AUTHORIZATION_STATUSES = [
  'PENDING',
  'AWAITING_USER_AUTHORIZATION',
  'AUTHORIZED',
  'PAYMENT_SUBMITTED',
  'PAYMENT_UNAVAILABLE',
  'FAILED',
] as const;
export type PurchaseAuthorizationStatus = (typeof PURCHASE_AUTHORIZATION_STATUSES)[number];

/** Settlement boundary states — separate from offer acceptance. */
export const MERCHANT_SETTLEMENT_STATUSES = [
  'NOT_STARTED',
  'PENDING_PAYMENT',
  'PAYMENT_CONFIRMED',
  'SETTLEMENT_QUEUED',
  'SETTLED',
  'FAILED',
] as const;
export type MerchantSettlementStatus = (typeof MERCHANT_SETTLEMENT_STATUSES)[number];

/** Intent verification states. */
export const INTENT_VERIFICATION_STATES = ['UNVERIFIED', 'VERIFIED', 'REJECTED'] as const;
export type IntentVerificationState = (typeof INTENT_VERIFICATION_STATES)[number];

/** Supported purchase categories for merchant matching. */
export const PURCHASE_CATEGORIES = [
  'ELECTRONICS',
  'HOME_GOODS',
  'GROCERIES',
  'APPAREL',
  'SERVICES',
  'HEALTH_WELLNESS',
  'TRAVEL_EXPERIENCE',
  'OTHER',
] as const;
export type PurchaseCategory = (typeof PURCHASE_CATEGORIES)[number];

/** Merchant exchange posture. */
export const MERCHANT_EXCHANGE_POSTURE = {
  simulationOnly: true,
  liveMerchantSupply: false,
  livePaymentExecution: false,
  liveFulfillmentIntegration: false,
  sealedOffers: true,
  autoAcceptForbidden: true,
} as const;
