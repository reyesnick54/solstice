/**
 * Minimal Chunk 94 integration. No production credentials.
 *
 * 1. create test wallet  2. receive testnet SunRey  3. submit signed transfer
 * 4. observe finality  5. receive signed webhook
 */

import {
  connectSunRey,
  createDevelopmentWallet,
  publicRegistration,
  startLocalDeveloperStack,
  DeveloperPortalApi,
  InjectedDevelopmentSigner,
  verifyWebhookSignature,
} from '../src/index.ts';

const stack = await startLocalDeveloperStack();
const portal = new DeveloperPortalApi({ transport: async (input) => {
  stack.receiver.deliveries.push({ headers: input.headers, body: input.body });
  return { ok: true };
} });

const developer = portal.registerDeveloper({ email: 'sample@example.test', displayName: 'Sample' });
const org = portal.createOrganization({ name: 'sample-org', ownerAccountId: developer.accountId });
if (!org.ok) {
  throw new Error(org.reason);
}
const app = portal.createApplication({
  actorAccountId: developer.accountId,
  organizationId: org.value.organizationId,
  name: 'sample-app',
  environment: 'SANDBOX',
  permissions: ['CHAIN_READ', 'TRANSACTION_SUBMIT', 'WEBHOOK_MANAGE', 'FAUCET_REQUEST', 'WALLET_READ_PUBLIC'],
});
if (!app.ok) {
  throw new Error(app.reason);
}
const webhook = portal.addWebhook({
  actorAccountId: developer.accountId,
  appId: app.value.appId,
  url: 'mock://local-webhook-receiver',
  events: ['transaction.finalized'],
});
if (!webhook.ok) {
  throw new Error(webhook.reason);
}

const client = connectSunRey(stack.gateway.url);
const alice = createDevelopmentWallet({ walletId: 'sample-alice' });
const bob = createDevelopmentWallet({ walletId: 'sample-bob' });
await client.wallet.register(publicRegistration(alice));
await client.wallet.register(publicRegistration(bob));
await client.faucet(alice.account.accountId, 1_000_000n);
const nonce = await client.wallet.nonce(alice.account.accountId);
const built = client.buildTransfer({
  account: alice.account,
  toAccountId: bob.account.accountId,
  toAddressText: bob.account.address.text,
  amount: 1_000n,
  maxFee: 2_000n,
  nonce: BigInt(nonce.nonce),
});
const signer = new InjectedDevelopmentSigner(alice.engine.keystore);
const signedHex = client.signLocally(signer, alice.keyId, built);
const submitted = await client.submitTransaction({
  signed_envelope_hex: signedHex,
  actor: alice.account.ownerActorId,
  from_account_id: alice.account.accountId,
  to_account_id: bob.account.accountId,
  amount: 1_000n,
});
const receipt = await client.transaction(submitted.transaction_id);
const delivered = await portal.deliverAuthorizedEvent({
  appId: app.value.appId,
  event: {
    eventId: `evt_${submitted.transaction_id}`,
    eventType: 'transaction.finalized',
    occurredAt: new Date().toISOString(),
    payload: { transaction_id: submitted.transaction_id, status: receipt.status },
  },
});
if (!delivered.ok) {
  throw new Error(delivered.reason);
}
const inbound = stack.receiver.deliveries.at(-1);
if (!inbound) {
  throw new Error('webhook missing');
}
const verified = verifyWebhookSignature({
  secret: webhook.value.signingSecret,
  deliveryId: delivered.value.deliveryId,
  eventId: delivered.value.eventId,
  timestamp: delivered.value.timestamp,
  attempt: delivered.value.attempt,
  body: inbound.body,
  signature: inbound.headers['X-SunRey-Signature'] ?? '',
});
console.log(JSON.stringify({
  environment: 'SANDBOX',
  transaction_id: submitted.transaction_id,
  finality: receipt.status,
  webhook_verified: verified.ok,
  production_credentials: false,
}));
await stack.close();
