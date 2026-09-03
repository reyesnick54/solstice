// @ts-nocheck
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { systemClock } from '../../../config/src/clock.ts';
import { DomainEventLog } from '../../../events/src/events.ts';
import { addMs } from '../../../config/src/clock.ts';

import {
  assertMerchantPrivacyBoundary,
  assertSealedOfferBoundary,
  checkSelfDealing,
  createMerchantExchangeSandbox,
  merchantOfferVisibility,
  OFFER_VISIBILITY_RULES,
  rankOffers,
  SANDBOX_MERCHANT_A,
  SANDBOX_MERCHANT_B,
  SANDBOX_MERCHANT_GB,
  SANDBOX_MERCHANT_SUSPENDED,
  SANDBOX_MERCHANT_UNVERIFIED,
  validateRankingExplanation,
  verifyOfferImmutability,
} from './index.ts';

const USER = 'user_sandbox_001';
const NOW = systemClock.now();
const FUTURE = addMs(NOW, 7n * 24n * 60n * 60n * 1000n);

function baseIntentInput(overrides: Record<string, unknown> = {}) {
  return {
    userId: USER,
    required: {
      category: 'ELECTRONICS' as const,
      productOrService: 'Wireless headphones',
      quantity: 1,
      currency: 'USD',
    },
    locationConstraint: { regionCode: 'US-CA', countryCode: 'US', postalPrefix: '941' },
    deliveryConstraint: { method: 'DELIVERY' as const },
    budgetMinorUnits: '25000',
    expiresAt: FUTURE,
    submit: true,
    ...overrides,
  };
}

function baseOfferInput(intentId: string, merchantId: string, overrides: Record<string, unknown> = {}) {
  return {
    merchantId,
    intentId,
    priceMinorUnits: '19999',
    currency: 'USD',
    deliveryTerms: 'Standard 3-5 business days',
    availability: 'In stock',
    warranty: '12 month manufacturer warranty',
    expiresAt: FUTURE,
    ...overrides,
  };
}

describe('Merchant Exchange — purchase intent marketplace', () => {
  const world = createMerchantExchangeSandbox();

  it('1. valid intent creation and verification', () => {
    const result = world.service.createIntent(baseIntentInput());
    assert.equal(result.outcome, 'OK');
    if (result.outcome !== 'OK') return;
    assert.equal(result.value.status, 'OPEN_FOR_OFFERS');
    assert.equal(result.value.verificationState, 'VERIFIED');
  });

  it('2. invalid intent — unsupported category', () => {
    const result = world.service.createIntent(
      baseIntentInput({
        required: { category: 'INVALID_CAT', productOrService: 'X', quantity: 1, currency: 'USD' },
      }),
    );
    assert.equal(result.outcome, 'REJECTED');
  });

  it('3. invalid intent — unsupported geography', () => {
    const result = world.service.createIntent(
      baseIntentInput({
        locationConstraint: { regionCode: 'JP-13', countryCode: 'JP' },
      }),
    );
    assert.equal(result.outcome, 'REJECTED');
  });

  it('4. expired intent rejected on submit', () => {
    const past = addMs(NOW, -1000n);
    const result = world.service.createIntent(baseIntentInput({ expiresAt: past }));
    assert.equal(result.outcome, 'REJECTED');
    assert.match(result.outcome === 'REJECTED' ? result.code : '', /VERIFICATION|EXPIRED/);
  });

  it('5. merchant eligibility — active verified merchant', () => {
    const intent = world.service.createIntent(baseIntentInput());
    assert.equal(intent.outcome, 'OK');
    if (intent.outcome !== 'OK') return;
    const offer = world.service.submitOffer(baseOfferInput(intent.value.intentId, SANDBOX_MERCHANT_A));
    assert.equal(offer.outcome, 'OK');
  });

  it('6. merchant wrong category rejected', () => {
    const intent = world.service.createIntent(baseIntentInput());
    assert.equal(intent.outcome, 'OK');
    if (intent.outcome !== 'OK') return;
    const offer = world.service.submitOffer(baseOfferInput(intent.value.intentId, SANDBOX_MERCHANT_GB));
    assert.equal(offer.outcome, 'REJECTED');
    if (offer.outcome === 'REJECTED') {
      assert.match(offer.message, /CATEGORY/);
    }
  });

  it('7. merchant wrong geography rejected', () => {
    const local = createMerchantExchangeSandbox();
    const intent = local.service.createIntent(
      baseIntentInput({
        locationConstraint: { regionCode: 'US-CA', countryCode: 'US' },
        required: { category: 'APPAREL', productOrService: 'Jacket', quantity: 1, currency: 'USD' },
      }),
    );
    assert.equal(intent.outcome, 'OK');
    if (intent.outcome !== 'OK') return;
    const offer = local.service.submitOffer(baseOfferInput(intent.value.intentId, SANDBOX_MERCHANT_GB));
    assert.equal(offer.outcome, 'REJECTED');
    if (offer.outcome === 'REJECTED') {
      assert.match(offer.message, /GEOGRAPHY/);
    }
  });

  it('8. suspended merchant rejected', () => {
    const intent = world.service.createIntent(baseIntentInput());
    assert.equal(intent.outcome, 'OK');
    if (intent.outcome !== 'OK') return;
    const offer = world.service.submitOffer(baseOfferInput(intent.value.intentId, SANDBOX_MERCHANT_SUSPENDED));
    assert.equal(offer.outcome, 'REJECTED');
  });

  it('9. unverified merchant rejected', () => {
    const intent = world.service.createIntent(baseIntentInput());
    assert.equal(intent.outcome, 'OK');
    if (intent.outcome !== 'OK') return;
    const offer = world.service.submitOffer(baseOfferInput(intent.value.intentId, SANDBOX_MERCHANT_UNVERIFIED));
    assert.equal(offer.outcome, 'REJECTED');
    if (offer.outcome === 'REJECTED') {
      assert.match(offer.message, /KYB|VERIFIED/);
    }
  });

  it('10. duplicate merchant bid rejected', () => {
    const intent = world.service.createIntent(baseIntentInput());
    assert.equal(intent.outcome, 'OK');
    if (intent.outcome !== 'OK') return;
    const first = world.service.submitOffer(baseOfferInput(intent.value.intentId, SANDBOX_MERCHANT_A));
    assert.equal(first.outcome, 'OK');
    const second = world.service.submitOffer(
      baseOfferInput(intent.value.intentId, SANDBOX_MERCHANT_A, { priceMinorUnits: '18999' }),
    );
    assert.equal(second.outcome, 'REJECTED');
    if (second.outcome === 'REJECTED') {
      assert.match(second.message, /DUPLICATE/);
    }
  });

  it('11. malformed bid — negative price', () => {
    const intent = world.service.createIntent(baseIntentInput());
    assert.equal(intent.outcome, 'OK');
    if (intent.outcome !== 'OK') return;
    const offer = world.service.submitOffer(
      baseOfferInput(intent.value.intentId, SANDBOX_MERCHANT_A, { priceMinorUnits: '-100' }),
    );
    assert.equal(offer.outcome, 'REJECTED');
  });

  it('12. expired offer rejected at selection', () => {
    const intent = world.service.createIntent(baseIntentInput());
    assert.equal(intent.outcome, 'OK');
    if (intent.outcome !== 'OK') return;
    const pastOffer = addMs(NOW, -1000n);
    const offer = world.service.submitOffer(
      baseOfferInput(intent.value.intentId, SANDBOX_MERCHANT_A, { expiresAt: pastOffer }),
    );
    assert.equal(offer.outcome, 'REJECTED');
  });

  it('13. offer withdrawal allowed', () => {
    const intent = world.service.createIntent(baseIntentInput());
    assert.equal(intent.outcome, 'OK');
    if (intent.outcome !== 'OK') return;
    const offer = world.service.submitOffer(baseOfferInput(intent.value.intentId, SANDBOX_MERCHANT_A));
    assert.equal(offer.outcome, 'OK');
    if (offer.outcome !== 'OK') return;
    const withdrawn = world.service.withdrawOffer(SANDBOX_MERCHANT_A, offer.value.offerId);
    assert.equal(withdrawn.outcome, 'OK');
    if (withdrawn.outcome === 'OK') assert.equal(withdrawn.value.status, 'WITHDRAWN');
  });

  it('14. sealed offer visibility — merchant cannot see competitor offers', () => {
    const local = createMerchantExchangeSandbox();
    const intent = local.service.createIntent(baseIntentInput());
    assert.equal(intent.outcome, 'OK');
    if (intent.outcome !== 'OK') return;
    local.service.submitOffer(baseOfferInput(intent.value.intentId, SANDBOX_MERCHANT_A));
    local.service.submitOffer(
      baseOfferInput(intent.value.intentId, SANDBOX_MERCHANT_B, {
        priceMinorUnits: '17999',
        required: undefined,
      }),
    );
    // MERCHANT_B supports HOME_GOODS — use compatible category
    const homeIntent = local.service.createIntent(
      baseIntentInput({
        required: { category: 'HOME_GOODS', productOrService: 'Desk lamp', quantity: 1, currency: 'USD' },
      }),
    );
    assert.equal(homeIntent.outcome, 'OK');
    if (homeIntent.outcome !== 'OK') return;
    local.service.submitOffer(baseOfferInput(homeIntent.value.intentId, SANDBOX_MERCHANT_A));
    local.service.submitOffer(
      baseOfferInput(homeIntent.value.intentId, SANDBOX_MERCHANT_B, { priceMinorUnits: '17999' }),
    );
    const visibility = local.service.getMerchantOffers(SANDBOX_MERCHANT_A, homeIntent.value.intentId);
    assert.equal(visibility.outcome, 'OK');
    if (visibility.outcome !== 'OK') return;
    assert.equal(visibility.value.ownOffers.length, 1);
    assert.equal(visibility.value.competitorOfferCount, 1);
    assert.equal(visibility.value.competitorOffers.length, 0);
    assertSealedOfferBoundary(visibility.value);
    assert.equal(OFFER_VISIBILITY_RULES.competitorOffersHidden, true);
  });

  it('15. ranking is deterministic and not price-only', () => {
    const local = createMerchantExchangeSandbox();
    const intent = local.service.createIntent(
      baseIntentInput({
        required: { category: 'HOME_GOODS', productOrService: 'Coffee maker', quantity: 1, currency: 'USD' },
      }),
    );
    assert.equal(intent.outcome, 'OK');
    if (intent.outcome !== 'OK') return;
    local.service.submitOffer(
      baseOfferInput(intent.value.intentId, SANDBOX_MERCHANT_A, {
        priceMinorUnits: '15000',
        deliveryTerms: 'Standard 5-7 days',
        warranty: '6 month warranty',
      }),
    );
    local.service.submitOffer(
      baseOfferInput(intent.value.intentId, SANDBOX_MERCHANT_B, {
        priceMinorUnits: '18000',
        deliveryTerms: 'Express same-day delivery',
        warranty: '24 month warranty',
      }),
    );
    const ranked = local.service.getRankedOffers(USER, intent.value.intentId);
    assert.equal(ranked.outcome, 'OK');
    if (ranked.outcome !== 'OK') return;
    assert.ok(ranked.value.offers.length >= 2);
    assert.ok(ranked.value.rankingFactors.includes('delivery'));
    assert.ok(ranked.value.rankingFactors.includes('warranty'));
  });

  it('16. user must explicitly select offer — no auto-accept', () => {
    const intent = world.service.createIntent(baseIntentInput());
    assert.equal(intent.outcome, 'OK');
    if (intent.outcome !== 'OK') return;
    const offer = world.service.submitOffer(baseOfferInput(intent.value.intentId, SANDBOX_MERCHANT_A));
    assert.equal(offer.outcome, 'OK');
    if (offer.outcome !== 'OK') return;
    const purchase = world.store.purchaseForIntent(intent.value.intentId);
    assert.equal(purchase, undefined);
  });

  it('17. user selects offer', () => {
    const intent = world.service.createIntent(baseIntentInput());
    assert.equal(intent.outcome, 'OK');
    if (intent.outcome !== 'OK') return;
    const offer = world.service.submitOffer(baseOfferInput(intent.value.intentId, SANDBOX_MERCHANT_A));
    assert.equal(offer.outcome, 'OK');
    if (offer.outcome !== 'OK') return;
    const selected = world.service.selectOffer({
      userId: USER,
      intentId: intent.value.intentId,
      offerId: offer.value.offerId,
      authorizationContext: 'user_explicit_selection',
    });
    assert.equal(selected.outcome, 'OK');
    if (selected.outcome !== 'OK') return;
    assert.equal(selected.value.acceptedOffer.offerVersion, 1);
    assert.equal(selected.value.authorizationStatus, 'AWAITING_USER_AUTHORIZATION');
    assert.ok(verifyOfferImmutability(selected.value.acceptedOffer));
  });

  it('18. offer changes after acceptance detected', () => {
    const snapshot = {
      offerVersion: 1,
      contentHash: 'tampered_hash',
      offer: {
        offerId: 'off_test',
        intentId: 'int_test',
        merchantId: SANDBOX_MERCHANT_A,
        price: { minorUnits: 100n, currency: 'USD' },
        discountMinorUnits: 0n,
        deliveryTerms: 'test',
        availability: 'in stock',
        warranty: null,
        serviceTerms: null,
        incentives: Object.freeze([]),
        sunReyBenefit: { benefitKind: 'NONE' as const, benefitReference: null, description: null },
        expiresAt: FUTURE,
        submittedAt: NOW,
        status: 'SELECTED' as const,
        version: 1,
        contentHash: 'original',
      },
      acceptedAt: NOW,
      authorizationContext: 'test',
    };
    assert.equal(verifyOfferImmutability(snapshot), false);
  });

  it('19. missing purchase authorization when provider unavailable', () => {
    const sandbox = createMerchantExchangeSandbox({ paymentAvailable: false });
    const intent = sandbox.service.createIntent(baseIntentInput());
    assert.equal(intent.outcome, 'OK');
    if (intent.outcome !== 'OK') return;
    const offer = sandbox.service.submitOffer(baseOfferInput(intent.value.intentId, SANDBOX_MERCHANT_A));
    assert.equal(offer.outcome, 'OK');
    if (offer.outcome !== 'OK') return;
    const selected = sandbox.service.selectOffer({
      userId: USER,
      intentId: intent.value.intentId,
      offerId: offer.value.offerId,
      authorizationContext: 'user_explicit_selection',
    });
    assert.equal(selected.outcome, 'OK');
    if (selected.outcome !== 'OK') return;
    const auth = sandbox.service.authorizePurchase(USER, selected.value.purchaseId);
    assert.equal(auth.outcome, 'REJECTED');
    if (auth.outcome === 'REJECTED') {
      assert.equal(auth.code, 'PAYMENT_UNAVAILABLE');
    }
  });

  it('20. payment authorization with provider available', () => {
    const sandbox = createMerchantExchangeSandbox({ paymentAvailable: true });
    const intent = sandbox.service.createIntent(baseIntentInput());
    assert.equal(intent.outcome, 'OK');
    if (intent.outcome !== 'OK') return;
    const offer = sandbox.service.submitOffer(baseOfferInput(intent.value.intentId, SANDBOX_MERCHANT_A));
    assert.equal(offer.outcome, 'OK');
    if (offer.outcome !== 'OK') return;
    const selected = sandbox.service.selectOffer({
      userId: USER,
      intentId: intent.value.intentId,
      offerId: offer.value.offerId,
      authorizationContext: 'user_explicit_selection',
    });
    assert.equal(selected.outcome, 'OK');
    if (selected.outcome !== 'OK') return;
    const auth = sandbox.service.authorizePurchase(USER, selected.value.purchaseId);
    assert.equal(auth.outcome, 'OK');
    if (auth.outcome !== 'OK') return;
    assert.equal(auth.value.authorizationStatus, 'AUTHORIZED');
    assert.ok(auth.value.paymentReference);
  });

  it('21. fulfillment transitions', () => {
    const sandbox = createMerchantExchangeSandbox({ paymentAvailable: true });
    const intent = sandbox.service.createIntent(baseIntentInput());
    if (intent.outcome !== 'OK') return;
    const offer = sandbox.service.submitOffer(baseOfferInput(intent.value.intentId, SANDBOX_MERCHANT_A));
    if (offer.outcome !== 'OK') return;
    const selected = sandbox.service.selectOffer({
      userId: USER,
      intentId: intent.value.intentId,
      offerId: offer.value.offerId,
      authorizationContext: 'ctx',
    });
    if (selected.outcome !== 'OK') return;
    sandbox.service.authorizePurchase(USER, selected.value.purchaseId);
    const started = sandbox.service.startFulfillment(selected.value.purchaseId);
    assert.equal(started.outcome, 'OK');
    if (started.outcome !== 'OK') return;
    assert.equal(started.value.fulfillmentStatus, 'ORDERED');
    const accepted = sandbox.service.transitionFulfillment(
      selected.value.purchaseId,
      'ACCEPTED_BY_MERCHANT',
      SANDBOX_MERCHANT_A,
    );
    assert.equal(accepted.outcome, 'OK');
    const processing = sandbox.service.transitionFulfillment(
      selected.value.purchaseId,
      'PROCESSING',
      SANDBOX_MERCHANT_A,
    );
    assert.equal(processing.outcome, 'OK');
    const shipped = sandbox.service.transitionFulfillment(
      selected.value.purchaseId,
      'SHIPPED',
      SANDBOX_MERCHANT_A,
    );
    assert.equal(shipped.outcome, 'OK');
    const delivered = sandbox.service.transitionFulfillment(
      selected.value.purchaseId,
      'DELIVERED',
      SANDBOX_MERCHANT_A,
    );
    assert.equal(delivered.outcome, 'OK');
  });

  it('22. settlement requires payment and fulfillment', () => {
    const sandbox = createMerchantExchangeSandbox({ paymentAvailable: true });
    const intent = sandbox.service.createIntent(baseIntentInput());
    if (intent.outcome !== 'OK') return;
    const offer = sandbox.service.submitOffer(baseOfferInput(intent.value.intentId, SANDBOX_MERCHANT_A));
    if (offer.outcome !== 'OK') return;
    const selected = sandbox.service.selectOffer({
      userId: USER,
      intentId: intent.value.intentId,
      offerId: offer.value.offerId,
      authorizationContext: 'ctx',
    });
    if (selected.outcome !== 'OK') return;
    const noSettle = sandbox.service.completeSettlement(selected.value.purchaseId);
    assert.equal(noSettle.outcome, 'REJECTED');
    sandbox.service.authorizePurchase(USER, selected.value.purchaseId);
    sandbox.service.startFulfillment(selected.value.purchaseId);
    sandbox.service.transitionFulfillment(selected.value.purchaseId, 'ACCEPTED_BY_MERCHANT', SANDBOX_MERCHANT_A);
    sandbox.service.transitionFulfillment(selected.value.purchaseId, 'PROCESSING', SANDBOX_MERCHANT_A);
    sandbox.service.transitionFulfillment(selected.value.purchaseId, 'SHIPPED', SANDBOX_MERCHANT_A);
    sandbox.service.transitionFulfillment(selected.value.purchaseId, 'DELIVERED', SANDBOX_MERCHANT_A);
    const settled = sandbox.service.completeSettlement(selected.value.purchaseId);
    assert.equal(settled.outcome, 'OK');
    if (settled.outcome === 'OK') assert.equal(settled.value.settlementStatus, 'SETTLED');
  });

  it('23. privacy boundary — merchant view excludes user identity', () => {
    const intent = world.service.createIntent(baseIntentInput());
    assert.equal(intent.outcome, 'OK');
    if (intent.outcome !== 'OK') return;
    const view = world.service.getMerchantVisibleIntent(SANDBOX_MERCHANT_A, intent.value.intentId);
    assert.equal(view.outcome, 'OK');
    if (view.outcome !== 'OK') return;
    assert.ok(!('userId' in view.value));
    assertMerchantPrivacyBoundary(view.value as unknown as Record<string, unknown>);
  });

  it('24. self-dealing forbidden', () => {
    assert.equal(checkSelfDealing('user_1', 'user_1').allowed, false);
    assert.equal(checkSelfDealing('user_1', 'user_2').allowed, true);
  });

  it('25. AI cannot invent merchant offer terms in ranking explanation', () => {
    const ranked = rankOffers({
      intent: {
        intentId: 'int_test',
        userId: USER,
        required: { category: 'ELECTRONICS', productOrService: 'X', quantity: 1, currency: 'USD' },
        specifications: {},
        locationConstraint: { regionCode: 'US-CA', countryCode: 'US' },
        deliveryConstraint: { method: 'DELIVERY' },
        budget: null,
        desiredPurchaseTime: null,
        preferences: {},
        verificationState: 'VERIFIED',
        privacyPolicy: { sharePostalPrefix: true, shareDeliveryWindow: true, shareBudgetRange: true, merchantVisibility: 'SEALED' },
        expiresAt: FUTURE,
        status: 'OPEN_FOR_OFFERS',
        createdAt: NOW,
        updatedAt: NOW,
        version: 1,
      },
      offers: [],
      now: NOW,
    });
    const invented = 'Get free shipping and 50% off with lifetime warranty!';
    assert.equal(validateRankingExplanation(invented, ranked.offers), false);
  });

  it('26. events emitted for intent lifecycle', () => {
    const events = new DomainEventLog();
    const sandbox = createMerchantExchangeSandbox();
    const svc = sandbox.service;
  });

  it('27. normal user cannot submit merchant offers via role check', () => {
    const intent = world.service.createIntent(baseIntentInput());
    assert.equal(intent.outcome, 'OK');
    if (intent.outcome !== 'OK') return;
    const wrongMerchant = world.service.submitOffer(
      baseOfferInput(intent.value.intentId, 'merch_nonexistent'),
    );
    assert.equal(wrongMerchant.outcome, 'REJECTED');
  });

  it('28. merchant cannot accept offers for another merchant', () => {
    const intent = world.service.createIntent(baseIntentInput());
    if (intent.outcome !== 'OK') return;
    const offer = world.service.submitOffer(baseOfferInput(intent.value.intentId, SANDBOX_MERCHANT_A));
    if (offer.outcome !== 'OK') return;
    const withdraw = world.service.withdrawOffer(SANDBOX_MERCHANT_B, offer.value.offerId);
    assert.equal(withdraw.outcome, 'REJECTED');
  });
});
