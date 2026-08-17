/**
 * Executable beginner quickstart.
 *
 * 1. install SDK  2. connect  3. create wallet  4. faucet
 * 5. holdings  6. build transfer  7. estimate fee  8. sign locally
 * 9. submit  10. subscribe finality  11. query receipt
 */

import { connectSunRey } from './client.ts';
import { createDevelopmentWallet, publicRegistration } from './development-wallet.ts';
import { startPublicGateway } from './gateway/server.ts';
import { InjectedDevelopmentSigner } from './signer.ts';

export async function runQuickstart(): Promise<{
  readonly transactionId: string;
  readonly status: string;
  readonly aliceAvailable: string;
  readonly bobAvailable: string;
  readonly events: number;
}> {
  const gateway = await startPublicGateway({ autoFinalize: true });
  try {
    const client = connectSunRey(gateway.url);
    const alice = createDevelopmentWallet({ walletId: 'alice', signerLabels: ['alice.primary'] });
    const bob = createDevelopmentWallet({ walletId: 'bob', signerLabels: ['bob.primary'] });
    await client.wallet.register(publicRegistration(alice));
    await client.wallet.register(publicRegistration(bob));
    await client.faucet(alice.account.accountId, 1_000_000n);
    const before = await client.assets.holdings(alice.account.accountId);
    const nonce = await client.wallet.nonce(alice.account.accountId);
    const built = client.buildTransfer({
      account: alice.account,
      toAccountId: bob.account.accountId,
      toAddressText: bob.account.address.text,
      amount: 25_000n,
      maxFee: 2_000n,
      nonce: BigInt(nonce.nonce),
    });
    const fee = await client.fees.estimate();
    const signer = new InjectedDevelopmentSigner(alice.engine.keystore);
    const signedHex = client.signLocally(signer, alice.keyId, built);
    const submitted = await client.submitTransaction({
      signed_envelope_hex: signedHex,
      actor: alice.account.ownerActorId,
      idempotency_key: `idem.${built.client_tx_id}`,
      from_account_id: alice.account.accountId,
      to_account_id: bob.account.accountId,
      amount: 25_000n,
    });
    const replayed = await client.events.replay({ subscribe: ['newFinalizedBlock', 'transactionStatus'] });
    const receipt = await client.transaction(submitted.transaction_id);
    const afterAlice = await client.assets.holdings(alice.account.accountId);
    const afterBob = await client.assets.holdings(bob.account.accountId);
    console.log('SunRey developer quickstart');
    console.log(`rpc=${gateway.url}`);
    console.log(`alice_holdings_before=${before.holdings[0]?.available}`);
    console.log(`estimated_fee=${fee.estimatedFee}`);
    console.log(`transaction_id=${submitted.transaction_id}`);
    console.log(`submission_status=${submitted.submission_status}`);
    console.log(`finality_events=${replayed.events.length}`);
    console.log(`receipt_status=${receipt.status}`);
    console.log(`alice_after=${afterAlice.holdings[0]?.available}`);
    console.log(`bob_after=${afterBob.holdings[0]?.available}`);
    return {
      transactionId: submitted.transaction_id,
      status: receipt.status,
      aliceAvailable: afterAlice.holdings[0]?.available ?? '0',
      bobAvailable: afterBob.holdings[0]?.available ?? '0',
      events: replayed.events.length,
    };
  } finally {
    await gateway.close();
  }
}

const isMain = process.argv[1]?.includes('quickstart.ts');
if (isMain) {
  await runQuickstart();
}
