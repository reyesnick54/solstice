import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  CAPABILITIES,
  ENVIRONMENT,
  LIVE_BANKING_RAILS,
  LIVE_CRYPTO_ENABLED,
  LIVE_DATA_MARKET_ENABLED,
  LIVE_EXCHANGE_ENABLED,
  LIVE_EXTERNAL_BANK_CONNECTION,
  LIVE_EXTERNAL_KYC,
  LIVE_INVESTMENT_EXECUTION,
  LIVE_MONEY_ENABLED,
  LIVE_PAYMENTS_ENABLED,
  LIVE_TRADING_ENABLED,
  REAL_MONEY_ENABLED,
} from '../../config/src/flags.ts';
import { createProviderCredentialDescriptor } from '../../security/src/regulated/credentials/descriptor.ts';
import {
  analyzeBindingConcentration,
  assertCustodyBindingAssetSafe,
  assertOracleBindingScoped,
  assertPaymentBindingScoped,
  bindingContentHash,
  contextForBinding,
  evaluateFailoverIndependence,
  evaluateProductionProviderBinding,
  fixtureBindingContext,
  fixtureCustodyBinding,
  fixtureExpiredEvidencePort,
  fixtureFxBinding,
  fixtureHsmBinding,
  fixtureKycBinding,
  fixtureOracleBinding,
  fixturePaymentRailBinding,
  fixturePaymentRailFailoverBinding,
  fixtureRevokedEvidencePort,
  inMemoryOperatingScopePort,
  rejectRawSecrets,
  rotateCredentialVersionRef,
  sealProductionProviderBinding,
  validateEndpointProfile,
} from './providers/production-binding/index.ts';
import { buildConnectivityReadinessReport } from './providers/production-binding/report.ts';
import type { ProductionProviderBinding } from './providers/production-binding/types.ts';

function withBinding(
  binding: ProductionProviderBinding,
  patch: Partial<Omit<ProductionProviderBinding, 'contentHash' | 'productionConnectivityEnabled'>>,
): ProductionProviderBinding {
  const sealed = sealProductionProviderBinding({
    ...binding,
    ...patch,
    productionConnectivityEnabled: undefined as never,
  });
  if (!sealed.ok) {
    throw new Error(sealed.error.message);
  }
  return sealed.value;
}

describe('CHUNK-162 production provider binding', () => {
  it('1. provider binding deterministic hash', () => {
    const first = fixtureKycBinding();
    const second = fixtureKycBinding();
    assert.equal(first.contentHash, second.contentHash);
    assert.equal(first.contentHash, bindingContentHash({ ...first, contentHash: first.contentHash }));
    const rotated = withBinding(first, { version: 2 });
    assert.notEqual(rotated.contentHash, first.contentHash);
  });

  it('2. raw secret rejected', () => {
    const rejected = rejectRawSecrets({
      bindingId: 'bind_bad',
      apiKey: 'sk-live-this-is-a-secret',
    });
    assert.equal(rejected.ok, false);
    if (!rejected.ok) {
      assert.equal(rejected.error.code, 'RAW_SECRET_REJECTED');
    }
    const sealed = sealProductionProviderBinding({
      ...fixtureKycBinding(),
      credentialDescriptorRef: '-----BEGIN PRIVATE KEY-----abc',
    });
    assert.equal(sealed.ok, false);
  });

  it('3. sandbox credential cannot satisfy production binding', () => {
    const binding = fixtureKycBinding();
    const evaluation = evaluateProductionProviderBinding(
      withBinding(binding, { credentialDescriptorRef: 'cred_kyc_sandbox', endpointProfileRef: 'profile:kyc:sandbox' }),
      contextForBinding(binding, {
        sandboxFlag: false,
        productionEligibleFlag: false,
      }),
    );
    assert.equal(
      evaluation.blockers.some((row) => row.code === 'SANDBOX_CREDENTIAL_CANNOT_SATISFY_PRODUCTION'),
      true,
    );
    assert.equal(evaluation.sandboxCredentialUsedForProduction, false);
    const silent = evaluateProductionProviderBinding(
      binding,
      contextForBinding(binding, { sandboxFlag: true, productionEligibleFlag: true }),
    );
    assert.equal(
      silent.blockers.some((row) => row.code === 'SANDBOX_AND_PRODUCTION_ELIGIBLE_FORBIDDEN'),
      true,
    );
  });

  it('4. endpoint profile required', () => {
    const missing = sealProductionProviderBinding({
      ...fixtureKycBinding(),
      endpointProfileRef: '',
    });
    assert.equal(missing.ok, false);
    if (!missing.ok) {
      assert.equal(missing.error.code, 'ENDPOINT_PROFILE_REQUIRED');
    }
    const invalid = validateEndpointProfile({
      profileId: 'ep_bad',
      environmentClass: 'PRODUCTION_CANDIDATE',
      scheme: 'https',
      host: '127.0.0.1',
      port: 443,
      approvedPathPrefix: '/v1',
      tlsPolicy: 'TLS_1_3',
      mtlsRequired: false,
      redirectPolicy: 'DENY',
      certificateExpectation: 'PINNED',
      allowlisted: true,
      connectivityEnabled: false,
    });
    assert.equal(invalid.ok, false);
  });

  it('5. expired external evidence blocks', () => {
    const binding = fixtureKycBinding();
    const evaluation = evaluateProductionProviderBinding(
      binding,
      contextForBinding(binding, { evidence: fixtureExpiredEvidencePort() }),
    );
    assert.equal(evaluation.blockers.some((row) => row.code === 'EXPIRED_EXTERNAL_EVIDENCE'), true);
    assert.equal(evaluation.productionBindingCandidate, false);
  });

  it('6. revoked external evidence blocks', () => {
    const binding = fixtureKycBinding();
    const evaluation = evaluateProductionProviderBinding(
      binding,
      contextForBinding(binding, { evidence: fixtureRevokedEvidencePort() }),
    );
    assert.equal(evaluation.blockers.some((row) => row.code === 'REVOKED_EXTERNAL_EVIDENCE'), true);
    assert.equal(evaluation.state === 'REVOKED' || evaluation.productionBindingCandidate === false, true);
  });

  it('7. operating-scope mismatch blocks', () => {
    const binding = fixtureKycBinding();
    const evaluation = evaluateProductionProviderBinding(
      binding,
      contextForBinding(binding, {
        requestedJurisdictions: ['DE'],
        operatingScope: inMemoryOperatingScopePort([]),
      }),
    );
    assert.equal(evaluation.blockers.some((row) => row.code === 'OPERATING_SCOPE_MISMATCH'), true);
  });

  it('8. unsupported data class blocks', () => {
    const binding = fixtureKycBinding();
    const evaluation = evaluateProductionProviderBinding(
      binding,
      contextForBinding(binding, { requestedDataClasses: ['PAYMENT_DATA'] }),
    );
    assert.equal(evaluation.blockers.some((row) => row.code === 'UNSUPPORTED_DATA_CLASS'), true);
  });

  it('9. provider acceptance required', () => {
    const binding = fixtureKycBinding();
    const evaluation = evaluateProductionProviderBinding(
      binding,
      contextForBinding(binding, { acceptance: null }),
    );
    assert.equal(evaluation.blockers.some((row) => row.code === 'PROVIDER_ACCEPTANCE_REQUIRED'), true);
    assert.equal(evaluation.productionBindingCandidate, false);
  });

  it('10. primary provider independent from failover', () => {
    const primary = fixturePaymentRailBinding();
    const failover = fixturePaymentRailFailoverBinding();
    assert.notEqual(primary.providerId, failover.providerId);
    const report = evaluateFailoverIndependence({
      primary,
      failover,
      primaryContext: contextForBinding(primary),
      failoverContext: contextForBinding(failover),
    });
    assert.equal(report.sameProvider, false);
    assert.equal(report.inheritedApprovals, false);
    assert.equal(report.failoverIndependentlyQualified, true);
  });

  it('11. failover requires separate evidence', () => {
    const primary = fixturePaymentRailBinding();
    const inherited = withBinding(fixturePaymentRailFailoverBinding(), {
      externalEvidenceRefs: primary.externalEvidenceRefs,
    });
    const report = evaluateFailoverIndependence({
      primary,
      failover: inherited,
      primaryContext: contextForBinding(primary),
      failoverContext: contextForBinding(inherited),
    });
    assert.equal(report.failoverIndependentlyQualified, false);
    assert.equal(report.blockers.some((row) => row.code === 'FAILOVER_EVIDENCE_INHERITED'), true);
  });

  it('12. credential rotation version changes safely', () => {
    const binding = fixtureKycBinding();
    const rotatedRef = rotateCredentialVersionRef(binding.credentialVersionRef, 2);
    assert.equal(rotatedRef.endsWith(':v2'), true);
    const rotated = withBinding(binding, { credentialVersionRef: rotatedRef, version: 2 });
    assert.equal(rotated.providerId, binding.providerId);
    assert.equal(rotated.credentialDescriptorRef, binding.credentialDescriptorRef);
    assert.notEqual(rotated.contentHash, binding.contentHash);
    const evaluation = evaluateProductionProviderBinding(rotated, contextForBinding(rotated));
    assert.equal(evaluation.credentialReady, true);
  });

  it('13. schema drift requires revalidation', () => {
    const binding = fixtureKycBinding();
    const evaluation = evaluateProductionProviderBinding(
      binding,
      contextForBinding(binding, {
        observedVersionPins: { ...binding.versionPins, schemaVersion: 'schema/2' },
      }),
    );
    assert.equal(evaluation.blockers.some((row) => row.code === 'SCHEMA_DRIFT_REQUIRES_REVALIDATION'), true);
    assert.equal(evaluation.productionBindingCandidate, false);
  });

  it('14. provider domain mismatch rejected', () => {
    const binding = fixtureKycBinding();
    const created = createProviderCredentialDescriptor({
      credentialId: 'cred_wrong_domain',
      providerId: binding.providerId,
      providerDomain: 'PAYMENT_RAIL',
      credentialKind: 'API_KEY_REFERENCE',
      credentialHref: 'secret://simulation/kyc/wrong-domain',
      workloadIdentity: 'banking_worker',
      allowedOperations: ['SUBMIT_PAYMENT', 'READ_HEALTH'],
      networkZone: 'DATA_PRIVATE',
      endpointProfileRef: binding.endpointProfileRef,
      issuedAt: '2026-08-20T12:00:00.000Z',
      notBefore: '2026-08-01T00:00:00.000Z',
      expiresAt: '2026-12-01T00:00:00.000Z',
    });
    assert.equal(created.ok, true);
    if (!created.ok) {
      return;
    }
    const evaluation = evaluateProductionProviderBinding(
      withBinding(binding, { credentialDescriptorRef: 'cred_wrong_domain' }),
      contextForBinding(binding, {
        credentials: {
          ...fixtureBindingContext().credentials,
          cred_wrong_domain: { descriptor: created.value, environmentClass: 'PRODUCTION_CANDIDATE' },
        },
      }),
    );
    assert.equal(evaluation.blockers.some((row) => row.code === 'PROVIDER_DOMAIN_MISMATCH'), true);
  });

  it('15. provider A credential cannot bind provider B', () => {
    const kyc = fixtureKycBinding();
    const rail = fixturePaymentRailBinding();
    const evaluation = evaluateProductionProviderBinding(
      withBinding(kyc, { credentialDescriptorRef: rail.credentialDescriptorRef }),
      contextForBinding(kyc),
    );
    assert.equal(evaluation.blockers.some((row) => row.code === 'CREDENTIAL_PROVIDER_MISMATCH'), true);
  });

  it('16. MoonRey oracle provider binding scoped correctly', () => {
    const oracle = fixtureOracleBinding();
    assert.equal(assertOracleBindingScoped(oracle).ok, true);
    const evaluation = evaluateProductionProviderBinding(oracle, contextForBinding(oracle));
    assert.equal(evaluation.blockers.some((row) => row.code === 'ORACLE_BINDING_OUT_OF_SCOPE'), false);
    const minted = sealProductionProviderBinding({
      ...oracle,
      allowedOperations: ['READ_REFERENCE_DATA', 'SUBMIT_PAYMENT'],
    });
    assert.equal(minted.ok, true);
    if (minted.ok) {
      assert.equal(assertOracleBindingScoped(minted.value).ok, false);
    }
  });

  it('17. payment provider binding scoped correctly', () => {
    const rail = fixturePaymentRailBinding();
    const fx = fixtureFxBinding();
    assert.equal(assertPaymentBindingScoped(rail).ok, true);
    assert.equal(assertPaymentBindingScoped(fx).ok, true);
    assert.equal(evaluateProductionProviderBinding(rail, contextForBinding(rail)).endpointReady, true);
    const mixed = sealProductionProviderBinding({
      ...rail,
      dataClasses: ['KYC_DATA'],
    });
    assert.equal(mixed.ok, true);
    if (mixed.ok) {
      assert.equal(assertPaymentBindingScoped(mixed.value).ok, false);
    }
  });

  it('18. custody provider binding asset-safe', () => {
    const custody = fixtureCustodyBinding();
    assert.equal(assertCustodyBindingAssetSafe(custody).ok, true);
    assert.equal(custody.productionConnectivityEnabled, false);
    const evaluation = evaluateProductionProviderBinding(custody, contextForBinding(custody));
    assert.equal(evaluation.productionConnectivityEnabled, false);
    const unsafe = sealProductionProviderBinding({
      ...custody,
      allowedOperations: ['READ_CUSTODY_POSITION', 'SUBMIT_PAYMENT'],
    });
    assert.equal(unsafe.ok, true);
    if (unsafe.ok) {
      assert.equal(assertCustodyBindingAssetSafe(unsafe.value).ok, false);
    }
  });

  it('19. connectivity report never enables connectivity', () => {
    const bindings = [
      fixtureKycBinding(),
      fixturePaymentRailBinding(),
      fixturePaymentRailFailoverBinding(),
      fixtureFxBinding(),
      fixtureCustodyBinding(),
      fixtureOracleBinding(),
      fixtureHsmBinding(),
    ];
    const evaluations = bindings.map((binding) => evaluateProductionProviderBinding(binding, contextForBinding(binding)));
    const failover = evaluateFailoverIndependence({
      primary: fixturePaymentRailBinding(),
      failover: fixturePaymentRailFailoverBinding(),
      primaryContext: contextForBinding(fixturePaymentRailBinding()),
      failoverContext: contextForBinding(fixturePaymentRailFailoverBinding()),
    });
    const report = buildConnectivityReadinessReport({
      generatedAtUtc: '2026-08-20T12:00:00.000Z',
      requiredDomains: ['IDENTITY_KYC', 'PAYMENT_RAIL', 'FX_LIQUIDITY', 'CUSTODY_PROVIDER', 'ORACLE_DATA_SOURCE', 'HSM'],
      bindings,
      evaluations,
      failoverCoverage: failover.failoverIndependentlyQualified,
    });
    assert.equal(report.connectivityEnabled, false);
    assert.equal(report.liveConnectivityEnabled, false);
    assert.equal(report.productionActive, false);
    assert.equal(report.realProviderCalled, false);
    assert.equal(typeof report.connectivityReadyForHumanReview, 'boolean');
    const concentration = analyzeBindingConcentration(bindings);
    assert.equal(concentration.organizationalIndependenceClaimed, false);
  });

  it('20. all LIVE flags remain false', () => {
    assert.equal(ENVIRONMENT, 'simulation');
    assert.equal(LIVE_MONEY_ENABLED, false);
    assert.equal(LIVE_PAYMENTS_ENABLED, false);
    assert.equal(LIVE_BANKING_RAILS, false);
    assert.equal(LIVE_EXTERNAL_KYC, false);
    assert.equal(LIVE_EXTERNAL_BANK_CONNECTION, false);
    assert.equal(REAL_MONEY_ENABLED, false);
    assert.equal(LIVE_TRADING_ENABLED, false);
    assert.equal(LIVE_CRYPTO_ENABLED, false);
    assert.equal(LIVE_EXCHANGE_ENABLED, false);
    assert.equal(LIVE_DATA_MARKET_ENABLED, false);
    assert.equal(LIVE_INVESTMENT_EXECUTION, false);
    assert.equal(CAPABILITIES.ENVIRONMENT, 'simulation');
    assert.equal(CAPABILITIES.LIVE_MONEY_ENABLED, false);
    assert.equal(process.env.SUNREY_FORCE_LIVE, undefined);
    assert.equal(process.env.SUNREY_PRODUCTION_OVERRIDE, undefined);
    assert.equal(process.env.SUNREY_SKIP_PROVIDER_GATE, undefined);
    for (const binding of [
      fixtureKycBinding(),
      fixturePaymentRailBinding(),
      fixtureFxBinding(),
      fixtureCustodyBinding(),
      fixtureOracleBinding(),
      fixtureHsmBinding(),
    ]) {
      assert.equal(binding.productionConnectivityEnabled, false);
    }
  });
});
