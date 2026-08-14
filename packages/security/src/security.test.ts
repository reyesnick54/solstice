import assert from 'node:assert/strict';
import { chmodSync, mkdtempSync, readFileSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { inspect } from 'node:util';
import { describe, it } from 'node:test';

import { ALGORITHM_NOTES } from './algorithms.ts';
import { parseSecretReference, secretRef, InMemorySecretProvider } from './secrets.ts';
import {
  AccessToken,
  PrivateKeyMaterial,
  SecretValue,
  SessionSecret,
  WrappedCredential,
} from './redaction.ts';
import { createSimulationKeyProvider, SimulationKeyProvider } from './simulation.ts';
import { UnavailableKeyProvider } from './unavailable.ts';
import {
  ServiceIdentityRegistry,
  assertServiceCapability,
  type ServiceIdentity,
} from './identity.ts';
import type { SecurityAuditPayload } from './audit.ts';

describe('canonical algorithms', () => {
  it('documents standard primitives only', () => {
    assert.match(ALGORITHM_NOTES.signing, /HMAC-SHA256/);
    assert.match(ALGORITHM_NOTES.hashing, /SHA-256/);
    assert.match(ALGORITHM_NOTES.encryption, /AES-256-GCM/);
    assert.match(ALGORITHM_NOTES.random, /randomBytes/);
  });
});

describe('KeyProvider sign / verify', () => {
  it('signs and verifies with HMAC-SHA256', () => {
    const keys = SimulationKeyProvider.fromHmacSecret('test-ea-secret');
    const payload = 'authority-canonical\nOPEN_ACCOUNT';
    const signed = keys.sign('EXECUTION_AUTHORITY_SIGNING', payload);
    assert.equal(signed.ok, true);
    if (!signed.ok) return;
    const verified = keys.verify('EXECUTION_AUTHORITY_SIGNING', payload, signed.value.hex);
    assert.equal(verified.ok, true);
    if (verified.ok) {
      assert.equal(verified.value.version, 1);
    }
  });

  it('rejects an invalid signature', () => {
    const keys = SimulationKeyProvider.fromHmacSecret('test-ea-secret');
    const result = keys.verify('EXECUTION_AUTHORITY_SIGNING', 'payload', '00'.repeat(32));
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.error.code, 'SIGNATURE_INVALID');
    }
  });

  it('rejects a signature from the wrong key', () => {
    const a = SimulationKeyProvider.fromHmacSecret('key-a');
    const b = SimulationKeyProvider.fromHmacSecret('key-b');
    const signed = a.sign('EXECUTION_AUTHORITY_SIGNING', 'same-payload');
    assert.equal(signed.ok, true);
    if (!signed.ok) return;
    const verified = b.verify('EXECUTION_AUTHORITY_SIGNING', 'same-payload', signed.value.hex);
    assert.equal(verified.ok, false);
    if (!verified.ok) {
      assert.equal(verified.error.code, 'SIGNATURE_INVALID');
    }
  });
});

describe('key rotation and lifecycle', () => {
  it('rotates: new signatures use v2; historical v1 still verifies; retire and revoke fail closed', () => {
    const audits: SecurityAuditPayload[] = [];
    const keys = createSimulationKeyProvider({
      events: { emit: (payload) => audits.push(payload) },
    });
    const payload = 'rotate-me';
    const v1 = keys.sign('EXECUTION_AUTHORITY_SIGNING', payload);
    assert.equal(v1.ok, true);
    if (!v1.ok) return;
    assert.equal(v1.value.keyVersion, 1);

    const rotated = keys.rotateKey('EXECUTION_AUTHORITY_SIGNING');
    assert.equal(rotated.ok, true);
    if (!rotated.ok) return;
    assert.equal(rotated.value.version, 2);
    assert.equal(rotated.value.status, 'ACTIVE');
    assert.equal(keys.keyStatus('EXECUTION_AUTHORITY_SIGNING', 1).ok && keys.keyStatus('EXECUTION_AUTHORITY_SIGNING', 1).ok, true);
    const v1Status = keys.keyStatus('EXECUTION_AUTHORITY_SIGNING', 1);
    assert.equal(v1Status.ok && v1Status.value.status, 'DEPRECATED');

    const v2 = keys.sign('EXECUTION_AUTHORITY_SIGNING', payload);
    assert.equal(v2.ok, true);
    if (!v2.ok) return;
    assert.equal(v2.value.keyVersion, 2);
    assert.notEqual(v2.value.hex, v1.value.hex);

    const historical = keys.verify('EXECUTION_AUTHORITY_SIGNING', payload, v1.value.hex);
    assert.equal(historical.ok, true);
    if (historical.ok) {
      assert.equal(historical.value.version, 1);
    }
    const current = keys.verify('EXECUTION_AUTHORITY_SIGNING', payload, v2.value.hex);
    assert.equal(current.ok, true);

    const cannotSignOld = keys.sign('EXECUTION_AUTHORITY_SIGNING', payload, 1);
    assert.equal(cannotSignOld.ok, false);

    const retired = keys.retireKey('EXECUTION_AUTHORITY_SIGNING', 1);
    assert.equal(retired.ok, true);
    const retiredVerify = keys.verify('EXECUTION_AUTHORITY_SIGNING', payload, v1.value.hex, 1);
    assert.equal(retiredVerify.ok, false);
    if (!retiredVerify.ok) {
      assert.equal(retiredVerify.error.code, 'KEY_RETIRED');
    }

    const revoked = keys.revokeKey('EXECUTION_AUTHORITY_SIGNING', 2);
    assert.equal(revoked.ok, true);
    const revokedSign = keys.sign('EXECUTION_AUTHORITY_SIGNING', payload);
    assert.equal(revokedSign.ok, false);
    if (!revokedSign.ok) {
      assert.equal(revokedSign.error.code, 'KEY_REVOKED');
    }
    const revokedVerify = keys.verify('EXECUTION_AUTHORITY_SIGNING', payload, v2.value.hex, 2);
    assert.equal(revokedVerify.ok, false);
    if (!revokedVerify.ok) {
      assert.equal(revokedVerify.error.code, 'KEY_REVOKED');
    }

    assert.ok(audits.some((row) => row.kind === 'security.key.rotated'));
    assert.ok(audits.some((row) => row.kind === 'security.key.retired'));
    assert.ok(audits.some((row) => row.kind === 'security.key.revoked'));
    for (const row of audits) {
      assert.equal('material' in row, false);
      assert.equal('secret' in row, false);
      assert.ok(row.providerRef.startsWith('secret://'));
    }
  });
});

describe('envelope encryption', () => {
  it('round-trips plaintext and fails closed on tamper or wrong key', () => {
    const keys = createSimulationKeyProvider();
    const plaintext = Buffer.from('sensitive-customer-note', 'utf8');
    const sealed = keys.encrypt('DATA_ENCRYPTION', plaintext);
    assert.equal(sealed.ok, true);
    if (!sealed.ok) return;
    assert.equal(sealed.value.algorithm, 'AES-256-GCM');
    assert.equal(sealed.value.schemaVersion, 1);

    const opened = keys.decrypt(sealed.value);
    assert.equal(opened.ok, true);
    if (opened.ok) {
      assert.equal(opened.value.toString('utf8'), 'sensitive-customer-note');
    }

    const flipped = Buffer.from(sealed.value.ciphertext, 'base64');
    flipped[0] = (flipped[0] ?? 0) ^ 0xff;
    const tampered = { ...sealed.value, ciphertext: flipped.toString('base64') };
    const authFail = keys.decrypt(tampered);
    assert.equal(authFail.ok, false);
    if (!authFail.ok) {
      assert.ok(
        authFail.error.code === 'AUTHENTICATION_FAILED' ||
          authFail.error.code === 'CIPHERTEXT_MALFORMED',
      );
    }

    const other = createSimulationKeyProvider();
    const wrong = other.decrypt(sealed.value);
    assert.equal(wrong.ok, false);

    const wrongPurpose = keys.encrypt('EXECUTION_AUTHORITY_SIGNING', plaintext);
    assert.equal(wrongPurpose.ok, false);
    if (!wrongPurpose.ok) {
      assert.equal(wrongPurpose.error.code, 'PURPOSE_MISMATCH');
    }
  });
});

describe('secret references and redaction', () => {
  it('parses secret:// references and resolves without exposing plaintext', () => {
    const parsed = parseSecretReference('secret://simulation/execution-authority-signing');
    assert.equal(parsed.ok, true);
    if (!parsed.ok) return;
    assert.equal(parsed.value.provider, 'simulation');
    assert.equal(parsed.value.path, 'execution-authority-signing');

    const provider = new InMemorySecretProvider('simulation', {
      'execution-authority-signing': 'dev-only-value',
    });
    const resolved = provider.resolve(parsed.value);
    assert.equal(resolved.ok, true);
    if (!resolved.ok) return;
    assert.equal(resolved.value.toString(), '[REDACTED]');
    assert.equal(JSON.stringify(resolved.value), '"[REDACTED]"');
    assert.equal(inspect(resolved.value), '[REDACTED]');
    assert.equal(resolved.value.revealUtf8(), 'dev-only-value');

    const missing = parseSecretReference('https://example/secret');
    assert.equal(missing.ok, false);
  });

  it('redacts SecretValue, PrivateKeyMaterial, AccessToken, SessionSecret, WrappedCredential', () => {
    const samples = [
      new SecretValue('plain-secret'),
      new PrivateKeyMaterial('-----BEGIN ' + 'PRIVATE KEY-----fake'),
      new AccessToken('tok_live_example'),
      new SessionSecret('session-bytes'),
      new WrappedCredential('wrapped'),
    ];
    for (const sample of samples) {
      assert.equal(String(sample), '[REDACTED]');
      assert.equal(JSON.stringify(sample), '"[REDACTED]"');
      assert.equal(inspect(sample), '[REDACTED]');
    }
  });
});

describe('fail closed', () => {
  it('fails closed for missing, unknown version, revoked, unavailable, and expired credential', () => {
    const keys = createSimulationKeyProvider();
    const missing = keys.sign('WEBHOOK_SIGNING', 'x', 99);
    assert.equal(missing.ok, false);
    if (!missing.ok) {
      assert.equal(missing.error.code, 'KEY_VERSION_UNKNOWN');
    }

    keys.revokeKey('SESSION_SIGNING', 1);
    const revoked = keys.verify('SESSION_SIGNING', 'x', '00'.repeat(32), 1);
    assert.equal(revoked.ok, false);
    if (!revoked.ok) {
      assert.equal(revoked.error.code, 'KEY_REVOKED');
    }

    const down = new UnavailableKeyProvider();
    const unavailable = down.sign('EXECUTION_AUTHORITY_SIGNING', 'x');
    assert.equal(unavailable.ok, false);
    if (!unavailable.ok) {
      assert.equal(unavailable.error.code, 'PROVIDER_UNAVAILABLE');
    }

    const registry = new ServiceIdentityRegistry();
    const identity: ServiceIdentity = {
      serviceId: 'svc_accounts',
      serviceRole: 'ACCOUNTS_SERVICE',
      credentialRef: secretRef('simulation', 'svc/accounts'),
      allowedCapabilities: ['SUBMIT_INTENT'],
      expiresAt: '2020-01-01T00:00:00.000Z',
      keyVersion: 1,
      status: 'ACTIVE',
    };
    registry.put(identity);
    const expired = assertServiceCapability(identity, 'SUBMIT_INTENT', '2026-08-14T00:00:00.000Z');
    assert.equal(expired.ok, false);
    if (!expired.ok) {
      assert.equal(expired.error.code, 'CREDENTIAL_EXPIRED');
    }
  });
});

describe('simulation provider labeling and local persist', () => {
  it('labels itself DEVELOPMENT/SIMULATION and writes 0600 key files', () => {
    const dir = mkdtempSync(join(tmpdir(), 'solstice-sim-keys-'));
    const path = join(dir, 'keys.json');
    const keys = createSimulationKeyProvider({ persistPath: path });
    assert.match(keys.environmentLabel, /DEVELOPMENT\/SIMULATION/);
    keys.rotateKey('DATA_ENCRYPTION');
    const mode = statSync(path).mode & 0o777;
    assert.equal(mode, 0o600);
    const disk = readFileSync(path, 'utf8');
    assert.match(disk, /DEVELOPMENT\/SIMULATION/);
    chmodSync(path, 0o600);
  });
});
