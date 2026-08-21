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

describe('Phase D Lovable / API stability', () => {
  it('keeps consumer payment and FX shapes stable across provider A and B', () => {
    const payA = runPaymentDomainWorkflow(createPaymentProviderA(), 'lovable_pay_a');
    const payB = runPaymentDomainWorkflow(createPaymentProviderB(), 'lovable_pay_b');
    assert.deepEqual(Object.keys(payA.view).sort(), Object.keys(payB.view).sort());
    assert.equal(payA.view.live, false);
    assert.equal(payB.view.live, false);

    const fxA = runFxDomainWorkflow(createFxProviderA(), 'lovable_fx_a');
    const fxB = runFxDomainWorkflow(createFxProviderB(), 'lovable_fx_b');
    assert.deepEqual(Object.keys(fxA).sort(), Object.keys(fxB).sort());
    assert.equal(fxA.provider.state, 'SIMULATED');
    assert.equal(fxB.provider.live, false);
    assert.equal(fxA.rateKind, 'CUSTOMER');
    assert.equal(fxB.requiredApproval, 'CUSTOMER_CONFIRMATION');
  });
});
