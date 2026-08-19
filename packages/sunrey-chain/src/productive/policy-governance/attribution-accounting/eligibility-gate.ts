import type { ClaimType, ProductiveCategory } from '../../types.ts';
import {
  attributionFailure,
  isAttributionSensitiveCategory,
  isIndependentServiceCategory,
  type AttributionFailure,
  type AttributionReservationRequest,
  type AttributionResult,
  type ProductiveAttributionDecision,
  type ProductiveAttributionEntry,
} from './types.ts';
import { ProductiveAttributionBook } from './book.ts';

export type AttributionEligibilityInput = {
  readonly category: ProductiveCategory;
  readonly claimType: ClaimType;
  readonly independentlyEvidenced?: boolean;
  readonly attributionRequired?: boolean;
  readonly expectedPolicyVersion: number;
  readonly decision?: ProductiveAttributionDecision;
  readonly request?: AttributionReservationRequest;
  readonly book?: ProductiveAttributionBook;
};

export type AttributionEligibilityOk = {
  readonly ok: true;
  readonly reservation: ProductiveAttributionEntry;
  readonly remainingShare: bigint;
  readonly proceedsToProductiveValue: false;
};

/**
 * Attribution-sensitive routes must present a valid decision and reserve
 * share before any future Productive Value Function. This gate does not
 * calculate productive value.
 */
export function routeRequiresAttribution(input: {
  readonly category: ProductiveCategory;
  readonly independentlyEvidenced?: boolean;
  readonly attributionRequired?: boolean;
}): boolean {
  if (input.attributionRequired === false) {
    return false;
  }
  if (input.attributionRequired === true) {
    return true;
  }
  if (isIndependentServiceCategory(input.category) && input.independentlyEvidenced === true) {
    return true;
  }
  return isAttributionSensitiveCategory(input.category);
}

export function evaluateAttributionEligibility(
  input: AttributionEligibilityInput,
): AttributionResult<AttributionEligibilityOk> | AttributionFailure {
  if (!routeRequiresAttribution(input)) {
    return attributionFailure(
      'ATTRIBUTION_DECISION_REQUIRED',
      'caller asked for an attribution gate on a non-sensitive route',
    );
  }
  if (!input.decision || !input.request || !input.book) {
    return attributionFailure(
      'ATTRIBUTION_DECISION_REQUIRED',
      `category ${input.category} is attribution-sensitive and requires a ProductiveAttributionDecision`,
    );
  }
  if (!input.decision.policyAccepts) {
    return attributionFailure('ATTRIBUTION_DECISION_REQUIRED', 'attribution decision was not accepted by policy');
  }
  const reserved = input.book.reserve(input.request);
  if (!reserved.ok) {
    return reserved;
  }
  return {
    ok: true,
    value: {
      reservation: reserved.value,
      remainingShare: reserved.value.remainingShareAtCommit,
      proceedsToProductiveValue: false,
    },
    idempotentReplay: reserved.idempotentReplay,
  };
}

export function availableAttributionShare(
  book: ProductiveAttributionBook,
  economicEventId: string,
  maximum: bigint,
): bigint {
  return book.remainingShareForEvent(economicEventId, maximum);
}
