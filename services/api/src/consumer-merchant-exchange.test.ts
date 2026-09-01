import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { addMs, systemClock } from '../../../packages/config/src/clock.ts';
import {
  createMerchantExchangeSandbox,
  SANDBOX_MERCHANT_A,
} from '../../../packages/sunrey-exchange/src/merchant-exchange/index.ts';
import { dispatchMerchantExchange, MERCHANT_EXCHANGE_BFF_ROUTES } from './consumer/merchant-exchange.ts';

const USER = 'bff_user_001';
const NOW = systemClock.now();
const FUTURE = addMs(NOW, 7n * 24n * 60n * 60n * 1000n);
const HEADERS = { 'content-type': 'application/json' };

describe('Merchant Exchange BFF', () => {
  const sandbox = createMerchantExchangeSandbox();
  const requestId = 'req_bff_test';

  it('registers expected routes', () => {
    assert.ok(MERCHANT_EXCHANGE_BFF_ROUTES.length >= 8);
    assert.ok(MERCHANT_EXCHANGE_BFF_ROUTES.some((r) => r.includes('intents')));
  });

  it('user creates purchase intent', () => {
    const res = dispatchMerchantExchange(
      {
        method: 'POST',
        path: '/api/v1/merchant-exchange/intents',
        body: {
          category: 'ELECTRONICS',
          productOrService: 'Laptop stand',
          quantity: 1,
          currency: 'USD',
          regionCode: 'US-NY',
          countryCode: 'US',
          expiresAt: FUTURE,
        },
        principal: { customerId: USER, role: 'USER' },
      },
      requestId,
      HEADERS,
      sandbox.service,
    );
    assert.ok(res);
    assert.equal(res!.status, 201);
  });

  it('merchant cannot create purchase intent', () => {
    const res = dispatchMerchantExchange(
      {
        method: 'POST',
        path: '/api/v1/merchant-exchange/intents',
        body: { category: 'OTHER', productOrService: 'X', quantity: 1, currency: 'USD', expiresAt: FUTURE },
        principal: { customerId: SANDBOX_MERCHANT_A, role: 'MERCHANT' },
      },
      requestId,
      HEADERS,
      sandbox.service,
    );
    assert.ok(res);
    assert.equal(res!.status, 403);
  });

  it('user cannot submit merchant offer', () => {
    const res = dispatchMerchantExchange(
      {
        method: 'POST',
        path: '/api/v1/merchant-exchange/offers',
        body: { intentId: 'int_fake', priceMinorUnits: '1000', currency: 'USD', deliveryTerms: 'x', availability: 'y', expiresAt: FUTURE },
        principal: { customerId: USER, role: 'USER' },
      },
      requestId,
      HEADERS,
      sandbox.service,
    );
    assert.ok(res);
    assert.equal(res!.status, 403);
  });

  it('unknown route returns 404', () => {
    const res = dispatchMerchantExchange(
      { method: 'GET', path: '/api/v1/merchant-exchange/unknown' },
      requestId,
      HEADERS,
      sandbox.service,
    );
    assert.ok(res);
    assert.equal(res!.status, 404);
  });

  it('non-merchant-exchange path returns null', () => {
    const res = dispatchMerchantExchange(
      { method: 'GET', path: '/api/v1/exchange/markets' },
      requestId,
      HEADERS,
      sandbox.service,
    );
    assert.equal(res, null);
  });
});
