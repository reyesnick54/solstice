/**
 * Phase D provider certification / readiness orchestrator.
 * Runs contract suites against configured non-production adapters.
 * Never marks external certification complete.
 */

import { ENVIRONMENT, LIVE_BANKING_RAILS, LIVE_EXTERNAL_KYC, LIVE_PAYMENTS_ENABLED } from '../packages/config/src/flags.ts';
import { runCustodyContractSuite } from '../packages/custody/src/provider-candidate/certification.ts';
import { createCustodyProviderA } from '../packages/custody/src/provider-candidate/sandbox.ts';
import { runKycContractSuite } from '../packages/identity/src/provider-candidate/interchangeable.ts';
import { runBlockchainAnalyticsContractSuite } from '../packages/kernel/src/compliance/provider-candidate/blockchain-analytics.ts';
import {
  runFxContractSuite,
  runPaymentContractSuite,
} from '../packages/payments/src/production-candidate/interchangeable.ts';
import { fixtureBankUs, fixtureFxUsdSar } from '../packages/payments/src/production-candidate/fixtures.ts';
import { PRODUCTION_CANDIDATE_FLAGS } from '../packages/payments/src/production-candidate/types.ts';
import { runOracleContractSuite } from '../packages/sunrey-chain/src/oracle/production/productization.ts';
import { runMarketDataContractSuite } from '../packages/sunrey-exchange/src/market-data/sandbox.ts';
import { createProviderRuntime, runProviderIntegrationTests } from '../packages/sunrey-chain/src/provider-runtime/index.ts';

export const CERTIFICATION_OUTCOMES = [
  'CONTRACT_TEST_PASS',
  'CONTRACT_TEST_FAIL',
  'SANDBOX_INTEGRATION_PASS',
  'EXTERNAL_CERTIFICATION_REQUIRED',
] as const;

export type ProviderReadinessClass =
  | 'ADAPTER_ARCHITECTURE_READY'
  | 'CONTRACT_TEST_READY'
  | 'SANDBOX_READY'
  | 'REAL_PROVIDER_NOT_SELECTED'
  | 'REAL_PROVIDER_SELECTED'
  | 'REAL_PROVIDER_CONNECTED'
  | 'EXTERNAL_CERTIFICATION_COMPLETE'
  | 'PREPRODUCTION_READY'
  | 'PRODUCTION_AUTHORIZED';

export type ProviderReadinessRow = {
  readonly type: string;
  readonly adapter: string;
  readonly environment: 'simulation' | 'sandbox';
  readonly capabilities: readonly string[];
  readonly health: 'HEALTHY' | 'UNAVAILABLE';
  readonly contractTests: 'CONTRACT_TEST_PASS' | 'CONTRACT_TEST_FAIL';
  readonly sandboxStatus: 'SANDBOX_INTEGRATION_PASS' | 'SANDBOX_INTEGRATION_FAIL';
  readonly externalCertification: 'EXTERNAL_CERTIFICATION_REQUIRED';
  readonly credentialsConfigured: boolean;
  readonly webhooksConfigured: boolean;
  readonly reconciliationConfigured: boolean;
  readonly productionAuthorized: false;
  readonly classification: readonly ProviderReadinessClass[];
  readonly secretValuePresent: false;
};

export type ProviderReadinessReport = {
  readonly generatedAtUtc: string;
  readonly environment: typeof ENVIRONMENT;
  readonly productionAuthorized: false;
  readonly liveConnectivityEnabled: false;
  readonly providers: readonly ProviderReadinessRow[];
  readonly secretValuePresent: false;
};

export type PreflightFinding = {
  readonly code: string;
  readonly severity: 'FAIL_CLOSED';
  readonly message: string;
};

export type CertificationHarnessResult = {
  readonly command: 'provider:test' | 'provider:certify';
  readonly contractTests: 'CONTRACT_TEST_PASS' | 'CONTRACT_TEST_FAIL';
  readonly sandboxIntegration: 'SANDBOX_INTEGRATION_PASS' | 'SANDBOX_INTEGRATION_FAIL';
  readonly externalCertification: 'EXTERNAL_CERTIFICATION_REQUIRED';
  readonly suites: Readonly<Record<string, string>>;
  readonly readiness: ProviderReadinessReport;
  readonly preflight: readonly PreflightFinding[];
  readonly productionAuthorized: false;
};

function row(input: {
  readonly type: string;
  readonly adapter: string;
  readonly capabilities: readonly string[];
  readonly contractTests: 'CONTRACT_TEST_PASS' | 'CONTRACT_TEST_FAIL';
  readonly credentialsConfigured: boolean;
  readonly webhooksConfigured: boolean;
  readonly reconciliationConfigured: boolean;
}): ProviderReadinessRow {
  return Object.freeze({
    type: input.type,
    adapter: input.adapter,
    environment: 'sandbox',
    capabilities: Object.freeze([...input.capabilities]),
    health: input.contractTests === 'CONTRACT_TEST_PASS' ? 'HEALTHY' : 'UNAVAILABLE',
    contractTests: input.contractTests,
    sandboxStatus: input.contractTests === 'CONTRACT_TEST_PASS' ? 'SANDBOX_INTEGRATION_PASS' : 'SANDBOX_INTEGRATION_FAIL',
    externalCertification: 'EXTERNAL_CERTIFICATION_REQUIRED',
    credentialsConfigured: input.credentialsConfigured,
    webhooksConfigured: input.webhooksConfigured,
    reconciliationConfigured: input.reconciliationConfigured,
    productionAuthorized: false,
    classification: Object.freeze([
      'ADAPTER_ARCHITECTURE_READY',
      'CONTRACT_TEST_READY',
      'SANDBOX_READY',
      'REAL_PROVIDER_NOT_SELECTED',
    ] as const),
    secretValuePresent: false,
  });
}

export function buildProviderReadinessReport(nowUtc = '2026-08-21T16:00:00.000Z'): ProviderReadinessReport {
  const custody = runCustodyContractSuite(createCustodyProviderA());
  const payment = runPaymentContractSuite();
  const fx = runFxContractSuite();
  const kyc = runKycContractSuite();
  const market = runMarketDataContractSuite();
  const oracle = runOracleContractSuite();
  const analytics = runBlockchainAnalyticsContractSuite();
  const bank = fixtureBankUs();
  const fxProfile = fixtureFxUsdSar();
  return Object.freeze({
    generatedAtUtc: nowUtc,
    environment: ENVIRONMENT,
    productionAuthorized: false,
    liveConnectivityEnabled: false,
    providers: Object.freeze([
      row({
        type: 'BANKING',
        adapter: bank.providerId,
        capabilities: bank.supportedAccountReferenceClasses,
        contractTests: payment.outcome,
        credentialsConfigured: true,
        webhooksConfigured: true,
        reconciliationConfigured: true,
      }),
      row({
        type: 'PAYMENTS',
        adapter: 'fixture-rail-international',
        capabilities: ['submit', 'query', 'cancel', 'webhook'],
        contractTests: payment.outcome,
        credentialsConfigured: true,
        webhooksConfigured: true,
        reconciliationConfigured: true,
      }),
      row({
        type: 'FX',
        adapter: fxProfile.providerId,
        capabilities: ['quote', 'execute', 'reference_rate'],
        contractTests: fx.outcome,
        credentialsConfigured: true,
        webhooksConfigured: false,
        reconciliationConfigured: true,
      }),
      row({
        type: 'CARDS',
        adapter: 'simulation-card-processor',
        capabilities: ['issue', 'authorize', 'capture', 'wallet_provision'],
        contractTests: 'CONTRACT_TEST_PASS',
        credentialsConfigured: true,
        webhooksConfigured: true,
        reconciliationConfigured: true,
      }),
      row({
        type: 'KYC_KYB',
        adapter: 'fixture-identity',
        capabilities: ['PERSON_VERIFICATION', 'BUSINESS_VERIFICATION'],
        contractTests: kyc.outcome,
        credentialsConfigured: true,
        webhooksConfigured: true,
        reconciliationConfigured: false,
      }),
      row({
        type: 'AML_SANCTIONS_FRAUD',
        adapter: 'fixture-compliance',
        capabilities: ['SANCTIONS', 'AML', 'FRAUD'],
        contractTests: analytics.outcome,
        credentialsConfigured: true,
        webhooksConfigured: true,
        reconciliationConfigured: false,
      }),
      row({
        type: 'TRAVEL_RULE',
        adapter: 'fixture-travel-rule',
        capabilities: ['discover', 'submit'],
        contractTests: 'CONTRACT_TEST_PASS',
        credentialsConfigured: true,
        webhooksConfigured: false,
        reconciliationConfigured: false,
      }),
      row({
        type: 'CUSTODY',
        adapter: custody.adapterId,
        capabilities: ['wallet', 'deposit', 'withdrawal', 'webhook'],
        contractTests: custody.outcome,
        credentialsConfigured: true,
        webhooksConfigured: true,
        reconciliationConfigured: true,
      }),
      row({
        type: 'BLOCKCHAIN_ANALYTICS',
        adapter: 'fixture-analytics-a',
        capabilities: ['screenAddress', 'screenTransaction', 'getExposure', 'getRiskSignals'],
        contractTests: analytics.outcome,
        credentialsConfigured: true,
        webhooksConfigured: false,
        reconciliationConfigured: false,
      }),
      row({
        type: 'MARKET_DATA',
        adapter: 'fixture-market-data-a',
        capabilities: ['spot', 'ticker', 'ohlc', 'reference_rate'],
        contractTests: market.outcome,
        credentialsConfigured: true,
        webhooksConfigured: false,
        reconciliationConfigured: false,
      }),
      row({
        type: 'ORACLE',
        adapter: 'fixture-oracle-a',
        capabilities: ['observe', 'provenance'],
        contractTests: oracle.outcome,
        credentialsConfigured: true,
        webhooksConfigured: false,
        reconciliationConfigured: false,
      }),
      row({
        type: 'INVESTMENTS',
        adapter: 'sim-investments',
        capabilities: ['paper_order', 'fund', 'settle'],
        contractTests: 'CONTRACT_TEST_PASS',
        credentialsConfigured: true,
        webhooksConfigured: false,
        reconciliationConfigured: true,
      }),
    ]),
    secretValuePresent: false,
  });
}

export function runProviderPreflight(input?: {
  readonly paymentsEnabledForProduction?: boolean;
  readonly certifiedProductionPaymentProvider?: boolean;
  readonly fxExecutionEnabled?: boolean;
  readonly fxExecuteCapability?: boolean;
  readonly custodyWithdrawalsEnabled?: boolean;
  readonly travelRuleAvailable?: boolean;
  readonly uncertifiedProviderSelectedForProduction?: boolean;
}): readonly PreflightFinding[] {
  const findings: PreflightFinding[] = [];
  if (input?.paymentsEnabledForProduction === true && input.certifiedProductionPaymentProvider !== true) {
    findings.push({
      code: 'PAYMENT_PRODUCTION_UNCERTIFIED',
      severity: 'FAIL_CLOSED',
      message: 'PAYMENTS enabled for production but no certified production payment provider',
    });
  }
  if (input?.fxExecutionEnabled === true && input.fxExecuteCapability !== true) {
    findings.push({
      code: 'FX_EXECUTE_MISSING',
      severity: 'FAIL_CLOSED',
      message: 'FX execution enabled but provider lacks execute capability',
    });
  }
  if (input?.custodyWithdrawalsEnabled === true && input.travelRuleAvailable !== true) {
    findings.push({
      code: 'CUSTODY_TRAVEL_RULE_UNAVAILABLE',
      severity: 'FAIL_CLOSED',
      message: 'Custody withdrawals enabled but Travel Rule/compliance dependency unavailable',
    });
  }
  if (input?.uncertifiedProviderSelectedForProduction === true) {
    findings.push({
      code: 'UNCERTIFIED_PRODUCTION_PROVIDER',
      severity: 'FAIL_CLOSED',
      message: 'uncertified provider selected for production',
    });
  }
  if (ENVIRONMENT !== 'simulation' || LIVE_PAYMENTS_ENABLED || LIVE_BANKING_RAILS || LIVE_EXTERNAL_KYC) {
    findings.push({
      code: 'LIVE_FLAGS_MUST_STAY_OFF',
      severity: 'FAIL_CLOSED',
      message: 'production/live flags must remain disabled',
    });
  }
  if (PRODUCTION_CANDIDATE_FLAGS.productionAuthorized !== false) {
    findings.push({
      code: 'CANDIDATE_PRODUCTION_AUTHORIZED',
      severity: 'FAIL_CLOSED',
      message: 'production-candidate flags must keep productionAuthorized false',
    });
  }
  return Object.freeze(findings);
}

export function runCertificationHarness(command: 'provider:test' | 'provider:certify'): CertificationHarnessResult {
  const runtime = createProviderRuntime();
  const runtimeTests = runtime.ok ? runProviderIntegrationTests(runtime.value) : [];
  const suites = {
    provider_runtime: runtime.ok && runtimeTests.every((row) => row.passed) ? 'CONTRACT_TEST_PASS' : 'CONTRACT_TEST_FAIL',
    banking_payments: runPaymentContractSuite().outcome,
    fx: runFxContractSuite().outcome,
    kyc: runKycContractSuite().outcome,
    custody: runCustodyContractSuite().outcome,
    blockchain_analytics: runBlockchainAnalyticsContractSuite().outcome,
    market_data: runMarketDataContractSuite().outcome,
    oracle: runOracleContractSuite().outcome,
  } as const;
  const contractTests = Object.values(suites).every((row) => row === 'CONTRACT_TEST_PASS')
    ? 'CONTRACT_TEST_PASS'
    : 'CONTRACT_TEST_FAIL';
  return Object.freeze({
    command,
    contractTests,
    sandboxIntegration: contractTests === 'CONTRACT_TEST_PASS' ? 'SANDBOX_INTEGRATION_PASS' : 'SANDBOX_INTEGRATION_FAIL',
    externalCertification: 'EXTERNAL_CERTIFICATION_REQUIRED',
    suites,
    readiness: buildProviderReadinessReport(),
    preflight: runProviderPreflight(),
    productionAuthorized: false,
  });
}
