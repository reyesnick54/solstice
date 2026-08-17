import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { connectSunRey } from './client.ts';
import { createDevelopmentWallet, publicRegistration } from './development-wallet.ts';
import { startPublicGateway } from './gateway/server.ts';
import { SdkHttpError } from './http.ts';
import { CLASSICAL_SUITE_ID, HYBRID_SUITE_ID } from './ids.ts';
import { PUBLIC_REQUEST_LIMITS } from './limits.ts';
import { encodeCursor } from './pagination.ts';

async function post(url: string, path: string, body: unknown, headers: Record<string, string> = {}): Promise<Response> {
  return fetch(`${url}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
}

describe('SunRey developer API security', () => {
  it('never transmits a private key to public RPC and rejects the field', async () => {
    const gateway = await startPublicGateway();
    try {
      const response = await post(gateway.url, '/v1/accounts', {
        account_id: 'bca.evil',
        address: 'srdev1aaa',
        public_key_hex: 'aa',
        suite_id: CLASSICAL_SUITE_ID,
        private_key: 'should-never-be-accepted',
      });
      assert.equal(response.status, 403);
      const body = await response.json() as { readonly error_code: string };
      assert.equal(body.error_code, 'PRIVATE_KEY_REJECTED');
    } finally {
      await gateway.close();
    }
  });

  it('keeps operator API off the public namespace', async () => {
    const gateway = await startPublicGateway();
    try {
      const admin = await fetch(`${gateway.url}/v1/admin/produce-block`, { method: 'POST' });
      assert.equal(admin.status, 403);
      const signer = await fetch(`${gateway.url}/v1/validator/signer`);
      assert.equal(signer.status, 403);
      const unauth = await fetch(`${gateway.url}/operator/v1/produce-block`, { method: 'POST' });
      assert.equal(unauth.status, 403);
      const authorized = await fetch(`${gateway.url}/operator/v1/produce-block`, {
        method: 'POST',
        headers: { 'x-sunrey-operator-token': gateway.platform.operatorToken },
      });
      assert.equal(authorized.status, 200);
    } finally {
      await gateway.close();
    }
  });

  it('rejects oversized requests', async () => {
    const gateway = await startPublicGateway();
    try {
      const huge = 'a'.repeat(PUBLIC_REQUEST_LIMITS.maximumBodyBytes + 8);
      const response = await post(gateway.url, '/v1/transactions', { signed_envelope_hex: huge });
      assert.equal(response.status, 400);
      const body = await response.json() as { readonly error_code: string };
      assert.equal(body.error_code, 'OVERSIZED_REQUEST');
    } finally {
      await gateway.close();
    }
  });

  it('rejects an invalid pagination cursor', async () => {
    const gateway = await startPublicGateway();
    try {
      const response = await fetch(`${gateway.url}/v1/chain/blocks?cursor=not-a-cursor`);
      assert.equal(response.status, 400);
      const body = await response.json() as { readonly error_code: string };
      assert.equal(body.error_code, 'INVALID_PAGINATION_CURSOR');
    } finally {
      await gateway.close();
    }
  });

  it('bounds the rate-limit path', async () => {
    const gateway = await startPublicGateway();
    try {
      let limited = false;
      for (let i = 0; i < PUBLIC_REQUEST_LIMITS.rateLimitPerMinute + 5; i += 1) {
        const response = await fetch(`${gateway.url}/v1/chain/status`);
        if (response.status === 429) {
          limited = true;
          const body = await response.json() as { readonly error_code: string };
          assert.equal(body.error_code, 'RATE_LIMITED');
          break;
        }
      }
      assert.equal(limited, true);
    } finally {
      await gateway.close();
    }
  });

  it('rejects a wrong-network transaction', async () => {
    const gateway = await startPublicGateway();
    try {
      const response = await post(gateway.url, '/v1/transactions', {
        signed_envelope_hex: '0a',
        network_id: 'net_other_chain',
      });
      assert.equal(response.status, 400);
      const body = await response.json() as { readonly error_code: string };
      assert.equal(body.error_code, 'WRONG_NETWORK');
    } finally {
      await gateway.close();
    }
  });

  it('rejects an unknown API version', async () => {
    const gateway = await startPublicGateway();
    try {
      const response = await fetch(`${gateway.url}/v9/chain/status`);
      assert.equal(response.status, 404);
      const body = await response.json() as { readonly error_code: string };
      assert.equal(body.error_code, 'UNKNOWN_API_VERSION');
    } finally {
      await gateway.close();
    }
  });

  it('retries submit with the same transaction id and does not duplicate', async () => {
    const gateway = await startPublicGateway();
    try {
      const client = connectSunRey(gateway.url);
      const alice = createDevelopmentWallet({ walletId: 'retry-alice' });
      const bob = createDevelopmentWallet({ walletId: 'retry-bob' });
      await client.wallet.register(publicRegistration(alice));
      await client.wallet.register(publicRegistration(bob));
      await client.faucet(alice.account.accountId, 50_000n);
      const built = client.buildTransfer({
        account: alice.account,
        toAccountId: bob.account.accountId,
        toAddressText: bob.account.address.text,
        amount: 10n,
        maxFee: 2_000n,
        nonce: 0n,
      });
      const first = await client.submitTransaction({
        signed_envelope_hex: built.unsigned_envelope_hex,
        idempotency_key: 'same-key',
        from_account_id: alice.account.accountId,
        to_account_id: bob.account.accountId,
        amount: 10n,
      });
      const second = await client.submitTransaction({
        signed_envelope_hex: built.unsigned_envelope_hex,
        idempotency_key: 'same-key',
        previous_transaction_id: first.transaction_id,
        from_account_id: alice.account.accountId,
        to_account_id: bob.account.accountId,
        amount: 10n,
      });
      assert.equal(second.transaction_id, first.transaction_id);
      assert.equal(second.submission_status, 'KNOWN');
      const conflict = await post(gateway.url, '/v1/transactions', {
        signed_envelope_hex: `${built.unsigned_envelope_hex}ff`,
        idempotency_key: 'same-key',
        actor: 'public',
      });
      assert.equal(conflict.status, 400);
      const body = await conflict.json() as { readonly error_code: string };
      assert.equal(body.error_code, 'IDEMPOTENCY_CONFLICT');
    } finally {
      await gateway.close();
    }
  });

  it('resumes events from a cursor', async () => {
    const gateway = await startPublicGateway();
    try {
      const client = connectSunRey(gateway.url);
      const first = await client.events.replay();
      assert.ok(first.events.length > 0);
      const again = await client.events.replay({ cursor: first.cursor });
      assert.equal(again.events.length, 0);
      const invalid = await fetch(`${gateway.url}/v1/events?format=json&cursor=nope`);
      assert.equal(invalid.status, 400);
    } finally {
      await gateway.close();
    }
  });

  it('does not expose raw PDV, clean-room, or consent payloads', async () => {
    const gateway = await startPublicGateway();
    try {
      const response = await fetch(`${gateway.url}/v1/chain/status`);
      const text = await response.text();
      assert.equal(text.includes('rawPdv'), false);
      assert.equal(text.includes('raw_pdv'), false);
      assert.equal(text.includes('cleanRoomRow'), false);
      assert.equal(text.includes('consentPayload'), false);
      const rejected = await post(gateway.url, '/v1/accounts', {
        account_id: 'bca.pdv',
        address: 'srdev1aaa',
        public_key_hex: 'aa',
        suite_id: CLASSICAL_SUITE_ID,
        raw_pdv: 'secret-person-data',
      });
      assert.equal(rejected.status, 403);
    } finally {
      await gateway.close();
    }
  });

  it('rejects CryptoSuite downgrade', async () => {
    const gateway = await startPublicGateway();
    try {
      const client = connectSunRey(gateway.url);
      await client.wallet.register({
        account_id: 'bca.suite',
        address: 'srdev1suite',
        public_key_hex: 'aa',
        suite_id: HYBRID_SUITE_ID,
        authorization_policy: 'SINGLE_SIGNATURE',
      });
      await assert.rejects(
        () => client.wallet.register({
          account_id: 'bca.suite',
          address: 'srdev1suite',
          public_key_hex: 'aa',
          suite_id: CLASSICAL_SUITE_ID,
        }),
        (error: unknown) => error instanceof SdkHttpError && error.envelope?.error_code === 'CRYPTO_SUITE_DOWNGRADE',
      );
    } finally {
      await gateway.close();
    }
  });

  it('accepts a valid opaque cursor after data exists', async () => {
    const gateway = await startPublicGateway({ autoFinalize: true });
    try {
      await post(gateway.url, '/v1/transactions', { signed_envelope_hex: 'abcd', network_id: gateway.networkId });
      const cursor = encodeCursor({ namespace: 'blocks', offset: 0, height: 1 });
      const response = await fetch(`${gateway.url}/v1/chain/blocks?cursor=${cursor}`);
      assert.equal(response.status, 200);
    } finally {
      await gateway.close();
    }
  });
});
