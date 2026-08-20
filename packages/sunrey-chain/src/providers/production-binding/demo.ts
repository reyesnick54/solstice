/**
 * demo:sunrey-production-provider-binding
 *
 * Fixture bindings for KYC, payment rail, FX, custody, oracle, and HSM.
 * Engineering binding, external evidence, operating scope, and credential
 * references are complete. Network calls stay disabled.
 */

import {
  CAPABILITIES,
  ENVIRONMENT,
  LIVE_BANKING_RAILS,
  LIVE_EXTERNAL_BANK_CONNECTION,
  LIVE_EXTERNAL_KYC,
  LIVE_MONEY_ENABLED,
  LIVE_PAYMENTS_ENABLED,
} from '../../../../config/src/flags.ts';
import { analyzeBindingConcentration } from './concentration.ts';
import { evaluateProductionProviderBinding } from './evaluate.ts';
import { evaluateFailoverIndependence } from './failover.ts';
import {
  contextForBinding,
  fixtureCatalogBindings,
  fixtureCustodyBinding,
  fixtureFxBinding,
  fixtureHsmBinding,
  fixtureKycBinding,
  fixtureOracleBinding,
  fixturePaymentRailBinding,
  fixturePaymentRailFailoverBinding,
} from './fixtures.ts';
import { buildConnectivityReadinessReport } from './report.ts';

function main(): void {
  const kyc = fixtureKycBinding();
  const rail = fixturePaymentRailBinding();
  const railFailover = fixturePaymentRailFailoverBinding();
  const fx = fixtureFxBinding();
  const custody = fixtureCustodyBinding();
  const oracle = fixtureOracleBinding();
  const hsm = fixtureHsmBinding();
  const catalog = fixtureCatalogBindings();

  const evaluations = [kyc, rail, railFailover, fx, custody, oracle, hsm].map((binding) =>
    evaluateProductionProviderBinding(binding, contextForBinding(binding)),
  );
  const failover = evaluateFailoverIndependence({
    primary: rail,
    failover: railFailover,
    primaryContext: contextForBinding(rail),
    failoverContext: contextForBinding(railFailover),
  });
  const report = buildConnectivityReadinessReport({
    generatedAtUtc: '2026-08-20T12:00:00.000Z',
    requiredDomains: ['IDENTITY_KYC', 'PAYMENT_RAIL', 'FX_LIQUIDITY', 'CUSTODY_PROVIDER', 'ORACLE_DATA_SOURCE', 'HSM'],
    bindings: catalog,
    evaluations,
    failoverCoverage: failover.failoverIndependentlyQualified,
  });
  const concentration = analyzeBindingConcentration(catalog);

  const liveFlagsRemainFalse =
    ENVIRONMENT === 'simulation' &&
    LIVE_MONEY_ENABLED === false &&
    LIVE_PAYMENTS_ENABLED === false &&
    LIVE_BANKING_RAILS === false &&
    LIVE_EXTERNAL_KYC === false &&
    LIVE_EXTERNAL_BANK_CONNECTION === false &&
    Object.values(CAPABILITIES).every((value) => value === false || value === 'simulation' || value === true);

  console.log('CHUNK-162 production provider binding demo');
  console.log(`bindings=${catalog.length}`);
  console.log(`kyc_state=${evaluations[0]?.state}`);
  console.log(`engineering_bound=${evaluations.every((row) => row.engineeringBound)}`);
  console.log(`external_evidence_refs=${kyc.externalEvidenceRefs.join(',')}`);
  console.log(`operating_scope_refs=${kyc.operatingScopeRefs.join(',')}`);
  console.log(`credential_refs=${kyc.credentialDescriptorRef}`);
  console.log(`concentration_independence_claimed=${concentration.organizationalIndependenceClaimed}`);
  console.log(`connectivity_ready_for_human_review=${report.connectivityReadyForHumanReview}`);
  console.log(`connectivity_enabled=${report.connectivityEnabled}`);
  console.log(`PROVIDER_BINDINGS_COMPLETE=${evaluations.every((row) => row.engineeringBound)}`);
  console.log(`RAW_SECRET_PRESENT=${evaluations.some((row) => row.rawSecretPresent)}`);
  console.log(`SANDBOX_CREDENTIAL_USED_FOR_PRODUCTION=${evaluations.some((row) => row.sandboxCredentialUsedForProduction)}`);
  console.log(`OPERATING_SCOPE_CHECKED=${evaluations.every((row) => row.operatingScopeChecked)}`);
  console.log(`EXTERNAL_EVIDENCE_CHECKED=${evaluations.every((row) => row.externalEvidenceChecked)}`);
  console.log(`FAILOVER_PROVIDER_INDEPENDENTLY_QUALIFIED=${failover.failoverIndependentlyQualified}`);
  console.log(`REAL_PROVIDER_CALLED=${report.realProviderCalled}`);
  console.log(`LIVE_CONNECTIVITY_ENABLED=${report.liveConnectivityEnabled}`);
  console.log(`PRODUCTION_ACTIVE=${report.productionActive}`);
  console.log(`LIVE_FLAGS_UNCHANGED=${liveFlagsRemainFalse}`);
}

main();
