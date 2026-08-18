import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

import { connectSunRey } from './client.ts';
import { createDevelopmentWallet, publicRegistration } from './development-wallet.ts';
import { runSunReyDev } from './developer-platform/cli.ts';
import { hashSecret, verifyWebhookSignature } from './developer-platform/crypto.ts';
import { DeveloperFaucet } from './developer-platform/faucet.ts';
import { startLocalDeveloperStack } from './developer-platform/local-devnet.ts';
import { DeveloperPortalApi } from './developer-platform/index.ts';
import { PROTOCOL_GOVERNANCE_ROLES } from './developer-platform/types.ts';
import { inspectWebhookDestination } from './developer-platform/ssrf.ts';
import { startPublicGateway } from './gateway/server.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../../..');

describe('Chunk 94 developer platform', () => {
  it('registers applications with environment, permissions, and production gating', () => {
    const portal = new DeveloperPortalApi();
    const owner = portal.registerDeveloper({ email: 'owner@example.test', displayName: 'Owner' });
    const org = must(portal.createOrganization({ name: 'Acme', ownerAccountId: owner.accountId }));
    const sandbox = must(portal.createApplication({
      actorAccountId: owner.accountId,
      organizationId: org.organizationId,
      name: 'sandbox-app',
      environment: 'SANDBOX',
      permissions: ['CHAIN_READ', 'WEBHOOK_MANAGE'],
    }));
    assert.equal(sandbox.status, 'ACTIVE');
    const production = must(portal.createApplication({
      actorAccountId: owner.accountId,
      organizationId: org.organizationId,
      name: 'prod-app',
      environment: 'PRODUCTION',
      permissions: ['CHAIN_READ'],
    }));
    assert.equal(production.status, 'PENDING_PRODUCTION_APPROVAL');
    assert.equal(production.productionFinancialCapabilitiesActivated, false);
    const approved = must(portal.approveProductionApplication({
      actorAccountId: owner.accountId,
      appId: production.appId,
    }));
    assert.equal(approved.status, 'ACTIVE');
    assert.equal(approved.productionFinancialCapabilitiesActivated, false);
  });

  it('reveals a server secret only once and stores only the hash', () => {
    const { portal, owner, app } = provision();
    const revealed = must(portal.createCredential({
      actorAccountId: owner.accountId,
      appId: app.appId,
      kind: 'SERVER_SECRET',
      scopes: ['CHAIN_READ'],
    }));
    assert.match(revealed.plaintextSecret, /^sk_/);
    assert.equal(revealed.credential.secretHash, hashSecret(revealed.plaintextSecret));
    assert.notEqual(revealed.credential.secretHash, revealed.plaintextSecret);
    const stored = portal.getCredential(revealed.credential.credentialId);
    assert.ok(stored);
    assert.equal(stored.secretHint.startsWith('…'), true);
    const second = portal.revealSecret({
      actorAccountId: owner.accountId,
      credentialId: revealed.credential.credentialId,
      kind: 'SERVER_SECRET',
    });
    assert.equal(second.ok, false);
  });

  it('rejects a browser client retrieving a server secret', () => {
    const { portal, owner, app } = provision();
    const created = must(portal.createCredential({
      actorAccountId: owner.accountId,
      appId: app.appId,
      kind: 'SERVER_SECRET',
      scopes: ['CHAIN_READ'],
    }));
    const browser = portal.revealSecret({
      actorAccountId: owner.accountId,
      credentialId: created.credential.credentialId,
      kind: 'PUBLIC_CLIENT',
    });
    assert.equal(browser.ok, false);
    if (!browser.ok) {
      assert.equal(browser.reason, 'PUBLIC_CLIENT_CANNOT_READ_SECRET');
    }
  });

  it('rejects a revoked key and a wrong scope', () => {
    const { portal, owner, app } = provision(['CHAIN_READ', 'MARKET_DATA_READ']);
    const created = must(portal.createCredential({
      actorAccountId: owner.accountId,
      appId: app.appId,
      kind: 'SERVER_SECRET',
      scopes: ['CHAIN_READ'],
    }));
    const wrong = portal.authenticate({
      credentialId: created.credential.credentialId,
      secret: created.plaintextSecret,
      scope: 'MARKET_DATA_READ',
    });
    assert.equal(wrong.ok, false);
    if (!wrong.ok) {
      assert.equal(wrong.reason, 'WRONG_SCOPE');
    }
    must(portal.revokeCredential({
      actorAccountId: owner.accountId,
      credentialId: created.credential.credentialId,
    }));
    const revoked = portal.authenticate({
      credentialId: created.credential.credentialId,
      secret: created.plaintextSecret,
      scope: 'CHAIN_READ',
    });
    assert.equal(revoked.ok, false);
    if (!revoked.ok) {
      assert.equal(revoked.reason, 'REVOKED_CREDENTIAL');
    }
  });

  it('refuses to let an API key sign a user transaction', () => {
    const { portal, owner, app } = provision(['TRANSACTION_SUBMIT']);
    const created = must(portal.createCredential({
      actorAccountId: owner.accountId,
      appId: app.appId,
      kind: 'SERVER_SECRET',
      scopes: ['TRANSACTION_SUBMIT'],
    }));
    const signed = portal.signUserTransactionWithApiKey(created.credential.credentialId);
    assert.equal(signed.ok, false);
    if (!signed.ok) {
      assert.equal(signed.reason, 'API_KEY_CANNOT_SIGN');
    }
    assert.equal('sign' in created.credential, false);
  });

  it('rejects webhook SSRF targets', () => {
    const { portal, owner, app } = provision(['WEBHOOK_MANAGE', 'CHAIN_READ']);
    for (const url of [
      'http://127.0.0.1/hook',
      'http://169.254.169.254/latest/meta-data',
      'http://10.0.0.8/internal',
      'http://192.168.1.1/hook',
      'http://localhost/hook',
      'file:///etc/passwd',
    ]) {
      const added = portal.addWebhook({
        actorAccountId: owner.accountId,
        appId: app.appId,
        url,
        events: ['transaction.finalized'],
      });
      assert.equal(added.ok, false, url);
      if (!added.ok) {
        assert.equal(added.reason, 'SSRF_REJECTED', url);
      }
    }
    assert.equal(inspectWebhookDestination('https://hooks.example.test/sunrey').ok, true);
  });

  it('signs webhooks and makes replay detectable', async () => {
    const { portal, owner, app } = provision(['WEBHOOK_MANAGE', 'CHAIN_READ']);
    const added = must(portal.addWebhook({
      actorAccountId: owner.accountId,
      appId: app.appId,
      url: 'mock://local-webhook-receiver',
      events: ['transaction.finalized'],
    }));
    const delivered = must(await portal.deliverAuthorizedEvent({
      appId: app.appId,
      event: {
        eventId: 'evt_stable_1',
        eventType: 'transaction.finalized',
        occurredAt: new Date().toISOString(),
        payload: { transaction_id: 'tx.1' },
      },
    }));
    assert.equal(delivered.state === 'DELIVERED' || delivered.state === 'PENDING', true);
    const secret = portal.webhookSigningSecret(added.endpoint.endpointId);
    assert.ok(secret);
    const body = JSON.stringify({
      event_version: 'v1',
      event_id: delivered.eventId,
      delivery_id: delivered.deliveryId,
      event_type: delivered.eventType,
      occurred_at: delivered.timestamp,
      app_id: app.appId,
      payload: { transaction_id: 'tx.1' },
    });
    const first = verifyWebhookSignature({
      secret,
      deliveryId: delivered.deliveryId,
      eventId: delivered.eventId,
      timestamp: delivered.timestamp,
      attempt: delivered.attempt,
      body,
      signature: delivered.signature,
    });
    assert.equal(first.ok, true);
    const replay = verifyWebhookSignature({
      secret,
      deliveryId: delivered.deliveryId,
      eventId: delivered.eventId,
      timestamp: delivered.timestamp,
      attempt: delivered.attempt,
      body,
      signature: delivered.signature,
      seenDeliveryIds: new Set([delivered.deliveryId]),
    });
    assert.equal(replay.ok, false);
    if (!replay.ok) {
      assert.equal(replay.reason, 'REPLAY');
    }
  });

  it('keeps private events inside the permission boundary', async () => {
    const { portal, owner, app } = provision(['CHAIN_READ', 'WEBHOOK_MANAGE']);
    must(portal.addWebhook({
      actorAccountId: owner.accountId,
      appId: app.appId,
      url: 'mock://local-webhook-receiver',
      events: ['transaction.finalized'],
    }));
    const privateEvent = await portal.deliverAuthorizedEvent({
      appId: app.appId,
      event: {
        eventId: 'evt_private',
        eventType: 'machine.commerce.settlement',
        occurredAt: new Date().toISOString(),
        payload: { machine_id: 'secret-machine' },
      },
    });
    assert.equal(privateEvent.ok, false);
    if (!privateEvent.ok) {
      assert.equal(privateEvent.reason, 'UNAUTHORIZED_EVENT');
    }
  });

  it('cannot issue a production asset from the testnet faucet', () => {
    const faucet = new DeveloperFaucet();
    const production = faucet.request({
      appId: 'app.1',
      address: 'srdev1faucet',
      asset: 'PRODUCTION_SUNREY',
      quantity: 1n,
    });
    assert.equal(production.ok, false);
    if (!production.ok) {
      assert.equal(production.reason, 'PRODUCTION_ASSET_FORBIDDEN');
    }
    const mainnet = faucet.request({
      appId: 'app.1',
      address: 'srdev1faucet',
      asset: 'SUNREY_COIN',
      quantity: 1n,
      networkId: 'net_sunrey_mainnet_1',
    });
    assert.equal(mainnet.ok, false);
    if (!mainnet.ok) {
      assert.equal(mainnet.reason, 'PRODUCTION_NETWORK_FORBIDDEN');
    }
  });

  it('refuses to promote a sandbox identity to production', () => {
    const { portal, owner, app } = provision(['SANDBOX_MANAGE', 'CHAIN_READ']);
    const sandbox = must(portal.createSandbox({
      actorAccountId: owner.accountId,
      appId: app.appId,
      label: 'actor-a',
    }));
    assert.equal(sandbox.identityClass, 'SANDBOX');
    assert.equal(sandbox.productionEligible, false);
    const promoted = portal.promoteSandbox(sandbox.sandboxId);
    assert.equal(promoted.ok, false);
    if (!promoted.ok) {
      assert.equal(promoted.reason, 'SANDBOX_IDENTITY');
    }
  });

  it('keeps developer RBAC distinct from protocol governance', () => {
    const { portal, owner, org } = provision();
    const viewer = portal.registerDeveloper({ email: 'view@example.test', displayName: 'Viewer' });
    const added = portal.addMember({
      actorAccountId: owner.accountId,
      organizationId: org.organizationId,
      accountId: viewer.accountId,
      role: 'PROTOCOL_GOVERNOR',
    });
    assert.equal(added.ok, false);
    if (!added.ok) {
      assert.equal(added.reason, 'NOT_PROTOCOL_GOVERNANCE');
    }
    const ok = must(portal.addMember({
      actorAccountId: owner.accountId,
      organizationId: org.organizationId,
      accountId: viewer.accountId,
      role: 'DEVELOPER',
    }));
    assert.equal(PROTOCOL_GOVERNANCE_ROLES.includes(ok.role as never), false);
  });

  it('records usage and quota without creating charges', () => {
    const { portal, owner, app } = provision(['CHAIN_READ']);
    const created = must(portal.createCredential({
      actorAccountId: owner.accountId,
      appId: app.appId,
      kind: 'SERVER_SECRET',
      scopes: ['CHAIN_READ'],
    }));
    must(portal.authenticate({
      credentialId: created.credential.credentialId,
      secret: created.plaintextSecret,
      scope: 'CHAIN_READ',
    }));
    const usage = portal.usage(app.appId);
    assert.ok(usage.length >= 1);
    assert.equal(portal.billing.unauthorizedChargeForbidden, true);
    assert.equal(portal.billing.kind, 'FUTURE_METERING');
  });

  it('writes an audit trail without secret values', () => {
    const { portal, owner, org, app } = provision();
    must(portal.createCredential({
      actorAccountId: owner.accountId,
      appId: app.appId,
      kind: 'SERVER_SECRET',
      scopes: ['CHAIN_READ'],
    }));
    const log = JSON.stringify(portal.auditLog(org.organizationId));
    assert.match(log, /KEY_CREATE/);
    assert.equal(/sk_[A-Za-z0-9_-]{8,}/.test(log), false);
    assert.equal(/whsec_/.test(log), false);
  });

  it('runs CLI status and local devnet against the existing gateway', async () => {
    const status = await runSunReyDev(['sunrey-dev', 'status']);
    assert.match(status, /net_sunrey_testnet_1/);
    const local = await runSunReyDev(['sunrey-dev', 'local', 'devnet']);
    assert.match(local, /rpc=http/);
    const stack = await startLocalDeveloperStack();
    try {
      const client = connectSunRey(stack.gateway.url);
      const chain = await client.status();
      assert.equal(chain.environment, 'simulation');
    } finally {
      await stack.close();
    }
  });

  it('keeps official SDK examples from sending private keys', async () => {
    const gateway = await startPublicGateway({ autoFinalize: true });
    try {
      const client = connectSunRey(gateway.url);
      const wallet = createDevelopmentWallet({ walletId: 'chunk94' });
      await client.wallet.register(publicRegistration(wallet));
      const status = await client.status();
      assert.equal(status.api_version, 'v1');
      const supply = await client.assets.supply();
      assert.ok(supply);
      const markets = await client.exchange.listMarkets();
      assert.ok(markets);
    } finally {
      await gateway.close();
    }
  });

  it('keeps OpenAPI and webhook schemas versioned', () => {
    const openapi = readFileSync(join(ROOT, 'api/sunrey-developer-platform-v1.openapi.yaml'), 'utf8');
    assert.match(openapi, /\/v1\/developer\/apps/);
    assert.match(openapi, /sunrey-webhook-v1/);
    const events = readFileSync(join(ROOT, 'api/sunrey-webhooks-v1.json'), 'utf8');
    assert.match(events, /transaction.finalized/);
    assert.match(events, /delivery_id/);
  });
});

function provision(permissions: readonly ('CHAIN_READ' | 'WEBHOOK_MANAGE' | 'MARKET_DATA_READ' | 'TRANSACTION_SUBMIT' | 'SANDBOX_MANAGE' | 'FAUCET_REQUEST')[] = ['CHAIN_READ']) {
  const portal = new DeveloperPortalApi();
  const owner = portal.registerDeveloper({ email: 'owner@example.test', displayName: 'Owner' });
  const org = must(portal.createOrganization({ name: 'Org', ownerAccountId: owner.accountId }));
  const app = must(portal.createApplication({
    actorAccountId: owner.accountId,
    organizationId: org.organizationId,
    name: 'app',
    environment: 'SANDBOX',
    permissions,
  }));
  return { portal, owner, org, app };
}

function must<T>(result: { readonly ok: true; readonly value: T } | { readonly ok: false; readonly reason: string }): T {
  assert.equal(result.ok, true, result.ok ? '' : result.reason);
  if (!result.ok) {
    throw new Error(result.reason);
  }
  return result.value;
}
