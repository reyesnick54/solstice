import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { inspect } from 'node:util';
import { describe, it } from 'node:test';

import { CAPABILITIES, ENVIRONMENT } from '../../../config/src/flags.ts';
import { EvidenceVault } from '../../../evidence/src/vault.ts';
import { systemClock } from '../../../config/src/clock.ts';
import { parseSecretReference, SECRET_REFERENCE_SCHEME, secretRef } from '../../secrets.ts';
import { InMemorySecretProvider } from '../../secrets.ts';
import {
  CREDENTIAL_CANNOT_MINT,
  CREDENTIAL_CANNOT_POST_LEDGER,
  CREDENTIAL_EQUALS_PROVIDER_APPROVAL,
  CREDENTIAL_IS_NOT_EXECUTION_AUTHORITY,
  CREDENTIAL_PLANE_ID,
  RegulatedSecretResolver,
  acceptWebhookVersion,
  authenticationIsNotAcceptance,
  authorizeCredentialBinding,
  configurationFingerprint,
  createProviderCredentialDescriptor,
  credentialCannotIssueExecutionAuthority,
  credentialCannotMint,
  credentialCannotPostLedger,
  evaluateProductionProviderMode,
  fixtureBankingCredential,
  fixtureCustodyCredential,
  fixtureHsmHandle,
  fixtureHref,
  fixtureKycCredential,
  fixtureOracleCredential,
  fixtureSecretStore,
  fixtureWebhookCredential,
  handleLooksLikeString,
  hsmHandleIsNotSecretReference,
  looksLikePlaintextCredential,
  recordCredentialUse,
  redactCredentialLog,
  redactCredentialText,
  replaceProviderCredential,
  revealProtectedHandle,
  revokeCredential,
  safeCredentialErrorMessage,
  secretReferenceIsNotHsmHandle,
  secretVersionMetadata,
  startRotation,
} from './index.ts';

const NOW = '2026-08-20T12:00:00.000Z';
const ROOT = join(import.meta.dirname, '../../../../../..');

describe('Chunk 149 production provider credential plane', () => {
  it('keeps SecretReference canonical and rejects plaintext', () => {
    const parsed = parseSecretReference(fixtureHref('kyc/api-key'));
    assert.equal(parsed.ok, true);
    if (parsed.ok) {
      assert.equal(parsed.value.scheme, SECRET_REFERENCE_SCHEME);
    }
    assert.equal(looksLikePlaintextCredential('-----BEGIN PRIVATE KEY-----'), true);
    assert.equal(looksLikePlaintextCredential('Bearer super-secret-token-value'), true);
    const rejected = createProviderCredentialDescriptor({
      credentialId: 'plain',
      providerId: 'fixture-kyc',
      providerDomain: 'IDENTITY_KYC',
      credentialKind: 'API_KEY_REFERENCE',
      credentialHref: 'sk_live_not_a_reference',
      workloadIdentity: 'kyc_worker',
      allowedOperations: ['VERIFY_IDENTITY'],
      networkZone: 'DATA_PRIVATE',
      endpointProfileRef: 'profile:kyc:sandbox',
      issuedAt: NOW,
      notBefore: NOW,
      expiresAt: '2026-12-01T00:00:00.000Z',
    });
    assert.equal(rejected.ok, false);
    if (!rejected.ok) {
      assert.equal(rejected.error.code, 'INVALID_SECRET_REFERENCE');
    }
  });

  it('accepts API key, OAuth, and mTLS references', () => {
    assert.equal(fixtureKycCredential().credentialKind, 'API_KEY_REFERENCE');
    assert.equal(fixtureBankingCredential().credentialKind, 'OAUTH_CLIENT_SECRET_REFERENCE');
    assert.equal(fixtureCustodyCredential().credentialKind, 'MTLS_PRIVATE_KEY_REFERENCE');
    const oauth = createProviderCredentialDescriptor({
      credentialId: 'oauth_pk',
      providerId: 'fixture-bank',
      providerDomain: 'BANKING_REFERENCE',
      credentialKind: 'OAUTH_PRIVATE_KEY_REFERENCE',
      credentialHref: fixtureHref('banking/oauth'),
      workloadIdentity: 'banking_worker',
      allowedOperations: ['SIGN_PROVIDER_REQUEST'],
      networkZone: 'DATA_PRIVATE',
      endpointProfileRef: 'profile:bank:sandbox',
      issuedAt: NOW,
      notBefore: NOW,
      expiresAt: '2026-12-01T00:00:00.000Z',
    });
    const mtlsCert = createProviderCredentialDescriptor({
      credentialId: 'mtls_cert',
      providerId: 'fixture-custody',
      providerDomain: 'CUSTODY_PROVIDER',
      credentialKind: 'MTLS_CERTIFICATE_REFERENCE',
      credentialHref: fixtureHref('custody/mtls-key'),
      workloadIdentity: 'custody_worker',
      allowedOperations: ['READ_CUSTODY_POSITION'],
      networkZone: 'CUSTODY_PRIVATE',
      endpointProfileRef: 'profile:custody:sandbox',
      issuedAt: NOW,
      notBefore: NOW,
      expiresAt: '2026-12-01T00:00:00.000Z',
    });
    assert.equal(oauth.ok, true);
    assert.equal(mtlsCert.ok, true);
  });

  it('keeps HSM handles as non-exportable abstractions', () => {
    const handle = fixtureHsmHandle();
    assert.equal(handle.exportable, false);
    assert.equal(hsmHandleIsNotSecretReference(handle).isSecretReference, false);
    assert.equal(secretReferenceIsNotHsmHandle(secretRef('simulation', 'kyc/api-key')).isHsmHandle, false);
    const created = createProviderCredentialDescriptor({
      credentialId: 'hsm_1',
      providerId: 'simulation-hsm',
      providerDomain: 'HSM',
      credentialKind: 'HSM_KEY_HANDLE_REFERENCE',
      keyHandle: handle,
      workloadIdentity: 'hsm_worker',
      allowedOperations: ['SIGN_PROVIDER_REQUEST'],
      networkZone: 'SIGNER_PRIVATE',
      endpointProfileRef: 'profile:hsm:sim',
      issuedAt: NOW,
      notBefore: NOW,
      expiresAt: '2026-12-01T00:00:00.000Z',
    });
    assert.equal(created.ok, true);
    if (created.ok) {
      assert.equal(created.value.credentialRef, null);
      assert.equal(created.value.handleKind, 'HSM_KEY_HANDLE');
    }
  });

  it('rejects wrong workload, domain, and unauthorized operations', () => {
    const kyc = fixtureKycCredential();
    assert.equal(
      authorizeCredentialBinding({
        credential: kyc,
        workload: 'banking_worker',
        providerDomain: 'IDENTITY_KYC',
        operation: 'VERIFY_IDENTITY',
        now: NOW,
      }).ok,
      false,
    );
    assert.equal(
      authorizeCredentialBinding({
        credential: kyc,
        workload: 'kyc_worker',
        providerDomain: 'CUSTODY_PROVIDER',
        operation: 'VERIFY_IDENTITY',
        now: NOW,
      }).ok,
      false,
    );
    assert.equal(
      authorizeCredentialBinding({
        credential: kyc,
        workload: 'kyc_worker',
        providerDomain: 'IDENTITY_KYC',
        operation: 'SUBMIT_PAYMENT',
        now: NOW,
      }).ok,
      false,
    );
  });

  it('fails closed for expired and revoked credentials', () => {
    const expired = createProviderCredentialDescriptor({
      credentialId: 'expired',
      providerId: 'fixture-kyc',
      providerDomain: 'IDENTITY_KYC',
      credentialKind: 'API_KEY_REFERENCE',
      credentialHref: fixtureHref('kyc/api-key'),
      workloadIdentity: 'kyc_worker',
      allowedOperations: ['VERIFY_IDENTITY'],
      networkZone: 'DATA_PRIVATE',
      endpointProfileRef: 'profile:kyc:sandbox',
      issuedAt: '2020-01-01T00:00:00.000Z',
      notBefore: '2020-01-01T00:00:00.000Z',
      expiresAt: '2020-02-01T00:00:00.000Z',
    });
    assert.equal(expired.ok, true);
    if (expired.ok) {
      const result = authorizeCredentialBinding({
        credential: expired.value,
        workload: 'kyc_worker',
        providerDomain: 'IDENTITY_KYC',
        operation: 'VERIFY_IDENTITY',
        now: NOW,
      });
      assert.equal(result.ok, false);
      if (!result.ok) {
        assert.equal(result.error.code, 'CREDENTIAL_EXPIRED');
      }
    }
    const revoked = revokeCredential(fixtureKycCredential());
    const revokedResult = authorizeCredentialBinding({
      credential: revoked,
      workload: 'kyc_worker',
      providerDomain: 'IDENTITY_KYC',
      operation: 'VERIFY_IDENTITY',
      now: NOW,
    });
    assert.equal(revokedResult.ok, false);
    if (!revokedResult.ok) {
      assert.equal(revokedResult.error.code, 'CREDENTIAL_REVOKED');
    }
  });

  it('accepts rotating current version and bounds webhook overlap', () => {
    const rotating = startRotation({
      current: fixtureWebhookCredential(2),
      nextVersion: 2,
      now: NOW,
      overlapUntil: '2026-08-20T13:00:00.000Z',
      allowOverlap: true,
    });
    assert.equal(rotating.ok, true);
    const during = acceptWebhookVersion({
      requestedVersion: 1,
      currentVersion: 2,
      previousVersion: 1,
      overlapUntil: '2026-08-20T13:00:00.000Z',
      now: NOW,
    });
    const after = acceptWebhookVersion({
      requestedVersion: 1,
      currentVersion: 2,
      previousVersion: 1,
      overlapUntil: '2026-08-20T11:00:00.000Z',
      now: NOW,
    });
    assert.equal(during.ok, true);
    assert.equal(after.ok, false);
  });

  it('fails closed when the secret is unresolved and does not return a string', () => {
    const empty = new InMemorySecretProvider('simulation');
    const resolver = new RegulatedSecretResolver(empty);
    const result = resolver.resolveForWorkload({
      credential: fixtureOracleCredential(),
      workload: 'oracle_collector',
      providerDomain: 'ORACLE_DATA_SOURCE',
      operation: 'READ_REFERENCE_DATA',
      now: NOW,
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.error.code, 'SECRET_UNRESOLVED');
    }
    const ok = new RegulatedSecretResolver(fixtureSecretStore()).resolveForWorkload({
      credential: fixtureOracleCredential(),
      workload: 'oracle_collector',
      providerDomain: 'ORACLE_DATA_SOURCE',
      operation: 'READ_REFERENCE_DATA',
      now: NOW,
    });
    assert.equal(ok.ok, true);
    if (ok.ok) {
      assert.equal(handleLooksLikeString(ok.value), false);
      assert.equal(String(ok.value), '[REDACTED]');
      assert.equal(JSON.stringify(ok.value), '"[REDACTED]"');
      assert.equal(inspect(ok.value).includes('fixture-oracle'), false);
      assert.ok(revealProtectedHandle(ok.value));
    }
  });

  it('keeps secrets out of logs, errors, evidence, and configuration hashes', () => {
    const secret = 'fixture-kyc-api-key-value';
    const logged = JSON.stringify(redactCredentialLog({ authorization: `Bearer ${secret}`, note: 'ok' }));
    assert.equal(logged.includes(secret), false);
    const kyc = fixtureKycCredential();
    const error = authorizeCredentialBinding({
      credential: kyc,
      workload: 'custody_worker',
      providerDomain: 'IDENTITY_KYC',
      operation: 'VERIFY_IDENTITY',
      now: NOW,
    });
    assert.equal(error.ok, false);
    if (!error.ok) {
      assert.equal(safeCredentialErrorMessage(error.error).includes(secret), false);
      assert.equal(error.error.reason.includes(secret), false);
    }
    const audit = recordCredentialUse({
      providerId: kyc.providerId,
      domain: kyc.providerDomain,
      credentialId: kyc.credentialId,
      credentialVersion: kyc.version,
      workloadIdentity: kyc.workloadIdentity,
      operation: 'VERIFY_IDENTITY',
      timestamp: NOW,
      success: true,
      reasonCode: 'OK',
      secretValue: secret,
    });
    const vault = new EvidenceVault(systemClock);
    vault.seal('provider-credential-use', audit);
    assert.equal(JSON.stringify(vault.list()).includes(secret), false);
    const digest = configurationFingerprint({
      providerId: kyc.providerId,
      domain: kyc.providerDomain,
      workloadIdentity: kyc.workloadIdentity,
      credentialVersion: kyc.version,
      operations: kyc.allowedOperations,
      endpointProfileRef: kyc.endpointProfileRef,
      networkZone: kyc.networkZone,
      configurationVersion: 'v1',
      secretValue: secret,
    });
    assert.equal(digest.includes(secret), false);
    assert.equal(redactCredentialText(`Authorization: Bearer ${secret}`).includes(secret), false);
    assert.equal(secretVersionMetadata(kyc).valuePresent, false);
    assert.equal(secretVersionMetadata(kyc).pathHidden, true);
  });

  it('proves a credential is not Execution Authority, mint, ledger, or provider approval', () => {
    const kyc = fixtureKycCredential();
    assert.equal(CREDENTIAL_IS_NOT_EXECUTION_AUTHORITY, true);
    assert.equal(CREDENTIAL_CANNOT_MINT, true);
    assert.equal(CREDENTIAL_CANNOT_POST_LEDGER, true);
    assert.equal(CREDENTIAL_EQUALS_PROVIDER_APPROVAL, false);
    assert.equal(credentialCannotIssueExecutionAuthority(kyc), true);
    assert.equal(credentialCannotMint(fixtureOracleCredential()), true);
    assert.equal(credentialCannotPostLedger(fixtureBankingCredential()), true);
    assert.deepEqual(authenticationIsNotAcceptance(true), { authenticated: true, providerApproved: false });
    const replacement = replaceProviderCredential({
      from: kyc,
      toProviderId: 'fixture-kyc-b',
      toDomain: 'IDENTITY_KYC',
      toHref: fixtureHref('kyc/api-key'),
    });
    assert.equal(replacement.ok, false);
  });

  it('keeps PRODUCTION_AUTHORIZED unavailable and LIVE flags false', () => {
    assert.equal(ENVIRONMENT, 'simulation');
    assert.equal(CAPABILITIES.SIMULATION_MODE, true);
    assert.equal(CAPABILITIES.LIVE_MONEY_ENABLED, false);
    assert.equal(CAPABILITIES.LIVE_PAYMENTS_ENABLED, false);
    assert.equal(CAPABILITIES.LIVE_BANKING_RAILS, false);
    assert.equal(CAPABILITIES.LIVE_EXTERNAL_KYC, false);
    assert.equal(CAPABILITIES.LIVE_EXTERNAL_BANK_CONNECTION, false);
    const mode = evaluateProductionProviderMode({
      environment: ENVIRONMENT,
      simulationMode: CAPABILITIES.SIMULATION_MODE,
      liveFlags: {
        LIVE_MONEY_ENABLED: CAPABILITIES.LIVE_MONEY_ENABLED,
        LIVE_PAYMENTS_ENABLED: CAPABILITIES.LIVE_PAYMENTS_ENABLED,
        LIVE_BANKING_RAILS: CAPABILITIES.LIVE_BANKING_RAILS,
        LIVE_EXTERNAL_KYC: CAPABILITIES.LIVE_EXTERNAL_KYC,
        LIVE_EXTERNAL_BANK_CONNECTION: CAPABILITIES.LIVE_EXTERNAL_BANK_CONNECTION,
      },
      externalEvidenceComplete: true,
      humanAuthorizationComplete: true,
      requested: 'PRODUCTION_AUTHORIZED',
    });
    assert.equal(mode.ok, false);
    if (!mode.ok) {
      assert.equal(mode.error.code, 'PRODUCTION_PROVIDER_MODE_UNAVAILABLE');
    }
    assert.equal(CREDENTIAL_PLANE_ID, 'sunrey-production-provider-credential-plane');
  });
});
