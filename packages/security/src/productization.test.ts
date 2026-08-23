import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

import { PRODUCTION_HSM_KMS_CONFIGURED as CONFIG_HSM_GATE } from '../../config/src/flags.ts';
import { sha256Hex } from './hash.ts';
import { SecretValue } from './redaction.ts';
import { ProviderWebhookGuard } from './regulated/webhook.ts';
import { parseSecretReference, secretRef } from './secrets.ts';
import { createSimulationKeyProvider } from './simulation.ts';
import { UnavailableKeyProvider } from './unavailable.ts';
import { createDevelopmentHsmSimulator } from './hsm-simulator.ts';
import { SUITE_SUNREY_ED25519_V1 } from './crypto-suite.ts';
import {
  AGENT_FORBIDDEN_CONTEXT,
  API_SECURITY_CONTROLS,
  CHAIN_SECURITY_POSTURE,
  CONTAINER_HARDENING_BASELINE,
  DATABASE_ROLE_POLICIES,
  EXTERNAL_AUDIT_COMPLETE,
  EXTERNAL_HSM_KMS_CONNECTED,
  EXTERNAL_PENTEST_EXECUTED,
  FIELD_ENCRYPTION_INVENTORY,
  FORBIDDEN_NETWORK_PATHS,
  HSM_KMS_POSTURE,
  KEY_TRUST_DOMAINS,
  NETWORK_SURFACES,
  PRODUCTION_DATABASE_CONTROLS,
  PRODUCTION_HSM_KMS_CONFIGURED,
  PRODUCTION_READY,
  PRODUCTION_SIGNING_ENABLED,
  REVIEWED_IMAGES,
  ROTATION_POLICIES,
  SECRET_CLASSES,
  SECRET_CLASS_POLICIES,
  SECURITY_BASELINE_CONTROLS,
  SHARED_UNIVERSAL_INTERNAL_API_KEY,
  SUPPLY_CHAIN_CONTROLS,
  SYSTEM_THREAT_MODEL,
  THREAT_IDS,
  PrivilegedAccessRegistry,
  assertAgentCannotIssueAuthority,
  assertAgentContextClean,
  assertApplicationCannotSignChain,
  assertApplicationRole,
  assertConfigurationSecretReference,
  assertDatabaseTls,
  assertHsmGateClosed,
  assertKeyDomain,
  assertMainnetOff,
  assertMigratorCannotServeTraffic,
  assertNoIdor,
  assertNoKeyDomainCrossing,
  assertNoMassAssignment,
  assertNoOpenRedirect,
  assertNoPrivilegedToolInjection,
  assertSecretClassAccess,
  authenticatePeer,
  authorizeNetworkPath,
  defaultInternalIdentities,
  emergencyRevoke,
  evaluateNetworkPath,
  hashRawBody,
  historicalVerifyAllowed,
  issueServiceCertificateIdentity,
  registerEnvironmentBoundProvider,
  rejectSharedInternalKey,
  requireProductionSigningProvider,
  rotateWithOverlap,
  validateInboundWebhook,
} from './productization/index.ts';

describe('Phase I Prompt 2 — HSM/KMS gate', () => {
  it('keeps PRODUCTION_HSM_KMS_CONFIGURED false and fails production signing closed', () => {
    assert.equal(PRODUCTION_HSM_KMS_CONFIGURED, false);
    assert.equal(CONFIG_HSM_GATE, false);
    assert.equal(EXTERNAL_HSM_KMS_CONNECTED, false);
    assert.equal(PRODUCTION_SIGNING_ENABLED, false);
    assert.equal(HSM_KMS_POSTURE.vendorSelected, null);
    assert.equal(HSM_KMS_POSTURE.independentAuditComplete, false);
    assert.equal(assertHsmGateClosed().ok, true);

    const keys = createSimulationKeyProvider();
    const refused = requireProductionSigningProvider(keys, 'EXECUTION_AUTHORITY_SIGNING');
    assert.equal(refused.ok, false);
    if (!refused.ok) {
      assert.equal(refused.error.code, 'PRODUCTION_HSM_REQUIRED');
    }

    const down = requireProductionSigningProvider(new UnavailableKeyProvider(), 'WALLET_SIGNING');
    assert.equal(down.ok, false);

    const hsm = createDevelopmentHsmSimulator();
    const hsmRefused = requireProductionSigningProvider(hsm, 'WALLET_SIGNING');
    assert.equal(hsmRefused.ok, false);
    if (!hsmRefused.ok) {
      assert.equal(hsmRefused.error.code, 'PRODUCTION_HSM_REQUIRED');
    }
  });
});

describe('Phase I Prompt 2 — secret references and classification', () => {
  it('rejects plaintext configuration and classifies every required secret class', () => {
    assert.deepEqual([...SECRET_CLASSES], [
      'API_CREDENTIAL',
      'DATABASE_CREDENTIAL',
      'JWT_SIGNING_KEY',
      'PROVIDER_KEY',
      'CUSTODY_CREDENTIAL',
      'VALIDATOR_KEY',
      'TLS_PRIVATE_KEY',
      'ENCRYPTION_KEY',
      'ADMINISTRATIVE_CREDENTIAL',
    ]);
    for (const secretClass of SECRET_CLASSES) {
      const policy = SECRET_CLASS_POLICIES[secretClass];
      assert.equal(policy.plaintextInCodeForbidden, true);
      assert.equal(policy.sharedAccountForbidden, true);
      assert.ok(policy.storage.length > 0);
    }
    const ok = assertConfigurationSecretReference('secret://simulation/session-signing');
    assert.equal(ok.ok, true);
    const plaintext = assertConfigurationSecretReference('sk_live_not_a_reference');
    assert.equal(plaintext.ok, false);
    if (!plaintext.ok) {
      assert.equal(plaintext.error.code, 'PLAINTEXT_SECRET_REJECTED');
    }
    const password = assertConfigurationSecretReference('postgres://user:pass@db/sunrey');
    assert.equal(password.ok, false);
    const denied = assertSecretClassAccess({
      secretClass: 'CUSTODY_CREDENTIAL',
      caller: 'rpc',
      allowedCallers: ['custody'],
    });
    assert.equal(denied.ok, false);
    assert.equal(parseSecretReference('https://example/secret').ok, false);
  });
});

describe('Phase I Prompt 2 — key purpose separation', () => {
  it('refuses key-domain crossing and HMAC chain signing', () => {
    assert.equal(KEY_TRUST_DOMAINS.length, 8);
    assert.equal(assertKeyDomain('SESSION_SIGNING', 'SESSION_TOKEN_SIGNING').ok, true);
    const crossing = assertKeyDomain('SESSION_SIGNING', 'CHAIN_WALLET_CUSTODY');
    assert.equal(crossing.ok, false);
    if (!crossing.ok) {
      assert.equal(crossing.error.code, 'KEY_DOMAIN_CROSSING');
    }
    const sessionToWallet = assertNoKeyDomainCrossing('SESSION_SIGNING', 'WALLET_SIGNING');
    assert.equal(sessionToWallet.ok, false);
    const adminToEa = assertNoKeyDomainCrossing('ADMINISTRATION_SIGNING', 'EXECUTION_AUTHORITY_SIGNING');
    assert.equal(adminToEa.ok, false);
    const providerToSession = assertNoKeyDomainCrossing('PROVIDER_AUTHENTICATION', 'SESSION_SIGNING');
    assert.equal(providerToSession.ok, false);
    assert.equal(assertApplicationCannotSignChain('VALIDATOR_CONSENSUS_SIGNING').ok, false);

    const keys = createSimulationKeyProvider();
    const session = keys.sign('SESSION_SIGNING', 'token');
    assert.equal(session.ok, true);
    if (!session.ok) return;
    const asWallet = keys.verify('PROVIDER_AUTHENTICATION', 'token', session.value.hex);
    assert.equal(asWallet.ok, false);
    const chain = keys.sign('WALLET_SIGNING', 'tx');
    assert.equal(chain.ok, false);
    if (!chain.ok) {
      assert.equal(chain.error.code, 'PURPOSE_MISMATCH');
    }
  });
});

describe('Phase I Prompt 2 — rotation and emergency revocation', () => {
  it('keeps overlapping verification and does not wipe sessions or corrupt envelopes', () => {
    assert.equal(ROTATION_POLICIES.SESSION_SIGNING.invalidateSessionsOnRotate, false);
    assert.equal(ROTATION_POLICIES.DATA_ENCRYPTION.corruptHistoricalEnvelopes, false);
    assert.equal(ROTATION_POLICIES.VALIDATOR_CONSENSUS_SIGNING.breakValidatorState, false);

    const keys = createSimulationKeyProvider();
    const payload = 'session-body';
    const v1 = keys.sign('SESSION_SIGNING', payload);
    assert.equal(v1.ok, true);
    if (!v1.ok) return;
    const window = rotateWithOverlap(keys, 'SESSION_SIGNING', '2026-12-31T00:00:00.000Z');
    assert.equal(window.ok, true);
    const historical = keys.verify('SESSION_SIGNING', payload, v1.value.hex);
    assert.equal(historical.ok, true);

    const sealed = keys.encrypt('DATA_ENCRYPTION', Buffer.from('vault-field'));
    assert.equal(sealed.ok, true);
    if (!sealed.ok) return;
    keys.rotateKey('DATA_ENCRYPTION');
    const opened = keys.decrypt(sealed.value);
    assert.equal(opened.ok, true);

    const meta = keys.keyStatus('SESSION_SIGNING', 1);
    assert.equal(meta.ok, true);
    if (meta.ok) {
      assert.equal(historicalVerifyAllowed(meta.value, '2026-08-23T00:00:00.000Z', '2026-12-31T00:00:00.000Z'), true);
    }

    const revoked = emergencyRevoke(keys, 'SESSION_SIGNING', 2, 'suspected compromise of session signer', '2026-08-23T12:00:00.000Z');
    assert.equal(revoked.ok, true);
    if (revoked.ok) {
      assert.equal(revoked.value.sessionsInvalidated, true);
      assert.equal(revoked.value.encryptedDataPreserved, true);
      assert.equal(revoked.value.validatorStatePreserved, true);
    }
    const after = keys.sign('SESSION_SIGNING', payload);
    assert.equal(after.ok, false);
  });
});

describe('Phase I Prompt 2 — service identity and mTLS', () => {
  it('issues per-service certificate identity and refuses a shared internal key', () => {
    assert.equal(SHARED_UNIVERSAL_INTERNAL_API_KEY, false);
    const cert = issueServiceCertificateIdentity({
      serviceId: 'svc_accounts',
      serviceRole: 'ACCOUNTS_SERVICE',
    });
    assert.equal(cert.ok, true);
    if (!cert.ok) return;
    assert.equal(cert.value.committedCertificateMaterial, false);
    assert.equal(cert.value.sharedUniversalKey, false);
    assert.equal(cert.value.certificateRef.href.startsWith('secret://'), true);
    assert.match(cert.value.identityUri, /^spiffe:\/\//);

    assert.equal(rejectSharedInternalKey('internal-api-key').ok, false);
    const registry = defaultInternalIdentities('2026-08-23T00:00:00.000Z', '2026-08-23T01:00:00.000Z');
    const agent = registry.get('svc_agent');
    assert.ok(agent);
    const agentAdmin = authenticatePeer({
      caller: agent,
      capability: 'ADMINISTER',
      now: '2026-08-23T00:10:00.000Z',
    });
    assert.equal(agentAdmin.ok, false);
    const api = registry.get('svc_api');
    assert.ok(api);
    const peer = authenticatePeer({
      caller: api,
      capability: 'AUTHENTICATE_PEER',
      now: '2026-08-23T00:10:00.000Z',
    });
    assert.equal(peer.ok, true);
  });
});

describe('Phase I Prompt 2 — network segmentation', () => {
  it('default-denies public paths to keys, databases, and admin', () => {
    assert.equal(NETWORK_SURFACES.length, 9);
    assert.equal(authorizeNetworkPath('PUBLIC_API', 'INTERNAL_API').ok, true);
    assert.equal(authorizeNetworkPath('PUBLIC_API', 'DATABASE').ok, false);
    assert.equal(authorizeNetworkPath('PUBLIC_API', 'CUSTODY_KEY_SERVICES').ok, false);
    assert.equal(authorizeNetworkPath('PUBLIC_RPC', 'CUSTODY_KEY_SERVICES').ok, false);
    assert.equal(authorizeNetworkPath('PUBLIC_RPC', 'ADMIN_OPERATIONS').ok, false);
    assert.equal(evaluateNetworkPath('PUBLIC_API', 'VALIDATOR').allowed, false);
    assert.ok(FORBIDDEN_NETWORK_PATHS.length >= 6);
  });
});

describe('Phase I Prompt 2 — privileged access', () => {
  it('requires named accounts, step-up, and records break-glass', () => {
    const registry = new PrivilegedAccessRegistry();
    const shared = registry.open({
      sessionId: 'ses_shared',
      actorId: 'admin',
      role: 'SECURITY_OPERATOR',
      assurance: 'STEP_UP',
      expiresAt: '2026-08-23T02:00:00.000Z',
      now: '2026-08-23T00:00:00.000Z',
    });
    assert.equal(shared.ok, false);
    if (!shared.ok) {
      assert.equal(shared.error.code, 'SHARED_ACCOUNT_FORBIDDEN');
    }

    const weak = registry.open({
      sessionId: 'ses_weak',
      actorId: 'idn_operator_1',
      role: 'SECURITY_OPERATOR',
      assurance: 'STANDARD',
      expiresAt: '2026-08-23T02:00:00.000Z',
      now: '2026-08-23T00:00:00.000Z',
    });
    assert.equal(weak.ok, false);

    const opened = registry.open({
      sessionId: 'ses_ok',
      actorId: 'idn_operator_1',
      role: 'SECURITY_OPERATOR',
      assurance: 'STEP_UP',
      expiresAt: '2026-08-23T02:00:00.000Z',
      now: '2026-08-23T00:00:00.000Z',
    });
    assert.equal(opened.ok, true);
    const allowed = registry.authorize('ses_ok', 'SECURITY_OPERATOR', '2026-08-23T00:10:00.000Z');
    assert.equal(allowed.ok, true);
    const wrongRole = registry.authorize('ses_ok', 'PLATFORM_OPERATOR', '2026-08-23T00:10:00.000Z');
    assert.equal(wrongRole.ok, false);

    const glass = registry.openBreakGlass({
      recordId: 'bg_1',
      actorId: 'idn_operator_2',
      reason: 'restore locked operator console after outage',
      openedAt: '2026-08-23T00:20:00.000Z',
      expiresAt: '2026-08-23T01:20:00.000Z',
    });
    assert.equal(glass.ok, true);
    if (glass.ok) {
      assert.equal(glass.value.recorded, true);
    }
    assert.equal(registry.listBreakGlass().length, 1);
  });
});

describe('Phase I Prompt 2 — database hardening', () => {
  it('forbids application superuser and requires TLS', () => {
    assert.equal(PRODUCTION_DATABASE_CONTROLS.applicationSuperuserForbidden, true);
    assert.equal(PRODUCTION_DATABASE_CONTROLS.tlsRequired, true);
    assert.equal(DATABASE_ROLE_POLICIES.CUSTOMER_APP.superuser, false);
    assert.equal(DATABASE_ROLE_POLICIES.MIGRATOR.ddl, true);
    assert.equal(assertApplicationRole('postgres').ok, false);
    assert.equal(assertApplicationRole('customer_app').ok, true);
    assert.equal(assertDatabaseTls(false).ok, false);
    assert.equal(assertDatabaseTls(true).ok, true);
    assert.equal(assertMigratorCannotServeTraffic('MIGRATOR', true).ok, false);
  });
});

describe('Phase I Prompt 2 — API and webhook hardening', () => {
  it('blocks IDOR, mass assignment, open redirects, invalid and cross-environment webhooks', () => {
    assert.ok(API_SECURITY_CONTROLS.idor.includes('subject'));
    assert.equal(
      assertNoIdor({
        authenticatedSubjectId: 'idn_a',
        requestedSubjectId: 'idn_b',
        bodyKeys: [],
        allowedBodyKeys: [],
        redirectTarget: null,
        allowedRedirects: [],
      }).ok,
      false,
    );
    assert.equal(
      assertNoMassAssignment({
        authenticatedSubjectId: 'idn_a',
        requestedSubjectId: 'idn_a',
        bodyKeys: ['amount', 'userId', 'role'],
        allowedBodyKeys: ['amount'],
        redirectTarget: null,
        allowedRedirects: [],
      }).ok,
      false,
    );
    assert.equal(
      assertNoOpenRedirect({
        authenticatedSubjectId: 'idn_a',
        requestedSubjectId: 'idn_a',
        bodyKeys: [],
        allowedBodyKeys: [],
        redirectTarget: 'https://evil.example/steal',
        allowedRedirects: ['https://app.sunrey.example/callback'],
      }).ok,
      false,
    );

    const guard = new ProviderWebhookGuard();
    const secret = new SecretValue('sandbox-webhook-secret');
    registerEnvironmentBoundProvider(guard, 'kyc-sandbox', secret, 'SANDBOX');
    const raw = '{"kyc":"passed"}';
    const unsigned = {
      schemaVersion: 1 as const,
      providerId: 'kyc-sandbox',
      eventType: 'kyc.completed',
      timestampUtc: '2026-08-23T11:00:00.000Z',
      nonce: 'nonce-env-1',
      idempotencyKey: 'idemp-env-1',
      payloadHash: hashRawBody(raw),
      environment: 'SANDBOX',
    };
    const envelope = guard.sign(unsigned, secret);
    const now = Date.parse(unsigned.timestampUtc);
    const ok = validateInboundWebhook({
      guard,
      envelope,
      rawBody: raw,
      nowMs: now,
      domainStateMachineInvoked: true,
    });
    assert.equal(ok.ok, true);

    const cross = validateInboundWebhook({
      guard,
      envelope: guard.sign({ ...unsigned, nonce: 'n2', idempotencyKey: 'i2', environment: 'PRODUCTION' }, secret),
      rawBody: raw,
      nowMs: now,
      domainStateMachineInvoked: true,
    });
    assert.equal(cross.ok, false);

    const replay = validateInboundWebhook({
      guard,
      envelope,
      rawBody: raw,
      nowMs: now,
      domainStateMachineInvoked: true,
    });
    assert.equal(replay.ok, false);

    const bypass = validateInboundWebhook({
      guard,
      envelope: guard.sign({ ...unsigned, nonce: 'n3', idempotencyKey: 'i3' }, secret),
      rawBody: raw,
      nowMs: now,
      domainStateMachineInvoked: false,
    });
    assert.equal(bypass.ok, false);

    const tampered = validateInboundWebhook({
      guard,
      envelope: guard.sign({ ...unsigned, nonce: 'n4', idempotencyKey: 'i4', payloadHash: sha256Hex('other') }, secret),
      rawBody: raw,
      nowMs: now,
      domainStateMachineInvoked: true,
    });
    assert.equal(tampered.ok, false);
  });
});

describe('Phase I Prompt 2 — Agent, chain, containers, supply chain', () => {
  it('enforces Agent isolation, mainnet-off, and hardening inventories', () => {
    assert.ok(AGENT_FORBIDDEN_CONTEXT.includes('Execution Authority'));
    assert.equal(assertAgentContextClean({ note: 'hello' }).ok, true);
    assert.equal(assertAgentContextClean({ privateKey: 'aa'.repeat(32), authority: 'Execution Authority' }).ok, false);
    assert.equal(assertAgentCannotIssueAuthority('AGENT').ok, false);
    assert.equal(assertNoPrivilegedToolInjection('Ledger.postJournal').ok, false);
    assert.equal(assertNoPrivilegedToolInjection('getFinancialSnapshot').ok, true);

    assert.equal(CHAIN_SECURITY_POSTURE.mainnetEnabled, false);
    assert.equal(CHAIN_SECURITY_POSTURE.rpcCanReachHsm, false);
    assert.equal(assertMainnetOff(), true);

    assert.equal(CONTAINER_HARDENING_BASELINE.nonRoot, true);
    assert.equal(CONTAINER_HARDENING_BASELINE.noBakedSecrets, true);
    for (const image of REVIEWED_IMAGES) {
      assert.equal(image.nonRoot, true);
      assert.equal(image.bakedSecret, false);
      const text = readFileSync(image.dockerfile, 'utf8');
      assert.match(text, /USER /);
      assert.equal(/sk_live_|BEGIN .*PRIVATE KEY/.test(text), false);
    }

    assert.equal(SUPPLY_CHAIN_CONTROLS.pinnedGitHubActions.present, true);
    assert.equal(SUPPLY_CHAIN_CONTROLS.containerDigestPinning.requiredForRelease, true);
    assert.equal(FIELD_ENCRYPTION_INVENTORY.every((row) => row.doubleEncrypt === false), true);
  });
});

describe('Phase I Prompt 2 — baseline and threat model', () => {
  it('records mandatory controls and does not claim external audit or pentest', () => {
    assert.equal(EXTERNAL_AUDIT_COMPLETE, false);
    assert.equal(EXTERNAL_PENTEST_EXECUTED, false);
    assert.equal(PRODUCTION_READY, false);
    assert.ok(SECURITY_BASELINE_CONTROLS.length >= 12);
    assert.deepEqual([...THREAT_IDS], SYSTEM_THREAT_MODEL.map((row) => row.id));
    assert.equal(SYSTEM_THREAT_MODEL.every((row) => row.externalAuditComplete === false), true);
    void secretRef;
    void createDevelopmentHsmSimulator;
    void SUITE_SUNREY_ED25519_V1;
  });
});
