import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { WalletEngine } from '../../sunrey-chain/src/wallet/engine.ts';
import { WalletSecurityEngine } from '../../sunrey-chain/src/wallet/security/engine.ts';
import { isWalletRejection } from '../../sunrey-chain/src/wallet/types.ts';
import {
  WalletSecurityClient,
  buildSigningIntent,
  getWalletDevices,
  getWalletPolicies,
  getWalletSessions,
} from './wallet-security.ts';

describe('Chunk 96 wallet security SDK', () => {
  it('builds a signing intent without exposing private keys', () => {
    const wallet = new WalletEngine();
    wallet.unlock('pw');
    wallet.createWallet({ walletId: 'a', ownerActorId: 'a', walletType: 'HUMAN', signerLabels: ['a'] });
    wallet.createWallet({ walletId: 'b', ownerActorId: 'b', walletType: 'HUMAN', signerLabels: ['b'] });
    const bob = wallet.getAccount('bca.b');
    assert.ok(bob);
    const built = wallet.buildTransfer({
      walletId: 'a',
      toAccountId: bob.accountId,
      toAddressText: bob.address.text,
      amount: 1n,
      maxFee: 2_000n,
    });
    assert.equal(isWalletRejection(built), false);
    if (isWalletRejection(built)) {
      return;
    }
    const security = new WalletSecurityEngine();
    security.attachWallet({
      wallet: wallet.getWallet('a')!,
      custodyClass: 'SELF_CUSTODY',
      identityRef: 'id.a',
    });
    const client = new WalletSecurityClient(security);
    const intent = buildSigningIntent(security, 'a', built);
    assert.equal(intent.transactionHash, built.bodyHash);
    assert.equal(intent.canonicalBytesHash.length, 64);
    assert.equal(client.retrieveSelfCustodyPrivateKey('a').ok, false);
    assert.equal(getWalletDevices(security, 'a').length, 0);
    assert.equal(getWalletSessions(security, 'a').length, 0);
    assert.ok(getWalletPolicies(security, 'a'));
  });
});
