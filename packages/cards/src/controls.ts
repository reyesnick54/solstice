import { Money } from '../../money/src/money.ts';

export type CardControls = {
  readonly frozen: boolean;
  readonly transactionAmountLimitMinor: bigint | null;
  readonly dailyAmountLimitMinor: bigint | null;
  readonly blockedMerchantCategories: readonly string[];
  readonly allowedMerchantCategories: readonly string[] | null;
  readonly blockedCountries: readonly string[];
  readonly allowedCountries: readonly string[] | null;
  readonly ecommerceEnabled: boolean;
  readonly cashAtmEnabled: boolean;
  readonly contactlessEnabled: boolean;
};

export const DEFAULT_CARD_CONTROLS: CardControls = Object.freeze({
  frozen: false,
  transactionAmountLimitMinor: null,
  dailyAmountLimitMinor: null,
  blockedMerchantCategories: Object.freeze([]),
  allowedMerchantCategories: null,
  blockedCountries: Object.freeze([]),
  allowedCountries: null,
  ecommerceEnabled: true,
  cashAtmEnabled: false,
  contactlessEnabled: true,
});

export type ControlDecision =
  | { readonly outcome: 'ALLOW' }
  | { readonly outcome: 'DECLINE'; readonly reason: ControlDeclineReason };

export type ControlDeclineReason =
  | 'CARD_FROZEN'
  | 'MERCHANT_CATEGORY_BLOCKED'
  | 'COUNTRY_BLOCKED'
  | 'AMOUNT_LIMIT'
  | 'VELOCITY_LIMIT'
  | 'ECOMMERCE_DISABLED'
  | 'CASH_ATM_DISABLED';

export type ControlEvaluationInput = {
  readonly controls: CardControls;
  readonly cardStatus: string;
  readonly amount: Money;
  readonly merchantCategory: string;
  readonly country: string;
  readonly ecommerce: boolean;
  readonly cashAtm: boolean;
  readonly dailySpentMinor: bigint;
};

/**
 * Customer-configurable controls. Policy and hard regulatory blocks
 * always outrank these preferences and are evaluated by the Kernel.
 */
export function evaluateCardControls(input: ControlEvaluationInput): ControlDecision {
  if (input.cardStatus === 'FROZEN' || input.controls.frozen) {
    return { outcome: 'DECLINE', reason: 'CARD_FROZEN' };
  }
  if (input.cashAtm && !input.controls.cashAtmEnabled) {
    return { outcome: 'DECLINE', reason: 'CASH_ATM_DISABLED' };
  }
  if (input.ecommerce && !input.controls.ecommerceEnabled) {
    return { outcome: 'DECLINE', reason: 'ECOMMERCE_DISABLED' };
  }
  if (input.controls.blockedMerchantCategories.includes(input.merchantCategory)) {
    return { outcome: 'DECLINE', reason: 'MERCHANT_CATEGORY_BLOCKED' };
  }
  if (
    input.controls.allowedMerchantCategories !== null &&
    !input.controls.allowedMerchantCategories.includes(input.merchantCategory)
  ) {
    return { outcome: 'DECLINE', reason: 'MERCHANT_CATEGORY_BLOCKED' };
  }
  if (input.controls.blockedCountries.includes(input.country)) {
    return { outcome: 'DECLINE', reason: 'COUNTRY_BLOCKED' };
  }
  if (input.controls.allowedCountries !== null && !input.controls.allowedCountries.includes(input.country)) {
    return { outcome: 'DECLINE', reason: 'COUNTRY_BLOCKED' };
  }
  if (
    input.controls.transactionAmountLimitMinor !== null &&
    input.amount.minorUnits > input.controls.transactionAmountLimitMinor
  ) {
    return { outcome: 'DECLINE', reason: 'AMOUNT_LIMIT' };
  }
  if (input.controls.dailyAmountLimitMinor !== null) {
    const nextDaily = input.dailySpentMinor + input.amount.minorUnits;
    if (nextDaily > input.controls.dailyAmountLimitMinor) {
      return { outcome: 'DECLINE', reason: 'VELOCITY_LIMIT' };
    }
  }
  return { outcome: 'ALLOW' };
}

export function mergeCardControls(base: CardControls, patch: Partial<CardControls>): CardControls {
  return Object.freeze({
    frozen: patch.frozen ?? base.frozen,
    transactionAmountLimitMinor: patch.transactionAmountLimitMinor ?? base.transactionAmountLimitMinor,
    dailyAmountLimitMinor: patch.dailyAmountLimitMinor ?? base.dailyAmountLimitMinor,
    blockedMerchantCategories: Object.freeze([
      ...(patch.blockedMerchantCategories ?? base.blockedMerchantCategories),
    ]),
    allowedMerchantCategories:
      patch.allowedMerchantCategories === undefined
        ? base.allowedMerchantCategories
        : patch.allowedMerchantCategories === null
          ? null
          : Object.freeze([...patch.allowedMerchantCategories]),
    blockedCountries: Object.freeze([...(patch.blockedCountries ?? base.blockedCountries)]),
    allowedCountries:
      patch.allowedCountries === undefined
        ? base.allowedCountries
        : patch.allowedCountries === null
          ? null
          : Object.freeze([...patch.allowedCountries]),
    ecommerceEnabled: patch.ecommerceEnabled ?? base.ecommerceEnabled,
    cashAtmEnabled: patch.cashAtmEnabled ?? base.cashAtmEnabled,
    contactlessEnabled: patch.contactlessEnabled ?? base.contactlessEnabled,
  });
}
