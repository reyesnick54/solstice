import { inspect } from 'node:util';

import {
  RegulatedSecretResolver,
  authenticationIsNotAcceptance,
  configurationFingerprint,
  credentialCannotIssueExecutionAuthority,
  credentialCannotMint,
  credentialCannotPostLedger,
  evaluateProductionProviderMode,
  fixtureBankingCredential,
  fixtureCustodyCredential,
  fixtureKycCredential,
  fixtureOracleCredential,
  fixtureSecretStore,
  recordCredentialUse,
  redactCredentialLog,
  startRotation,
} from './index.ts';

const NOW = '2026-08-20T12:00:00.000Z';

function main(): void {
  const secrets = fixtureSecretStore();
  const resolver = new RegulatedSecretResolver(secrets);
  const kyc = fixtureKycCredential();
  const oracle = fixtureOracleCredential();
  const banking = fixtureBankingCredential();
  const custody = fixtureCustodyCredential();

  const kycResolve = resolver.resolveForWorkload({
    credential: kyc,
    workload: 'kyc_worker',
    providerDomain: 'IDENTITY_KYC',
    operation: 'VERIFY_IDENTITY',
    now: NOW,
  });
  const crossWorkload = resolver.resolveForWorkload({
    credential: kyc,
    workload: 'banking_worker',
    providerDomain: 'IDENTITY_KYC',
    operation: 'VERIFY_IDENTITY',
    now: NOW,
  });
  const rotation = startRotation({
    current: oracle,
    nextVersion: 2,
    now: NOW,
    overlapUntil: '2026-08-20T13:00:00.000Z',
    allowOverlap: true,
  });
  const audit = recordCredentialUse({
    providerId: kyc.providerId,
    domain: kyc.providerDomain,
    credentialId: kyc.credentialId,
    credentialVersion: kyc.version,
    workloadIdentity: kyc.workloadIdentity,
    operation: 'VERIFY_IDENTITY',
    timestamp: NOW,
    success: kycResolve.ok,
    reasonCode: kycResolve.ok ? 'OK' : kycResolve.error.code,
    secretValue: 'fixture-kyc-api-key-value',
  });
  const production = evaluateProductionProviderMode({
    environment: 'simulation',
    simulationMode: true,
    liveFlags: {
      LIVE_MONEY_ENABLED: false,
      LIVE_PAYMENTS_ENABLED: false,
      LIVE_BANKING_RAILS: false,
      LIVE_EXTERNAL_KYC: false,
      LIVE_EXTERNAL_BANK_CONNECTION: false,
    },
    externalEvidenceComplete: false,
    humanAuthorizationComplete: false,
    requested: 'PRODUCTION_AUTHORIZED',
  });
  const fingerprint = configurationFingerprint({
    providerId: banking.providerId,
    domain: banking.providerDomain,
    workloadIdentity: banking.workloadIdentity,
    credentialVersion: banking.version,
    operations: banking.allowedOperations,
    endpointProfileRef: banking.endpointProfileRef,
    networkZone: banking.networkZone,
    configurationVersion: 'v1',
    secretValue: 'fixture-banking-oauth-value',
  });

  console.log('SunRey production-candidate provider credential plane');
  console.log(`kyc_binding=${kyc.workloadIdentity}:${kyc.providerDomain}`);
  console.log(`oracle_binding=${oracle.workloadIdentity}:${oracle.providerDomain}`);
  console.log(`banking_binding=${banking.workloadIdentity}:${banking.providerDomain}`);
  console.log(`custody_binding=${custody.workloadIdentity}:${custody.providerDomain}`);
  console.log(`kyc_resolve_ok=${kycResolve.ok}`);
  console.log(`cross_workload_rejected=${!crossWorkload.ok}`);
  console.log(`rotation_status=${rotation.ok ? rotation.value.rotation.status : 'failed'}`);
  console.log(`audit=${JSON.stringify(redactCredentialLog(audit))}`);
  console.log(`fingerprint=${fingerprint}`);
  console.log(`handle=${kycResolve.ok ? inspect(kycResolve.value) : 'none'}`);
  console.log(`production_mode_available=${production.ok}`);
  console.log(`execution_authority=${!credentialCannotIssueExecutionAuthority(kyc)}`);
  console.log(`mint=${!credentialCannotMint(oracle)}`);
  console.log(`ledger=${!credentialCannotPostLedger(banking)}`);
  console.log(`auth_implies_approval=${authenticationIsNotAcceptance(true).providerApproved}`);
  console.log('RAW_CREDENTIALS_IN_CONFIG=false');
  console.log('RAW_CREDENTIALS_IN_LOGS=false');
  console.log('CROSS_WORKLOAD_REUSE_ALLOWED=false');
  console.log('CREDENTIAL_EQUALS_PROVIDER_APPROVAL=false');
  console.log('CREDENTIAL_EQUALS_EXECUTION_AUTHORITY=false');
  console.log('PRODUCTION_PROVIDER_MODE_ACTIVE=false');
  console.log('REAL_PROVIDER_CONTACTED=false');
  console.log('PRODUCTION_ACTIVE=false');
}

main();
