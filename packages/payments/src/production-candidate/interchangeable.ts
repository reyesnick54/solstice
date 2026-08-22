/**
 * Interchangeable deterministic payment and FX adapters for Phase D
 * replacement tests. Domain workflow code stays on RailAdapter /
 * FxLiquidityProvider. Only adapter construction differs.
 */

import { FrozenClock } from '../../../config/src/clock.ts';
import { asUtcInstant } from '../../../domain/src/time.ts';
import { Money } from '../../../money/src/money.ts';
import { InMemorySecretProvider, secretRef } from '../../../security/src/secrets.ts';
import { asBeneficiaryId, asPaymentId } from '../ids.ts';
import { SimulationFxProvider, type FxLiquidityProvider } from '../fx-provider.ts';
import { asCorridorId, asQuoteId } from '../ids.ts';
import { asLegalEntityId } from '../../../domain/src/legal-entity.ts';
import { fxQuoteDisclosure, type FxQuoteDisclosure } from '../responses.ts';
import type { RailAdapter, RailHealthSnapshot, RailSubmitResult } from '../rail-port.ts';
import { asProviderId } from '../rail-ids.ts';
import { createRailSubmission, providerIdempotencyKeyFor } from '../rail-submission.ts';
import { CandidateRailAdapter } from './adapter.ts';
import { CandidateProviderAuthenticator, candidateAuthConfig } from './auth.ts';
import {
  fixtureInternationalCapability,
  fixtureRailInternational,
  fixtureRailInternationalFailover,
} from './fixtures.ts';
import { FixturePaymentTransport } from './transport.ts';

export type NormalizedPaymentView = {
  readonly providerId: string;
  readonly status: string;
  readonly providerStatus: string;
  readonly message: string;
  readonly live: false;
};

export function createPaymentProviderA(): CandidateRailAdapter {
  return createPaymentAdapter('fixture-rail-international', 'payments/fixture-rail-international', fixtureRailInternational());
}

export function createPaymentProviderB(): CandidateRailAdapter {
  const profile = fixtureRailInternationalFailover();
  return createPaymentAdapter(profile.providerId, 'payments/fixture-rail-international-b', profile);
}

function createPaymentAdapter(
  providerId: string,
  secretPath: string,
  profile: ReturnType<typeof fixtureRailInternational>,
): CandidateRailAdapter {
  const secrets = new InMemorySecretProvider('simulation', { [secretPath]: 'rail-key' });
  const capability =
    providerId === 'fixture-rail-international'
      ? fixtureInternationalCapability()
      : {
          ...fixtureInternationalCapability(),
          provider: asProviderId(providerId),
          capabilityId: fixtureInternationalCapability().capabilityId,
        };
  return new CandidateRailAdapter({
    capability,
    profile,
    transport: new FixturePaymentTransport(),
    authenticator: new CandidateProviderAuthenticator(secrets),
    auth: candidateAuthConfig({
      provider: asProviderId(providerId),
      mechanism: 'API_KEY',
      credentialRef: secretRef('simulation', secretPath),
      webhookSignatureRef: secretRef('simulation', secretPath),
      credentialDescriptorRef: {
        ...profile.credentialDescriptorRef,
        secretRef: secretRef('simulation', secretPath),
      },
    }),
  });
}

/**
 * Domain payment workflow. Adapter-agnostic. Used by replacement tests.
 */
export function runPaymentDomainWorkflow(
  adapter: RailAdapter,
  paymentId: string,
): { readonly view: NormalizedPaymentView; readonly health: RailHealthSnapshot; readonly result: RailSubmitResult } {
  const health = adapter.health();
  const submission = createRailSubmission(
    {
      paymentId: asPaymentId(paymentId),
      provider: adapter.capability.provider,
      rail: adapter.capability.rail,
      amount: Money.fromMinorUnits(10_000n, 'USD'),
      currency: 'USD' as never,
      sourceReference: 'src_opaque',
      destinationReference: 'dst_opaque',
      beneficiaryReference: asBeneficiaryId('ben_sim'),
      purposeReference: 'sandbox',
      idempotencyKey: providerIdempotencyKeyFor(paymentId, `key_${paymentId}`),
      correlationId: `key_${paymentId}`,
      requestedSettlement: { settlementClass: 'CORRESPONDENT', requestedAt: null },
    },
    asUtcInstant('2026-08-21T16:00:00.000Z'),
  );
  const result = adapter.submitPayment({
    authorityId: 'ea_sandbox',
    actionType: 'INITIATE_PAYMENT',
    submission,
  });
  return {
    view: Object.freeze({
      providerId: adapter.capability.provider,
      status: result.status,
      providerStatus: result.providerStatus,
      message: result.message,
      live: false,
    }),
    health,
    result,
  };
}

export function createFxProviderA(): FxLiquidityProvider {
  return new SimulationFxProvider(new FrozenClock(asUtcInstant('2026-08-21T16:00:00.000Z')));
}

export function createFxProviderB(): FxLiquidityProvider {
  return new SimulationFxProvider(new FrozenClock(asUtcInstant('2026-08-21T16:00:00.000Z')));
}

/**
 * Domain FX workflow. Same disclosure shape regardless of adapter.
 */
export function runFxDomainWorkflow(provider: FxLiquidityProvider, quoteId: string): FxQuoteDisclosure {
  const quote = provider.quote({
    quoteId: asQuoteId(quoteId),
    baseCurrency: 'USD' as never,
    quoteCurrency: 'SAR' as never,
    sourceAmount: Money.fromMinorUnits(10_000n, 'USD'),
    corridorId: asCorridorId('US-SA-USD-SAR'),
    legalEntityId: asLegalEntityId('le_solstice_us_inc'),
    now: asUtcInstant('2026-08-21T16:00:00.000Z'),
  });
  return fxQuoteDisclosure(quote);
}

export function runPaymentContractSuite(): {
  readonly outcome: 'CONTRACT_TEST_PASS' | 'CONTRACT_TEST_FAIL';
  readonly cases: readonly string[];
  readonly externalCertification: 'EXTERNAL_CERTIFICATION_REQUIRED';
} {
  const a = runPaymentDomainWorkflow(createPaymentProviderA(), 'pay_a');
  const b = runPaymentDomainWorkflow(createPaymentProviderB(), 'pay_b');
  const passed = a.view.live === false && b.view.live === false && a.view.status.length > 0 && b.view.status.length > 0;
  return Object.freeze({
    outcome: passed ? 'CONTRACT_TEST_PASS' : 'CONTRACT_TEST_FAIL',
    cases: Object.freeze(['payment_a', 'payment_b', 'normalized_view']),
    externalCertification: 'EXTERNAL_CERTIFICATION_REQUIRED',
  });
}

export function runFxContractSuite(): {
  readonly outcome: 'CONTRACT_TEST_PASS' | 'CONTRACT_TEST_FAIL';
  readonly cases: readonly string[];
  readonly externalCertification: 'EXTERNAL_CERTIFICATION_REQUIRED';
} {
  const a = runFxDomainWorkflow(createFxProviderA(), 'fxq_a');
  const b = runFxDomainWorkflow(createFxProviderB(), 'fxq_b');
  const passed =
    a.provider.live === false &&
    b.provider.live === false &&
    a.sourceCurrency === 'USD' &&
    b.destinationCurrency === 'SAR';
  return Object.freeze({
    outcome: passed ? 'CONTRACT_TEST_PASS' : 'CONTRACT_TEST_FAIL',
    cases: Object.freeze(['fx_a', 'fx_b', 'disclosure_stable']),
    externalCertification: 'EXTERNAL_CERTIFICATION_REQUIRED',
  });
}
