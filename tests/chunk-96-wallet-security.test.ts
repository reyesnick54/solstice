import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { ENVIRONMENT } from '../packages/config/src/flags.ts';
import {
  WalletEngine,
  WalletSecurityEngine,
  isWalletSecurityRejection,
} from '../packages/sunrey-chain/src/wallet/index.ts';
import {
  WalletSecurityClient,
  getWalletSecurityProfile,
  getRecoveryState,
} from '../packages/sunrey-sdk/src/wallet-security.ts';

const ROOT = join(import.meta.dirname, '..');

describe('CHUNK-96 wallet security exit criteria', () => {
  it('keeps simulation posture and canonical ownership', () => {
    assert.equal(ENVIRONMENT, 'simulation');
    assert.equal(existsSync(join(ROOT, 'packages/sunrey-chain/src/wallet/security/engine.ts')), true);
    assert.equal(existsSync(join(ROOT, 'packages/wallet-security')), false);
    assert.equal(existsSync(join(ROOT, 'docs/wallet/chunk-96-wallet-security.md')), true);
  });

  it('exposes SDK helpers that cannot retrieve self-custody keys', () => {
    const wallet = new WalletEngine();
    wallet.unlock('pw');
    const created = wallet.createWallet({
      walletId: 'sdk',
      ownerActorId: 'sdk',
      walletType: 'HUMAN',
      signerLabels: ['sdk.primary'],
    });
    assert.ok(!('ok' in created && created.ok === false));
    const engine = new WalletSecurityEngine();
    engine.attachWallet({
      wallet: wallet.getWallet('sdk')!,
      custodyClass: 'SELF_CUSTODY',
      identityRef: 'id.sdk',
    });
    const client = new WalletSecurityClient(engine);
    assert.ok(getWalletSecurityProfile(engine, 'sdk'));
    assert.ok(client.getWalletSecurityProfile('sdk'));
    assert.equal(client.retrieveSelfCustodyPrivateKey('sdk').code, 'SELF_CUSTODY_KEY_UNAVAILABLE');
    assert.equal(getRecoveryState(engine, 'sdk').pending.length, 0);
  });

  it('refuses AI conversion of session authentication into master authority', () => {
    const engine = new WalletSecurityEngine();
    const refused = engine.sessionCannotSign('sess.ai');
    assert.equal(isWalletSecurityRejection(refused), true);
    assert.equal(refused.code, 'SESSION_IS_NOT_SIGNING_AUTHORITY');
  });
});
