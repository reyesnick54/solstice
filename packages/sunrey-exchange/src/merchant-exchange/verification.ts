import type { UtcInstant } from '../../../domain/src/time.ts';
import { Money } from '../../../money/src/money.ts';
import type { PurchaseIntent, PurchaseIntentRequiredCriteria } from './types.ts';
import type { PurchaseCategory } from './taxonomy.ts';

export type IntentVerificationInput = {
  readonly intent: PurchaseIntent;
  readonly authenticatedUserId: string;
  readonly supportedCategories: readonly PurchaseCategory[];
  readonly supportedRegions: readonly string[];
  readonly now: UtcInstant;
  readonly fundingReady?: boolean;
  readonly rateLimitClear: boolean;
  readonly fraudClear: boolean;
};

export type IntentVerificationResult = {
  readonly verified: boolean;
  readonly reasons: readonly string[];
};

/**
 * Verify a purchase intent without requiring financial pre-authorization.
 * Reduces spam/fraud while keeping the bar reasonable.
 */
export function verifyPurchaseIntent(input: IntentVerificationInput): IntentVerificationResult {
  const reasons: string[] = [];
  const { intent } = input;

  if (input.authenticatedUserId !== intent.userId) {
    return reject(['USER_NOT_AUTHENTICATED']);
  }
  if (!validateRequiredCriteria(intent.required)) {
    return reject(['INVALID_REQUIRED_CRITERIA']);
  }
  if (!input.supportedCategories.includes(intent.required.category)) {
    return reject(['UNSUPPORTED_CATEGORY']);
  }
  if (!input.supportedRegions.includes(intent.locationConstraint.countryCode)) {
    return reject(['UNSUPPORTED_GEOGRAPHY']);
  }
  if (intent.expiresAt <= input.now) {
    return reject(['INTENT_EXPIRED']);
  }
  if (!input.rateLimitClear) {
    return reject(['RATE_LIMIT_EXCEEDED']);
  }
  if (!input.fraudClear) {
    return reject(['FRAUD_SIGNAL']);
  }
  if (intent.budget !== null && intent.budget.minorUnits <= 0n) {
    return reject(['INVALID_BUDGET']);
  }

  reasons.push('AUTHENTICATED');
  reasons.push('VALID_REQUEST');
  reasons.push('FEASIBLE_GEOGRAPHY');
  reasons.push('SUPPORTED_CATEGORY');
  reasons.push('NOT_EXPIRED');
  if (input.fundingReady) {
    reasons.push('FUNDING_READY');
  }
  return Object.freeze({ verified: true, reasons: Object.freeze(reasons) });
}

function validateRequiredCriteria(required: PurchaseIntentRequiredCriteria): boolean {
  if (!required.productOrService.trim()) return false;
  if (required.quantity <= 0) return false;
  if (!required.currency || required.currency.length !== 3) return false;
  try {
    Money.zero(required.currency);
    return true;
  } catch {
    return false;
  }
}

function reject(reasons: readonly string[]): IntentVerificationResult {
  return Object.freeze({ verified: false, reasons: Object.freeze([...reasons]) });
}
