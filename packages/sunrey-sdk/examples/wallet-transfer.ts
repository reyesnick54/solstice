import { connectSunRey, createDevelopmentWallet, publicRegistration, startPublicGateway } from '../src/index.ts';

const gateway = await startPublicGateway();
const client = connectSunRey(gateway.url);
const alice = createDevelopmentWallet({ walletId: 'ex-alice' });
const bob = createDevelopmentWallet({ walletId: 'ex-bob' });
await client.wallet.register(publicRegistration(alice));
await client.wallet.register(publicRegistration(bob));
await client.faucet(alice.account.accountId, 100_000n);
const nonce = await client.wallet.nonce(alice.account.accountId);
const built = client.buildTransfer({
  account: alice.account,
  toAccountId: bob.account.accountId,
  toAddressText: bob.account.address.text,
  amount: 1_000n,
  maxFee: 500n,
  nonce: BigInt(nonce.nonce),
});
const submitted = await client.submitTransaction({
  signed_envelope_hex: built.unsigned_envelope_hex,
  from_account_id: alice.account.accountId,
  to_account_id: bob.account.accountId,
  amount: 1_000n,
});
console.log(JSON.stringify({ transaction_id: submitted.transaction_id, status: submitted.submission_status }));
await gateway.close();
