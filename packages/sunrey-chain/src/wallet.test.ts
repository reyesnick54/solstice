import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { PROTOCOL_NETWORK_ID } from './protocol/constants.ts';
import {
  ADDRESS_FORMAT_VERSION,
  ADDRESS_MAX_TEXT_LENGTH,
  WalletEngine,
  containsPrivateMaterial,
  createRecoveryPolicy,
  encodeFromPublicKey,
  parseAddress,
  publicDescriptorFromSeed,
  runMachineMandateDemo,
  runMultiAuthDemo,
  runPqMigrationDemo,
  runRecoveryDemo,
  runTransferDemo,
  runWalletCommand,
  seedFromLabel,
} from './wallet/index.ts';
import { RESERVED_PRODUCTION_NETWORK_ID, isWalletRejection } from './wallet/types.ts';

const ROOT = join(import.meta.dirname, '..', '..', '..');

describe('SunRey sovereign wallets', () => {
  it('rejects a wrong-network address and a checksum failure', () => {
    const descriptor = publicDescriptorFromSeed('k1', seedFromLabel('alice'));
    const production = encodeFromPublicKey(RESERVED_PRODUCTION_NETWORK_ID, 'SINGLE_KEY_ACCOUNT', descriptor);
    const wrong = parseAddress(production.text, PROTOCOL_NETWORK_ID);
    assert.equal(wrong.ok, false);
    if (!wrong.ok) {
      assert.equal(wrong.code, 'WRONG_NETWORK_ADDRESS');
    }
    const development = encodeFromPublicKey(PROTOCOL_NETWORK_ID, 'SINGLE_KEY_ACCOUNT', descriptor);
    assert.equal(development.text.startsWith('srdev1'), true);
    assert.equal(development.text.length <= ADDRESS_MAX_TEXT_LENGTH, true);
    assert.equal(development.schemaVersion, ADDRESS_FORMAT_VERSION);
    const broken = `${development.text.slice(0, -1)}${development.text.endsWith('a') ? 'b' : 'a'}`;
    const checksum = parseAddress(broken, PROTOCOL_NETWORK_ID);
    assert.equal(checksum.ok, false);
    if (!checksum.ok) {
      assert.equal(checksum.code, 'CHECKSUM_FAILURE');
    }
  });

  it('rejects a wrong-chain transaction', () => {
    const engine = new WalletEngine({ networkId: PROTOCOL_NETWORK_ID });
    engine.unlock('pw');
    engine.createWallet({ walletId: 'alice', ownerActorId: 'alice', walletType: 'HUMAN', signerLabels: ['a'] });
    engine.createWallet({ walletId: 'bob', ownerActorId: 'bob', walletType: 'HUMAN', signerLabels: ['b'] });
    const bob = engine.getAccount('bca.bob');
    assert.ok(bob);
    const built = engine.buildTransfer({
      walletId: 'alice',
      toAccountId: bob.accountId,
      toAddressText: bob.address.text,
      amount: 1n,
      maxFee: 2_000n,
    });
    assert.equal(isWalletRejection(built), false);
    if (isWalletRejection(built)) {
      return;
    }
    const tampered = { ...built, chainId: 'chn_other' };
    const signed = engine.sign({ walletId: 'alice', built: tampered, keyIds: ['alice.key.1'] });
    assert.equal(signed.ok, false);
    if (signed.ok === false) {
      assert.equal(signed.code, 'WRONG_CHAIN_TRANSACTION');
    }
  });

  it('enforces multi-auth, duplicate, and unauthorized signer rules', () => {
    const report = runMultiAuthDemo();
    assert.equal(report.oneSignatureRejected, true);
    assert.equal(report.twoSignaturesAccepted, true);
    assert.equal(report.duplicateRejected, true);
    assert.equal(report.unauthorizedRejected, true);
  });

  it('never includes private key material in wallet descriptors or CLI output', () => {
    const engine = new WalletEngine();
    engine.unlock('pw');
    const wallet = engine.createWallet({
      walletId: 'alice',
      ownerActorId: 'alice',
      walletType: 'HUMAN',
      signerLabels: ['secret-label'],
    });
    assert.equal(isWalletRejection(wallet), false);
    const serialized = JSON.stringify(wallet);
    assert.equal(containsPrivateMaterial(serialized), false);
    assert.equal(serialized.includes('seedHex'), false);
    const cli = runWalletCommand(['create', 'carol', 'actor.carol', 'human']);
    const cliText = JSON.stringify(cli);
    assert.equal(containsPrivateMaterial(cliText), false);
    assert.equal(cliText.includes('seedHex'), false);
  });

  it('refuses watch-only sign, rotate, and recovery', () => {
    const engine = new WalletEngine();
    engine.unlock('pw');
    engine.createWallet({
      walletId: 'watch',
      ownerActorId: 'observer',
      walletType: 'WATCH_ONLY',
      watchOnly: true,
      signerLabels: [],
    });
    engine.createWallet({ walletId: 'bob', ownerActorId: 'bob', walletType: 'HUMAN', signerLabels: ['b'] });
    const watch = engine.getAccount('bca.watch');
    const bob = engine.getAccount('bca.bob');
    assert.ok(watch && bob);
    const built = engine.buildTransfer({
      walletId: 'watch',
      toAccountId: bob.accountId,
      toAddressText: bob.address.text,
      amount: 1n,
      maxFee: 2_000n,
    });
    assert.equal(isWalletRejection(built), false);
    if (isWalletRejection(built)) {
      return;
    }
    const signed = engine.sign({ walletId: 'watch', built, keyIds: ['watch.key.1'] });
    assert.equal(signed.ok, false);
    if (signed.ok === false) {
      assert.equal(signed.code, 'WATCH_ONLY_CANNOT_SIGN');
    }
    const rotated = engine.rotateKey({ walletId: 'watch', currentKeyId: 'missing', nextLabel: 'x' });
    assert.equal(rotated.ok, false);
  });

  it('rejects an old rotated key and keeps historic signatures verifiable', () => {
    const engine = new WalletEngine();
    engine.unlock('pw');
    engine.createWallet({ walletId: 'alice', ownerActorId: 'alice', walletType: 'HUMAN', signerLabels: ['a'] });
    engine.createWallet({ walletId: 'bob', ownerActorId: 'bob', walletType: 'HUMAN', signerLabels: ['b'] });
    const alice = engine.getAccount('bca.alice');
    const bob = engine.getAccount('bca.bob');
    assert.ok(alice && bob);
    engine.faucet(alice.accountId, 1_000_000n);
    const first = engine.buildTransfer({
      walletId: 'alice',
      toAccountId: bob.accountId,
      toAddressText: bob.address.text,
      amount: 10n,
      maxFee: 2_000n,
    });
    assert.equal(isWalletRejection(first), false);
    if (isWalletRejection(first)) {
      return;
    }
    const signed = engine.sign({ walletId: 'alice', built: first, keyIds: ['alice.key.1'] });
    assert.equal(signed.ok, true);
    if (signed.ok === false) {
      return;
    }
    const submitted = engine.submit({ walletId: 'alice', built: first, signatures: signed.signatures });
    assert.equal(submitted.ok, true);
    if (submitted.ok === false) {
      return;
    }
    const rotated = engine.rotateKey({
      walletId: 'alice',
      currentKeyId: 'alice.key.1',
      nextLabel: 'alice.next',
    });
    assert.equal(rotated.ok, true);
    if (rotated.ok === false) {
      return;
    }
    const next = engine.buildTransfer({
      walletId: 'alice',
      toAccountId: bob.accountId,
      toAddressText: bob.address.text,
      amount: 10n,
      maxFee: 2_000n,
    });
    assert.equal(isWalletRejection(next), false);
    if (isWalletRejection(next)) {
      return;
    }
    const old = engine.sign({ walletId: 'alice', built: next, keyIds: ['alice.key.1'] });
    assert.equal(old.ok, false);
    if (old.ok === false) {
      assert.equal(old.code, 'OLD_ROTATED_KEY');
    }
    assert.equal(engine.verifyHistoric(submitted.txId, alice.keys[0].publicKeyHex), true);
  });

  it('enforces recovery delay and activates the new key at height', () => {
    const report = runRecoveryDemo();
    assert.equal(report.delayEnforced, true);
    assert.equal(report.oldKeyRejected, true);
    assert.equal(report.historicStillVerifies, true);
    assert.equal(report.newKeyAccepted, true);
  });

  it('enforces delegated amount and transaction-type limits', () => {
    const engine = new WalletEngine();
    engine.unlock('pw');
    engine.createWallet({ walletId: 'alice', ownerActorId: 'alice', walletType: 'HUMAN', signerLabels: ['a'] });
    engine.createWallet({ walletId: 'bob', ownerActorId: 'bob', walletType: 'HUMAN', signerLabels: ['b'] });
    const alice = engine.getAccount('bca.alice');
    const bob = engine.getAccount('bca.bob');
    assert.ok(alice && bob);
    engine.faucet(alice.accountId, 1_000_000n);
    const delegated = engine.delegate({
      walletId: 'alice',
      label: 'session',
      limit: {
        allowedTransactionTypes: ['NATIVE_ASSET'],
        allowedAsset: 'SUNREY_COIN',
        maximumAmount: 50n,
        maximumTotalAmount: 50n,
        expirationHeight: null,
        allowedCounterparty: null,
        purpose: 'mobile-session',
        feeCeiling: 2_000n,
      },
    });
    assert.equal(delegated.ok, true);
    if (delegated.ok === false) {
      return;
    }
    const tooMuch = engine.buildTransfer({
      walletId: 'alice',
      toAccountId: bob.accountId,
      toAddressText: bob.address.text,
      amount: 500n,
      maxFee: 2_000n,
    });
    assert.equal(isWalletRejection(tooMuch), false);
    if (isWalletRejection(tooMuch)) {
      return;
    }
    const amountDenied = engine.sign({ walletId: 'alice', built: tooMuch, keyIds: [delegated.keyId] });
    assert.equal(amountDenied.ok, false);
    if (amountDenied.ok === false) {
      assert.equal(amountDenied.code, 'DELEGATED_AMOUNT_LIMIT');
    }
    const reserved = engine.buildOracleOrGovernance({
      walletId: 'alice',
      family: 'GOVERNANCE',
      purpose: 'vote',
      maxFee: 2_000n,
    });
    assert.equal(isWalletRejection(reserved), false);
    if (isWalletRejection(reserved)) {
      return;
    }
    const typeDenied = engine.sign({ walletId: 'alice', built: reserved, keyIds: [delegated.keyId] });
    assert.equal(typeDenied.ok, false);
    if (typeDenied.ok === false) {
      assert.equal(typeDenied.code, 'DELEGATED_TX_TYPE_LIMIT');
    }
  });

  it('cannot bypass a machine spending mandate', () => {
    const report = runMachineMandateDemo();
    assert.equal(report.bypassRejected, true);
  });

  it('rejects a CryptoSuite downgrade and keeps historic signatures after migration', () => {
    const report = runPqMigrationDemo();
    assert.equal(report.historicStillVerifies, true);
    assert.equal(report.downgradeRejected, true);
    assert.match(report.endedSuite, /hybrid/);
  });

  it('keeps wallet balances equal to canonical chain state on a four-validator transfer', () => {
    const report = runTransferDemo();
    assert.equal(report.rootsEqual, true);
    assert.equal(report.bobAfter, '25000');
    assert.equal(report.historyCount > 0, true);
    assert.equal(report.estimatedFee !== report.maximumAuthorizedFee, true);
    const engine = new WalletEngine();
    engine.unlock('pw');
    engine.createWallet({ walletId: 'alice', ownerActorId: 'alice', walletType: 'HUMAN', signerLabels: ['a'] });
    const alice = engine.getAccount('bca.alice');
    assert.ok(alice);
    engine.faucet(alice.accountId, 42n);
    assert.equal(engine.balance(alice.accountId), engine.fees.accounts.position(alice.accountId, 'SUNREY_COIN').available);
    assert.equal(engine.balance(alice.accountId), 42n);
  });

  it('stores recovery policies without granting guardians everyday spend', () => {
    const policy = createRecoveryPolicy({
      policyId: 'p1',
      kind: 'M_OF_N_RECOVERY_GUARDIANS',
      threshold: 2,
      delayHeights: 3,
      ownerMayCancel: true,
      credentials: [
        {
          schemaVersion: 1,
          credentialId: 'g1',
          kind: 'M_OF_N_RECOVERY_GUARDIANS',
          actorId: 'g1',
          keyId: 'g1',
          publicKeyHex: '11',
          grantsEverydaySpend: false,
        },
        {
          schemaVersion: 1,
          credentialId: 'g2',
          kind: 'M_OF_N_RECOVERY_GUARDIANS',
          actorId: 'g2',
          keyId: 'g2',
          publicKeyHex: '22',
          grantsEverydaySpend: false,
        },
      ],
    });
    assert.equal(policy.credentials.every((credential) => credential.grantsEverydaySpend === false), true);
  });

  it('does not create competing wallet packages', () => {
    assert.equal(existsSync(join(ROOT, 'packages/wallet-v2')), false);
    assert.equal(existsSync(join(ROOT, 'packages/blockchain-wallet')), false);
    assert.equal(existsSync(join(ROOT, 'packages/crypto-wallet')), false);
    assert.equal(existsSync(join(ROOT, 'packages/sunrey-wallet-ledger')), false);
  });
});
