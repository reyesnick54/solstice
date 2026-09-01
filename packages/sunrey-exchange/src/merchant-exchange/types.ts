import type { UtcInstant } from '../../../domain/src/time.ts';
import type { Money } from '../../../money/src/money.ts';
import type {
  FulfillmentStatus,
  IntentVerificationState,
  MerchantOfferStatus,
  MerchantSettlementStatus,
  PurchaseAuthorizationStatus,
  PurchaseCategory,
  PurchaseIntentStatus,
} from './taxonomy.ts';
import type {
  MerchantExchangeMerchantId,
  MerchantOfferId,
  MerchantPurchaseId,
  PurchaseIntentId,
} from './ids.ts';

/** Required criteria the merchant must satisfy to bid. */
export type PurchaseIntentRequiredCriteria = {
  readonly category: PurchaseCategory;
  readonly productOrService: string;
  readonly quantity: number;
  readonly currency: string;
};

/** Optional user preferences — not binding on merchants. */
export type PurchaseIntentPreferences = {
  readonly deliverySpeed?: 'STANDARD' | 'EXPRESS' | 'FLEXIBLE';
  readonly warrantyMinimumMonths?: number;
  readonly brandPreferences?: readonly string[];
  readonly ecoFriendly?: boolean;
  readonly localMerchantPreferred?: boolean;
};

/** Location constraint without exposing full address. */
export type LocationConstraint = {
  readonly regionCode: string;
  readonly countryCode: string;
  readonly postalPrefix?: string;
};

/** Delivery constraint. */
export type DeliveryConstraint = {
  readonly method: 'PICKUP' | 'DELIVERY' | 'DIGITAL' | 'SERVICE_ON_SITE';
  readonly earliestAt?: UtcInstant;
  readonly latestAt?: UtcInstant;
};

/** Privacy policy reference for intent sharing. */
export type IntentPrivacyPolicy = {
  readonly sharePostalPrefix: boolean;
  readonly shareDeliveryWindow: boolean;
  readonly shareBudgetRange: boolean;
  readonly merchantVisibility: 'SEALED' | 'AGGREGATE_ONLY';
};

/**
 * Canonical PurchaseIntent domain object.
 * Raw user profile data is never embedded — only intent-scoped fields.
 */
export type PurchaseIntent = {
  readonly intentId: PurchaseIntentId;
  readonly userId: string;
  readonly required: PurchaseIntentRequiredCriteria;
  readonly specifications: Readonly<Record<string, string>>;
  readonly locationConstraint: LocationConstraint;
  readonly deliveryConstraint: DeliveryConstraint;
  readonly budget: Money | null;
  readonly desiredPurchaseTime: UtcInstant | null;
  readonly preferences: PurchaseIntentPreferences;
  readonly verificationState: IntentVerificationState;
  readonly privacyPolicy: IntentPrivacyPolicy;
  readonly expiresAt: UtcInstant;
  readonly status: PurchaseIntentStatus;
  readonly createdAt: UtcInstant;
  readonly updatedAt: UtcInstant;
  readonly version: number;
};

/** SunRey benefit attached to an offer — reference only, no invented amounts. */
export type SunReyBenefitReference = {
  readonly benefitKind: 'REWARD_CREDIT' | 'ACCESS_ENTITLEMENT' | 'NONE';
  readonly benefitReference: string | null;
  readonly description: string | null;
};

/** Canonical MerchantOffer — immutable after submission. */
export type MerchantOffer = {
  readonly offerId: MerchantOfferId;
  readonly intentId: PurchaseIntentId;
  readonly merchantId: MerchantExchangeMerchantId;
  readonly price: Money;
  readonly discountMinorUnits: bigint;
  readonly deliveryTerms: string;
  readonly availability: string;
  readonly warranty: string | null;
  readonly serviceTerms: string | null;
  readonly incentives: readonly string[];
  readonly sunReyBenefit: SunReyBenefitReference;
  readonly expiresAt: UtcInstant;
  readonly submittedAt: UtcInstant;
  readonly status: MerchantOfferStatus;
  readonly version: number;
  readonly contentHash: string;
};

/** Frozen accepted offer snapshot — preserved at selection time. */
export type AcceptedOfferSnapshot = {
  readonly offerId: MerchantOfferId;
  readonly offerVersion: number;
  readonly contentHash: string;
  readonly offer: MerchantOffer;
  readonly acceptedAt: UtcInstant;
  readonly authorizationContext: string;
};

/** Normalized offer for user comparison. */
export type NormalizedOfferView = {
  readonly offerId: MerchantOfferId;
  readonly merchantId: MerchantExchangeMerchantId;
  readonly totalPriceMinorUnits: bigint;
  readonly currency: string;
  readonly effectivePriceMinorUnits: bigint;
  readonly deliveryScore: number;
  readonly warrantyScore: number;
  readonly availabilityScore: number;
  readonly sunReyBenefitScore: number;
  readonly preferenceMatchScore: number;
  readonly deliveryTerms: string;
  readonly availability: string;
  readonly warranty: string | null;
  readonly sunReyBenefit: SunReyBenefitReference;
  readonly rankScore: number;
  readonly rankPosition: number;
};

/** Ranked offer list for user selection. */
export type RankedOfferList = {
  readonly intentId: PurchaseIntentId;
  readonly offers: readonly NormalizedOfferView[];
  readonly rankedAt: UtcInstant;
  readonly rankingFactors: readonly string[];
};

/** Purchase record after offer selection. */
export type MerchantPurchase = {
  readonly purchaseId: MerchantPurchaseId;
  readonly intentId: PurchaseIntentId;
  readonly userId: string;
  readonly acceptedOffer: AcceptedOfferSnapshot;
  readonly authorizationStatus: PurchaseAuthorizationStatus;
  readonly fulfillmentStatus: FulfillmentStatus | null;
  readonly settlementStatus: MerchantSettlementStatus;
  readonly paymentReference: string | null;
  readonly createdAt: UtcInstant;
  readonly updatedAt: UtcInstant;
};

/** Merchant registry record — not a fake merchant; must be registered. */
export type MerchantExchangeProfile = {
  readonly merchantId: MerchantExchangeMerchantId;
  readonly businessIdentityId: string;
  readonly displayName: string;
  readonly status: 'PENDING' | 'ACTIVE' | 'SUSPENDED' | 'CLOSED';
  readonly supportedCategories: readonly PurchaseCategory[];
  readonly supportedRegions: readonly string[];
  readonly verificationState: 'UNVERIFIED' | 'PROVIDER_VERIFIED' | 'REJECTED';
  readonly complianceRestricted: boolean;
  readonly offerPermissions: readonly ('SUBMIT_OFFER' | 'WITHDRAW_OFFER')[];
};
