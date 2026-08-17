import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { sha256Hex } from './hash.ts';
import { SecretValue } from './redaction.ts';
import { secretRef } from './secrets.ts';
import {
  bindProviderAuthentication,
  ProviderWebhookGuard,
  redactProviderLog,
} from './regulated/index.ts';

describe('regulated provider authentication', () => {
  it('binds only secret references and redacts credentials from logs', () => {
    const binding = bindProviderAuthentication({
      providerId: 'kyc-sandbox',
      method: 'API_CREDENTIAL_REFERENCE',
      credentialRef: secretRef('simulation', 'kyc-api'),
      workloadIdentityRef: 'workload://sandbox/kyc',
    });
    assert.equal(binding.plaintextCredentialInSource, false);
    assert.equal(binding.credentialRef.href, 'secret://simulation/kyc-api');
    const logged = redactProviderLog({
      authorization: 'Bearer super-secret',
      credentialRef: binding.credentialRef.href,
      note: 'ok',
    });
    assert.deepEqual(logged, {
      authorization: '[REDACTED]',
      credentialRef: '[REDACTED]',
      note: 'ok',
    });
    assert.equal(JSON.stringify(logged).includes('super-secret'), false);
  });
});

describe('provider webhook security', () => {
  it('accepts a signed webhook once and rejects replay while remaining idempotent', () => {
    const guard = new ProviderWebhookGuard();
    const secret = new SecretValue('sandbox-webhook-secret');
    guard.registerProvider('kyc-sandbox', secret);
    const unsigned = {
      schemaVersion: 1 as const,
      providerId: 'kyc-sandbox',
      eventType: 'kyc.completed',
      timestampUtc: '2026-08-17T11:00:00.000Z',
      nonce: 'nonce-1',
      idempotencyKey: 'idemp-1',
      payloadHash: sha256Hex('body'),
    };
    const envelope = guard.sign(unsigned, secret);
    const now = Date.parse(unsigned.timestampUtc);
    const first = guard.validate(envelope, now);
    assert.deepEqual(first, { ok: true, duplicate: false });
    const replay = guard.validate(envelope, now);
    assert.deepEqual(replay, { ok: false, code: 'REPLAYED' });
    const duplicate = guard.validate(
      guard.sign({ ...unsigned, nonce: 'nonce-2', idempotencyKey: 'idemp-1' }, secret),
      now,
    );
    assert.deepEqual(duplicate, { ok: true, duplicate: true });
    const stale = guard.validate(
      guard.sign({ ...unsigned, nonce: 'nonce-3', idempotencyKey: 'idemp-3', timestampUtc: '2020-01-01T00:00:00.000Z' }, secret),
      now,
    );
    assert.deepEqual(stale, { ok: false, code: 'STALE_TIMESTAMP' });
  });
});
