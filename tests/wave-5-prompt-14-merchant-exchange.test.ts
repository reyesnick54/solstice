/**
 * Wave 5 Prompt 14 — Merchant Exchange + Verified Purchase Intent Auction
 */

import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

import { addMs, systemClock } from '../packages/config/src/clock.ts';
import {
  createMerchantExchangeSandbox,
  MERCHANT_EXCHANGE_POSTURE,
  OFFER_VISIBILITY_RULES,
  SANDBOX_MERCHANT_A,
  SANDBOX_MERCHANT_B,
} from '../packages/sunrey-exchange/src/merchant-exchange/index.ts';
import { dispatchMerchantExchange } from '../services/api/src/consumer/merchant-exchange.ts';

const USER = 'wave5_user';
const NOW = systemClock.now();
const FUTURE = addMs(NOW, 7n * 24n * 60n * 60n * 1000n);

describe('Wave 5 Prompt 14 — Merchant Exchange', () => {
  it('architecture documentation exists', () => {
    assert.equal(existsSync('docs/architecture/merchant-exchange.md'), true);
    const doc = readFileSync('docs/architecture/merchant-exchange.md', 'utf8');
    assert.match(doc, /Purchase Intent/);
    assert.match(doc, /Sealed offer/);
    assert.match(doc, /not.*generic auction/i);
  });

  it('merchant exchange module exists under canonical exchange owner', () => {
    assert.equal(existsSync('packages/sunrey-exchange/src/merchant-exchange/service.ts'), true);
    assert.equal(existsSync('packages/sunrey-exchange/src/merchant-exchange/index.ts'), true);
    assert.equal(MERCHANT_EXCHANGE_POSTURE.sealedOffers, true);
    assert.equal(MERCHANT_EXCHANGE_POSTURE.autoAcceptForbidden, true);
  });

  it('end-to-end purchase intent marketplace flow', () => {
    const sandbox = createMerchantExchangeSandbox({ paymentAvailable: true });
    const svc = sandbox.service;

    const intent = svc.createIntent({
      userId: USER,
      required: { category: 'HOME_GOODS', productOrService: 'USB-C hub', quantity: 1, currency: 'USD' },
      locationConstraint: { regionCode: 'US-CA', countryCode: 'US' },
      deliveryConstraint: { method: 'DELIVERY' },
      expiresAt: FUTURE,
      submit: true,
    });
    assert.equal(intent.outcome, 'OK');
    if (intent.outcome !== 'OK') return;

    const offerA = svc.submitOffer({
      merchantId: SANDBOX_MERCHANT_A,
      intentId: intent.value.intentId,
      priceMinorUnits: '4999',
      currency: 'USD',
      deliveryTerms: 'Express 1-2 days',
      availability: 'In stock',
      warranty: '12 months',
      expiresAt: FUTURE,
    });
    assert.equal(offerA.outcome, 'OK');

    const offerB = svc.submitOffer({
      merchantId: SANDBOX_MERCHANT_B,
      intentId: intent.value.intentId,
      priceMinorUnits: '3999',
      currency: 'USD',
      deliveryTerms: 'Standard 5-7 days',
      availability: 'In stock',
      expiresAt: FUTURE,
    });
    assert.equal(offerB.outcome, 'OK');

    const sealed = svc.getMerchantOffers(SANDBOX_MERCHANT_A, intent.value.intentId);
    assert.equal(sealed.outcome, 'OK');
    if (sealed.outcome === 'OK') {
      assert.equal(sealed.value.competitorOffers.length, 0);
      assert.equal(OFFER_VISIBILITY_RULES.merchantSeesOwnOffersOnly, true);
    }

    const ranked = svc.getRankedOffers(USER, intent.value.intentId);
    assert.equal(ranked.outcome, 'OK');
    if (ranked.outcome !== 'OK') return;
    assert.ok(ranked.value.offers.length >= 2);

    const topOffer = ranked.value.offers[0]!;
    const selected = svc.selectOffer({
      userId: USER,
      intentId: intent.value.intentId,
      offerId: topOffer.offerId,
      authorizationContext: 'wave5_e2e_selection',
    });
    assert.equal(selected.outcome, 'OK');
    if (selected.outcome !== 'OK') return;

    const auth = svc.authorizePurchase(USER, selected.value.purchaseId);
    assert.equal(auth.outcome, 'OK');

    const fulfillingMerchant = selected.value.acceptedOffer.offer.merchantId;
    svc.startFulfillment(selected.value.purchaseId);
    svc.transitionFulfillment(selected.value.purchaseId, 'ACCEPTED_BY_MERCHANT', fulfillingMerchant);
    svc.transitionFulfillment(selected.value.purchaseId, 'PROCESSING', fulfillingMerchant);
    svc.transitionFulfillment(selected.value.purchaseId, 'SHIPPED', fulfillingMerchant);
    svc.transitionFulfillment(selected.value.purchaseId, 'DELIVERED', fulfillingMerchant);
    const settled = svc.completeSettlement(selected.value.purchaseId);
    assert.equal(settled.outcome, 'OK');
    if (settled.outcome === 'OK') {
      assert.equal(settled.value.settlementStatus, 'SETTLED');
    }
  });

  it('BFF integration for merchant exchange routes', () => {
    const sandbox = createMerchantExchangeSandbox();
    const res = dispatchMerchantExchange(
      {
        method: 'POST',
        path: '/api/v1/merchant-exchange/intents',
        body: {
          category: 'HOME_GOODS',
          productOrService: 'Desk lamp',
          quantity: 1,
          currency: 'USD',
          countryCode: 'US',
          expiresAt: FUTURE,
        },
        principal: { customerId: USER, role: 'USER' },
      },
      'wave5_bff',
      {},
      sandbox.service,
    );
    assert.ok(res);
    assert.equal(res!.status, 201);
  });
});
