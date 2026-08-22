/**
 * Interchangeable deterministic KYC adapters for Phase D replacement tests.
 * Domain workflow consumes IdentityVerificationProvider only.
 */

import { asUtcInstant } from '../../../domain/src/time.ts';
import type { IdentityVerificationProvider, IdentityVerificationResult } from '../ports.ts';
import { FixturePersonVerificationProvider } from './person.ts';
import { FakeIdentityTransport } from './transport.ts';

export type NormalizedKycView = {
  readonly outcome: IdentityVerificationResult['outcome'];
  readonly providerRef: string;
  readonly reasonCodes: readonly string[];
  readonly live: false;
};

export function createKycProviderA(): IdentityVerificationProvider {
  const transport = new FakeIdentityTransport();
  transport.setScenario('cust_a', 'verified');
  return new FixturePersonVerificationProvider(transport);
}

export function createKycProviderB(): IdentityVerificationProvider {
  const transport = new FakeIdentityTransport();
  transport.setScenario('cust_b', 'verified');
  return new FixturePersonVerificationProvider(transport);
}

export function runKycDomainWorkflow(
  provider: IdentityVerificationProvider,
  identityId: string,
): NormalizedKycView {
  const result = provider.verifyPerson(identityId, asUtcInstant('2026-08-21T16:00:00.000Z'));
  return Object.freeze({
    outcome: result.outcome,
    providerRef: result.providerRef,
    reasonCodes: result.reasonCodes,
    live: false,
  });
}

export function runKycContractSuite(): {
  readonly outcome: 'CONTRACT_TEST_PASS' | 'CONTRACT_TEST_FAIL';
  readonly cases: readonly string[];
  readonly externalCertification: 'EXTERNAL_CERTIFICATION_REQUIRED';
} {
  const a = runKycDomainWorkflow(createKycProviderA(), 'cust_a');
  const b = runKycDomainWorkflow(createKycProviderB(), 'cust_b');
  const passed = a.outcome === 'VERIFIED' && b.outcome === 'VERIFIED' && a.live === false && b.live === false;
  return Object.freeze({
    outcome: passed ? 'CONTRACT_TEST_PASS' : 'CONTRACT_TEST_FAIL',
    cases: Object.freeze(['kyc_a', 'kyc_b', 'normalized_view']),
    externalCertification: 'EXTERNAL_CERTIFICATION_REQUIRED',
  });
}
