import type { MerchantPurchase, PurchaseIntent } from './types.ts';

/**
 * SunRey economic attribution for Merchant Exchange events.
 *
 * Does NOT invent token rewards or issuance amounts.
 * Connects to existing documented mechanisms only.
 */
export type EconomicAttributionEvent = {
  readonly eventKind:
    | 'PURCHASE_INTENT_VERIFIED'
    | 'OFFER_SELECTED'
    | 'PURCHASE_AUTHORIZED'
    | 'PURCHASE_COMPLETED'
    | 'SETTLEMENT_COMPLETED';
  readonly intentId: string;
  readonly purchaseId: string | null;
  readonly merchantId: string | null;
  readonly attributionTargets: readonly EconomicAttributionTarget[];
  readonly recordedAt: string;
};

export type EconomicAttributionTarget = {
  readonly system: 'HIN' | 'ACCESS_ECONOMY' | 'MOONREY_REPRESENTATION' | 'REWARD_CREDIT';
  readonly eligible: boolean;
  readonly reason: string;
  readonly referenceOnly: true;
};

export type AttributionInput = {
  readonly intent: PurchaseIntent;
  readonly purchase: MerchantPurchase | null;
  readonly eventKind: EconomicAttributionEvent['eventKind'];
  readonly now: string;
};

/**
 * Determine which existing economic systems may receive attribution signals.
 * No amounts are invented — only eligibility flags and references.
 */
export function computeEconomicAttribution(input: AttributionInput): EconomicAttributionEvent {
  const targets: EconomicAttributionTarget[] = [];

  // HIN: purchase intent does not automatically create HIN contribution
  targets.push(
    Object.freeze({
      system: 'HIN',
      eligible: false,
      reason: 'merchant_purchase_is_not_hin_contribution',
      referenceOnly: true,
    }),
  );

  // Access Economy: eligible if purchase includes access entitlement benefit
  const hasAccessBenefit =
    input.purchase?.acceptedOffer.offer.sunReyBenefit.benefitKind === 'ACCESS_ENTITLEMENT';
  targets.push(
    Object.freeze({
      system: 'ACCESS_ECONOMY',
      eligible: hasAccessBenefit ?? false,
      reason: hasAccessBenefit
        ? 'offer_includes_access_entitlement_reference'
        : 'no_access_entitlement_in_offer',
      referenceOnly: true,
    }),
  );

  // MoonRey: merchant exchange does not mint MoonRey
  targets.push(
    Object.freeze({
      system: 'MOONREY_REPRESENTATION',
      eligible: false,
      reason: 'merchant_exchange_does_not_mint_moonrey',
      referenceOnly: true,
    }),
  );

  // Reward credit: eligible if offer references reward credit (consumption at owning port)
  const hasRewardCredit =
    input.purchase?.acceptedOffer.offer.sunReyBenefit.benefitKind === 'REWARD_CREDIT';
  targets.push(
    Object.freeze({
      system: 'REWARD_CREDIT',
      eligible: hasRewardCredit ?? false,
      reason: hasRewardCredit
        ? 'offer_references_reward_credit_at_owning_port'
        : 'no_reward_credit_in_offer',
      referenceOnly: true,
    }),
  );

  return Object.freeze({
    eventKind: input.eventKind,
    intentId: input.intent.intentId,
    purchaseId: input.purchase?.purchaseId ?? null,
    merchantId: input.purchase?.acceptedOffer.offer.merchantId ?? null,
    attributionTargets: Object.freeze(targets),
    recordedAt: input.now,
  });
}
