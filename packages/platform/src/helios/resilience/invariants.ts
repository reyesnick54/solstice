/**
 * HELIOS H31 — machine-testable resilience invariants.
 */

export const HELIOS_RESILIENCE_INVARIANT_IDS = [
  'NO_NEGATIVE_AVAILABLE_CASH_FROM_RACE',
  'NO_FINANCIAL_EFFECT_WITHOUT_AUTHORIZED_OPERATION',
  'ONE_EXTERNAL_OPERATION_IDENTITY_ONE_EFFECT',
  'CUSTOMER_ASSETS_NEVER_CROSS_OWNERSHIP',
  'NO_PAPER_RESULT_CLASSIFIED_AS_LIVE',
  'NO_REPORT_GENERATION_CLASSIFIED_AS_FILING',
  'NO_UNKNOWN_CLASSIFIED_AS_ALLOWED',
  'NO_STALE_EVIDENCE_CLASSIFIED_AS_CURRENT',
  'NO_PROVIDER_ERROR_SILENTLY_SUCCESS',
  'ACCOUNTING_REMAINS_BALANCED',
  'PRINCIPAL_NOT_COUNTED_AS_PROFIT',
  'NO_FABRICATED_INTELLIGENCE_ON_PROVIDER_FAILURE',
  'NO_UNAUTHORIZED_FALLBACK_ON_MODEL_FAILURE',
  'NO_DUPLICATE_MONEY_MOVEMENT',
  'NO_CROSS_USER_DATA_LEAKAGE',
] as const;

export type HeliosResilienceInvariantId = (typeof HELIOS_RESILIENCE_INVARIANT_IDS)[number];

export type HeliosResilienceInvariantResult = {
  readonly invariantId: HeliosResilienceInvariantId;
  readonly held: boolean;
  readonly detail: string;
};

export function heldInvariant(
  invariantId: HeliosResilienceInvariantId,
  detail: string,
): HeliosResilienceInvariantResult {
  return Object.freeze({ invariantId, held: true, detail });
}

export function breachedInvariant(
  invariantId: HeliosResilienceInvariantId,
  detail: string,
): HeliosResilienceInvariantResult {
  return Object.freeze({ invariantId, held: false, detail });
}

export function allInvariantsHeld(results: readonly HeliosResilienceInvariantResult[]): boolean {
  return results.every((row) => row.held);
}

export function criticalInvariantBreaches(
  results: readonly HeliosResilienceInvariantResult[],
): readonly HeliosResilienceInvariantResult[] {
  return results.filter((row) => !row.held);
}

/** Default invariant bundle asserted across qualification scenarios. */
export function baselineResilienceInvariants(input: {
  readonly noDuplicateMoneyMovement: boolean;
  readonly noCrossUserLeakage: boolean;
  readonly noUnknownAsAllowed: boolean;
  readonly noProviderErrorAsSuccess: boolean;
  readonly noFabricatedIntelligence: boolean;
  readonly noUnauthorizedFallback: boolean;
  readonly customerIsolationHeld: boolean;
  readonly noNegativeCashFromRace: boolean;
  readonly accountingBalanced: boolean;
  readonly principalNotProfit: boolean;
  readonly oneOperationOneEffect: boolean;
  readonly noFinancialEffectWithoutAuthority: boolean;
  readonly noPaperAsLive: boolean;
  readonly noReportAsFiling: boolean;
  readonly noStaleEvidenceAsCurrent: boolean;
}): readonly HeliosResilienceInvariantResult[] {
  return Object.freeze([
    input.noNegativeCashFromRace
      ? heldInvariant('NO_NEGATIVE_AVAILABLE_CASH_FROM_RACE', 'available cash never negative from race')
      : breachedInvariant('NO_NEGATIVE_AVAILABLE_CASH_FROM_RACE', 'negative available cash observed'),
    input.noFinancialEffectWithoutAuthority
      ? heldInvariant('NO_FINANCIAL_EFFECT_WITHOUT_AUTHORIZED_OPERATION', 'no unauthorized financial effect')
      : breachedInvariant('NO_FINANCIAL_EFFECT_WITHOUT_AUTHORIZED_OPERATION', 'financial effect without authority'),
    input.oneOperationOneEffect
      ? heldInvariant('ONE_EXTERNAL_OPERATION_IDENTITY_ONE_EFFECT', 'operation identity idempotent')
      : breachedInvariant('ONE_EXTERNAL_OPERATION_IDENTITY_ONE_EFFECT', 'duplicate external effect'),
    input.customerIsolationHeld
      ? heldInvariant('CUSTOMER_ASSETS_NEVER_CROSS_OWNERSHIP', 'customer isolation held')
      : breachedInvariant('CUSTOMER_ASSETS_NEVER_CROSS_OWNERSHIP', 'cross-customer leakage'),
    input.noPaperAsLive
      ? heldInvariant('NO_PAPER_RESULT_CLASSIFIED_AS_LIVE', 'paper not classified as live')
      : breachedInvariant('NO_PAPER_RESULT_CLASSIFIED_AS_LIVE', 'paper misclassified as live'),
    input.noReportAsFiling
      ? heldInvariant('NO_REPORT_GENERATION_CLASSIFIED_AS_FILING', 'report not filing')
      : breachedInvariant('NO_REPORT_GENERATION_CLASSIFIED_AS_FILING', 'report misclassified as filing'),
    input.noUnknownAsAllowed
      ? heldInvariant('NO_UNKNOWN_CLASSIFIED_AS_ALLOWED', 'UNKNOWN not treated as ALLOWED')
      : breachedInvariant('NO_UNKNOWN_CLASSIFIED_AS_ALLOWED', 'UNKNOWN treated as ALLOWED'),
    input.noStaleEvidenceAsCurrent
      ? heldInvariant('NO_STALE_EVIDENCE_CLASSIFIED_AS_CURRENT', 'stale evidence not current')
      : breachedInvariant('NO_STALE_EVIDENCE_CLASSIFIED_AS_CURRENT', 'stale evidence treated as current'),
    input.noProviderErrorAsSuccess
      ? heldInvariant('NO_PROVIDER_ERROR_SILENTLY_SUCCESS', 'provider errors explicit')
      : breachedInvariant('NO_PROVIDER_ERROR_SILENTLY_SUCCESS', 'provider error converted to success'),
    input.accountingBalanced
      ? heldInvariant('ACCOUNTING_REMAINS_BALANCED', 'accounting balanced')
      : breachedInvariant('ACCOUNTING_REMAINS_BALANCED', 'accounting imbalance'),
    input.principalNotProfit
      ? heldInvariant('PRINCIPAL_NOT_COUNTED_AS_PROFIT', 'principal not profit')
      : breachedInvariant('PRINCIPAL_NOT_COUNTED_AS_PROFIT', 'principal counted as profit'),
    input.noFabricatedIntelligence
      ? heldInvariant('NO_FABRICATED_INTELLIGENCE_ON_PROVIDER_FAILURE', 'no fabricated intelligence')
      : breachedInvariant('NO_FABRICATED_INTELLIGENCE_ON_PROVIDER_FAILURE', 'fabricated intelligence on failure'),
    input.noUnauthorizedFallback
      ? heldInvariant('NO_UNAUTHORIZED_FALLBACK_ON_MODEL_FAILURE', 'no unauthorized model fallback')
      : breachedInvariant('NO_UNAUTHORIZED_FALLBACK_ON_MODEL_FAILURE', 'unauthorized model fallback'),
    input.noDuplicateMoneyMovement
      ? heldInvariant('NO_DUPLICATE_MONEY_MOVEMENT', 'no duplicate money movement')
      : breachedInvariant('NO_DUPLICATE_MONEY_MOVEMENT', 'duplicate money movement'),
    input.noCrossUserLeakage
      ? heldInvariant('NO_CROSS_USER_DATA_LEAKAGE', 'no cross-user data leakage')
      : breachedInvariant('NO_CROSS_USER_DATA_LEAKAGE', 'cross-user data leakage'),
  ]);
}
