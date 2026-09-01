import type { PurchaseIntent } from './types.ts';

/**
 * Anonymized/pseudonymous intent view for merchants.
 *
 * Merchants receive only the minimum information necessary to make an offer.
 * They do NOT receive: full name, bank balance, HIN profile, health data,
 * social graph, or financial history.
 */
export type MerchantVisibleIntent = {
  readonly intentRef: string;
  readonly category: string;
  readonly productOrService: string;
  readonly quantity: number;
  readonly specifications: Readonly<Record<string, string>>;
  readonly regionCode: string;
  readonly countryCode: string;
  readonly postalPrefix: string | null;
  readonly deliveryMethod: string;
  readonly deliveryWindowStart: string | null;
  readonly deliveryWindowEnd: string | null;
  readonly budgetMinorUnits: string | null;
  readonly budgetCurrency: string | null;
  readonly desiredPurchaseTime: string | null;
  readonly preferences: Readonly<Record<string, unknown>>;
  readonly expiresAt: string;
};

/** Fields explicitly excluded from merchant view. */
export const MERCHANT_PRIVACY_EXCLUSIONS = Object.freeze([
  'userId',
  'fullName',
  'email',
  'phone',
  'bankBalance',
  'hinProfile',
  'healthData',
  'socialGraph',
  'financialHistory',
  'paymentCredentials',
  'exactAddress',
]);

/**
 * Project a purchase intent to the merchant-visible boundary.
 * userId is replaced with an opaque intentRef.
 */
export function toMerchantVisibleIntent(intent: PurchaseIntent): MerchantVisibleIntent {
  const policy = intent.privacyPolicy;
  return Object.freeze({
    intentRef: intent.intentId,
    category: intent.required.category,
    productOrService: intent.required.productOrService,
    quantity: intent.required.quantity,
    specifications: Object.freeze({ ...intent.specifications }),
    regionCode: intent.locationConstraint.regionCode,
    countryCode: intent.locationConstraint.countryCode,
    postalPrefix: policy.sharePostalPrefix ? (intent.locationConstraint.postalPrefix ?? null) : null,
    deliveryMethod: intent.deliveryConstraint.method,
    deliveryWindowStart: policy.shareDeliveryWindow ? (intent.deliveryConstraint.earliestAt ?? null) : null,
    deliveryWindowEnd: policy.shareDeliveryWindow ? (intent.deliveryConstraint.latestAt ?? null) : null,
    budgetMinorUnits:
      policy.shareBudgetRange && intent.budget ? intent.budget.minorUnits.toString() : null,
    budgetCurrency: policy.shareBudgetRange && intent.budget ? intent.budget.currency : null,
    desiredPurchaseTime: intent.desiredPurchaseTime,
    preferences: Object.freeze(sanitizePreferences(intent.preferences)),
    expiresAt: intent.expiresAt,
  });
}

function sanitizePreferences(preferences: PurchaseIntent['preferences']): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (preferences.deliverySpeed) out.deliverySpeed = preferences.deliverySpeed;
  if (preferences.warrantyMinimumMonths !== undefined) out.warrantyMinimumMonths = preferences.warrantyMinimumMonths;
  if (preferences.brandPreferences) out.brandPreferences = [...preferences.brandPreferences];
  if (preferences.ecoFriendly !== undefined) out.ecoFriendly = preferences.ecoFriendly;
  if (preferences.localMerchantPreferred !== undefined) out.localMerchantPreferred = preferences.localMerchantPreferred;
  return out;
}

/** Assert a payload does not leak excluded fields to merchants. */
export function assertMerchantPrivacyBoundary(payload: Record<string, unknown>): void {
  for (const field of MERCHANT_PRIVACY_EXCLUSIONS) {
    if (field in payload) {
      throw new TypeError(`merchant view must not include ${field}`);
    }
  }
}
