// @ts-nocheck
export {
  asMerchantExchangeMerchantId,
  asMerchantOfferId,
  asMerchantPurchaseId,
  asPurchaseIntentId,
  newMerchantOfferId,
  newMerchantPurchaseId,
  newPurchaseIntentId,
  type MerchantExchangeMerchantId,
  type MerchantOfferId,
  type MerchantPurchaseId,
  type PurchaseIntentId,
} from './ids.ts';

export {
  FULFILLMENT_STATUSES,
  INTENT_VERIFICATION_STATES,
  MERCHANT_EXCHANGE_POSTURE,
  MERCHANT_OFFER_STATUSES,
  MERCHANT_SETTLEMENT_STATUSES,
  PURCHASE_AUTHORIZATION_STATUSES,
  PURCHASE_CATEGORIES,
  PURCHASE_INTENT_STATUSES,
  type FulfillmentStatus,
  type IntentVerificationState,
  type MerchantOfferStatus,
  type MerchantSettlementStatus,
  type PurchaseAuthorizationStatus,
  type PurchaseCategory,
  type PurchaseIntentStatus,
} from './taxonomy.ts';

export type {
  AcceptedOfferSnapshot,
  DeliveryConstraint,
  IntentPrivacyPolicy,
  LocationConstraint,
  MerchantExchangeProfile,
  MerchantOffer,
  MerchantPurchase,
  MerchantVisibleIntent,
  NormalizedOfferView,
  PurchaseIntent,
  PurchaseIntentPreferences,
  PurchaseIntentRequiredCriteria,
  RankedOfferList,
  SunReyBenefitReference,
} from './types.ts';

export {
  ALLOWED_INTENT_TRANSITIONS,
  assertIntentTransition,
  canTransitionIntent,
  intentAcceptsOffers,
  intentAcceptsSelection,
  isTerminalIntentStatus,
} from './state-machine.ts';

export { verifyPurchaseIntent } from './verification.ts';
export {
  assertMerchantPrivacyBoundary,
  MERCHANT_PRIVACY_EXCLUSIONS,
  toMerchantVisibleIntent,
  type MerchantVisibleIntent,
} from './privacy.ts';
export {
  evaluateMerchantEligibility,
  filterEligibleMerchants,
  merchantSupportsCategory,
} from './eligibility.ts';
export {
  computeOfferContentHash,
  parseOfferPrice,
  validateMerchantOffer,
  verifyOfferImmutability,
} from './validation.ts';
export {
  assertSealedOfferBoundary,
  merchantOfferVisibility,
  OFFER_VISIBILITY_RULES,
} from './visibility.ts';
export { normalizeOffers } from './normalization.ts';
export {
  DEFAULT_RANKING_WEIGHTS,
  rankOffers,
  validateRankingExplanation,
  type RankingWeights,
} from './ranking.ts';
export {
  ALLOWED_FULFILLMENT_TRANSITIONS,
  assertFulfillmentTransition,
  canTransitionFulfillment,
  isTerminalFulfillment,
} from './fulfillment.ts';
export {
  evaluateSettlementBoundary,
  mapPaymentBoundary,
  nextSettlementStatus,
} from './settlement.ts';
export { computeEconomicAttribution, type EconomicAttributionEvent } from './attribution.ts';
export {
  checkMerchantOfferRate,
  checkSelfDealing,
  checkUserIntentRate,
  checkWithdrawRepost,
  DEFAULT_ABUSE_CONTROLS,
} from './abuse.ts';
export {
  AUDIT_EVENT_MAP,
  emitMerchantExchangeEvent,
  MERCHANT_EXCHANGE_EVENT_TYPES,
} from './events.ts';
export { MerchantExchangeStore } from './store.ts';
export type { MerchantPaymentPort, MerchantRegistryPort, PaymentAuthorizationResult } from './ports.ts';
export { SimulatedMerchantPaymentPort } from './ports.ts';
export {
  MerchantExchangeService,
  type CreateIntentInput,
  type MerchantExchangeOutcome,
  type SelectOfferInput,
  type SubmitOfferInput,
} from './service.ts';
export {
  createMerchantExchangeSandbox,
  InMemoryMerchantRegistry,
  SANDBOX_MERCHANT_A,
  SANDBOX_MERCHANT_B,
  SANDBOX_MERCHANT_GB,
  SANDBOX_MERCHANT_SUSPENDED,
  SANDBOX_MERCHANT_UNVERIFIED,
  sandboxMerchants,
} from './sandbox.ts';
