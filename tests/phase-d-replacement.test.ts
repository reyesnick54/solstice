import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  createFxProviderA,
  createFxProviderB,
  createPaymentProviderA,
  createPaymentProviderB,
  runFxDomainWorkflow,
  runPaymentDomainWorkflow,
} from '../packages/payments/src/production-candidate/interchangeable.ts';
import { createKycProviderA, createKycProviderB, runKycDomainWorkflow } from '../packages/identity/src/provider-candidate/interchangeable.ts';
import { createMarketDataProviderA, createMarketDataProviderB } from '../packages/sunrey-exchange/src/market-data/sandbox.ts';
import { quoteFromProvider } from '../packages/sunrey-exchange/src/market-data/aggregation.ts';

describe('Phase D provider replacement', () => {
  it('runs the same payment domain workflow against providers A and B', () => {
    const a = runPaymentDomainWorkflow(createPaymentProviderA(), 'pay_replace_a');
    const b = runPaymentDomainWorkflow(createPaymentProviderB(), 'pay_replace_b');
    assert.equal(a.view.live, false);
    assert.equal(b.view.live, false);
    assert.deepEqual(Object.keys(a.view).sort(), Object.keys(b.view).sort());
    assert.notEqual(a.view.providerId, b.view.providerId);
  });

  it('runs the same FX domain workflow against providers A and B', () => {
    const a = runFxDomainWorkflow(createFxProviderA(), 'fx_replace_a');
    const b = runFxDomainWorkflow(createFxProviderB(), 'fx_replace_b');
    assert.equal(a.provider.live, false);
    assert.equal(b.provider.live, false);
    assert.equal(a.sourceCurrency, b.sourceCurrency);
    assert.equal(a.destinationCurrency, b.destinationCurrency);
    assert.equal(a.requiredApproval, 'CUSTOMER_CONFIRMATION');
    assert.deepEqual(Object.keys(a).sort(), Object.keys(b).sort());
  });

  it('runs the same KYC domain workflow against providers A and B', () => {
    const a = runKycDomainWorkflow(createKycProviderA(), 'cust_a');
    const b = runKycDomainWorkflow(createKycProviderB(), 'cust_b');
    assert.equal(a.outcome, 'VERIFIED');
    assert.equal(b.outcome, 'VERIFIED');
    assert.equal(a.live, false);
    assert.equal(b.live, false);
    assert.deepEqual(Object.keys(a).sort(), Object.keys(b).sort());
  });

  it('runs the same market-data domain workflow against providers A and B', () => {
    const now = '2026-08-21T16:00:00.000Z';
    const a = quoteFromProvider(createMarketDataProviderA(), 'SUNREY_COIN/USD', now);
    const b = quoteFromProvider(createMarketDataProviderB(), 'SUNREY_COIN/USD', now);
    assert.equal(a.ok, true);
    assert.equal(b.ok, true);
    if (!a.ok || !b.ok) throw new Error('quotes');
    assert.equal(a.value.instrument.instrumentId, b.value.instrument.instrumentId);
    assert.equal(a.value.currency, b.value.currency);
    assert.equal(a.value.staleMasqueradingAsCurrent, false);
    assert.notEqual(a.value.provider, b.value.provider);
  });
});
