/**
 * Access card controls builder and validation.
 */

import type { UtcInstant } from '../../../domain/src/time.ts';
import type { AccessCategoryId } from '../domain/taxonomy.ts';
import { computeCardSpendingLimit, DEFAULT_ACCESS_CARD_BUFFER_POLICY } from './buffer-policy.ts';
import { allowedMccsForCategory } from './mcc-mapping.ts';
import type { AccessSettlementRailFailureCode } from './taxonomy.ts';
import type { AccessCardControls, AccessVirtualCardRequest, IssuerControlSupport } from './types.ts';

export function buildAccessCardControls(
  request: AccessVirtualCardRequest,
  support: IssuerControlSupport,
): AccessCardControls {
  const spendingLimit = computeCardSpendingLimit(
    request.maximumAmount,
    request.bufferPolicy ?? DEFAULT_ACCESS_CARD_BUFFER_POLICY,
  );

  const categoryMccs = allowedMccsForCategory(request.category);
  const mccRestriction =
    request.merchantCategoryRestriction ??
    (support.merchantCategory && categoryMccs.length > 0 ? categoryMccs : null);

  return Object.freeze({
    maximumAmountMinorUnits: spendingLimit,
    singleTransaction: support.singleTransaction,
    singleUse: support.singleUse ? request.singleUse : false,
    expiresAt: request.expiresAt,
    merchantId: support.merchantId ? (request.merchantRestriction ?? null) : null,
    allowedMerchantCategories:
      support.merchantCategory && mccRestriction && mccRestriction.length > 0
        ? Object.freeze([...mccRestriction])
        : null,
    blockedMerchantCategories: support.blockedMerchantCategories
      ? Object.freeze(['6011', '6012'])
      : Object.freeze([]),
    country: support.country ? (request.countryRestriction ?? null) : null,
    currency: request.currency,
    allowedMerchant:
      support.allowedMerchant && request.merchantRestriction ? request.merchantRestriction : null,
  });
}

export type ControlValidationInput = {
  readonly controls: AccessCardControls;
  readonly cardStatus: string;
  readonly merchantId: string;
  readonly merchantCategory: string;
  readonly country: string;
  readonly amountMinorUnits: bigint;
  readonly currency: string;
  readonly now: UtcInstant;
  readonly aggregateAuthorizedMinorUnits: bigint;
  readonly authorizationCount: number;
  readonly securityDepositAttempt?: boolean;
};

export type ControlValidationResult =
  | { readonly allowed: true }
  | { readonly allowed: false; readonly code: AccessSettlementRailFailureCode };

export function validateAccessCardControls(input: ControlValidationInput): ControlValidationResult {
  if (input.cardStatus === 'DISABLED' || input.cardStatus === 'CLOSED' || input.cardStatus === 'FAILED') {
    return { allowed: false, code: 'CARD_DISABLED' };
  }
  if (input.now >= input.controls.expiresAt) {
    return { allowed: false, code: 'CARD_EXPIRED' };
  }
  if (input.currency !== input.controls.currency) {
    return { allowed: false, code: 'AMOUNT_EXCEEDS_LIMIT' };
  }
  if (input.securityDepositAttempt) {
    return { allowed: false, code: 'SECURITY_DEPOSIT_NOT_FUNDED' };
  }
  if (input.controls.allowedMerchant !== null && input.merchantId !== input.controls.allowedMerchant) {
    return { allowed: false, code: 'MERCHANT_NOT_ALLOWED' };
  }
  if (input.controls.merchantId !== null && input.merchantId !== input.controls.merchantId) {
    return { allowed: false, code: 'MERCHANT_NOT_ALLOWED' };
  }
  if (
    input.controls.allowedMerchantCategories !== null &&
    !input.controls.allowedMerchantCategories.includes(input.merchantCategory)
  ) {
    return { allowed: false, code: 'MCC_NOT_ALLOWED' };
  }
  if (input.controls.blockedMerchantCategories.includes(input.merchantCategory)) {
    return { allowed: false, code: 'MCC_NOT_ALLOWED' };
  }
  if (input.controls.country !== null && input.country !== input.controls.country) {
    return { allowed: false, code: 'COUNTRY_NOT_ALLOWED' };
  }
  const nextAggregate = input.aggregateAuthorizedMinorUnits + input.amountMinorUnits;
  if (nextAggregate > input.controls.maximumAmountMinorUnits) {
    return {
      allowed: false,
      code: input.aggregateAuthorizedMinorUnits > 0n ? 'INCREMENTAL_AUTH_EXCEEDS_MAX' : 'AMOUNT_EXCEEDS_LIMIT',
    };
  }
  if (input.controls.singleTransaction && input.authorizationCount > 0) {
    return { allowed: false, code: 'CARD_SINGLE_USE_EXHAUSTED' };
  }
  if (input.controls.singleUse && input.authorizationCount > 0) {
    return { allowed: false, code: 'CARD_SINGLE_USE_EXHAUSTED' };
  }
  if (input.amountMinorUnits > input.controls.maximumAmountMinorUnits) {
    return { allowed: false, code: 'AMOUNT_EXCEEDS_LIMIT' };
  }
  return { allowed: true };
}

export function validateSecurityDepositConfiguration(
  request: AccessVirtualCardRequest,
): { readonly ok: true } | { readonly ok: false; readonly code: 'UNSUPPORTED_ACCESS_PAYMENT_CONFIGURATION' } {
  if (request.securityDepositRequired === true) {
    return { ok: false, code: 'UNSUPPORTED_ACCESS_PAYMENT_CONFIGURATION' };
  }
  return { ok: true };
}

export function controlsForCategory(
  category: AccessCategoryId,
  request: Omit<AccessVirtualCardRequest, 'category'>,
  support: IssuerControlSupport,
): AccessCardControls {
  return buildAccessCardControls({ ...request, category }, support);
}
