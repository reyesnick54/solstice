import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  SUITE_SUNREY_ED25519_V1,
  createEd25519SignatureProvider,
  createSecurityProviderCatalog,
  createTestCryptoSuiteRegistry,
} from '../../security/src/index.ts';
import { signChainWithSuite, verifyChainWithSuite } from './suite-signer.ts';
import {
  assertSeparatedValidatorKeys,
  type ValidatorKeySet,
} from './validator-keys.ts';

describe('SunRey chain CryptoSuite integration', () => {
  it('signs a transaction payload through the canonical suite', () => {
    const registry = createTestCryptoSuiteRegistry();
    const catalog = createSecurityProviderCatalog();
    const provider = createEd25519SignatureProvider();
    const key = provider.generateKey('TRANSACTION_SIGNING', SUITE_SUNREY_ED25519_V1);
    assert.equal(key.ok, true);
    if (!key.ok) return;
    const signed = signChainWithSuite({
      registry,
      catalog,
      suiteId: SUITE_SUNREY_ED25519_V1,
      publicKey: key.value.publicKey,
      privateKey: key.value.privateKey,
      payload: 'tx-body',
      networkId: 'sunrey-sim',
      chainId: 'sunrey-sim-0',
      protocolVersion: 'sunrey-protocol-0',
      messageDomain: 'tx.v1',
    });
    assert.equal(signed.ok, true);
    if (!signed.ok) return;
    const verified = verifyChainWithSuite({
      registry,
      catalog,
      suiteId: SUITE_SUNREY_ED25519_V1,
      publicKey: key.value.publicKey,
      payload: 'tx-body',
      networkId: 'sunrey-sim',
      chainId: 'sunrey-sim-0',
      protocolVersion: 'sunrey-protocol-0',
      messageDomain: 'tx.v1',
      signature: signed.signature,
    });
    assert.equal(verified.ok, true);
  });

  it('rejects a universal validator key', () => {
    const registry = createTestCryptoSuiteRegistry();
    const provider = createEd25519SignatureProvider();
    const purposes = [
      'VALIDATOR_CONSENSUS_SIGNING',
      'BLOCK_PROPOSAL_SIGNING',
      'P2P_IDENTITY',
      'GOVERNANCE_SIGNING',
      'ATTESTATION_SIGNING',
    ] as const;
    const keys = purposes.map((purpose) => provider.generateKey(purpose, SUITE_SUNREY_ED25519_V1));
    assert.ok(keys.every((row) => row.ok));
    const pubs = keys.map((row) => (row.ok ? row.value.publicKey : null));
    const set: ValidatorKeySet = {
      operator: { kind: 'VALIDATOR_OPERATOR_IDENTITY', operatorId: 'op-1', displayName: 'sim' },
      consensusVoting: {
        kind: 'VALIDATOR_CONSENSUS_VOTING_KEY',
        purpose: 'VALIDATOR_CONSENSUS_SIGNING',
        keyId: pubs[0]!.keyId,
        suiteId: SUITE_SUNREY_ED25519_V1,
        publicKey: pubs[0]!,
      },
      blockProposal: {
        kind: 'VALIDATOR_BLOCK_PROPOSAL_KEY',
        purpose: 'BLOCK_PROPOSAL_SIGNING',
        keyId: pubs[1]!.keyId,
        suiteId: SUITE_SUNREY_ED25519_V1,
        publicKey: pubs[1]!,
      },
      p2p: {
        kind: 'VALIDATOR_P2P_KEY',
        purpose: 'P2P_IDENTITY',
        keyId: pubs[2]!.keyId,
        suiteId: SUITE_SUNREY_ED25519_V1,
        publicKey: pubs[2]!,
      },
      rewardAddress: {
        kind: 'VALIDATOR_REWARD_ADDRESS',
        addressCommitment: 'reward-commitment',
        purpose: 'WALLET_SIGNING',
      },
      governance: {
        kind: 'VALIDATOR_GOVERNANCE_KEY',
        purpose: 'GOVERNANCE_SIGNING',
        keyId: pubs[3]!.keyId,
        suiteId: SUITE_SUNREY_ED25519_V1,
        publicKey: pubs[3]!,
      },
      recovery: {
        kind: 'VALIDATOR_RECOVERY_KEY',
        purpose: 'ATTESTATION_SIGNING',
        keyId: pubs[4]!.keyId,
        suiteId: SUITE_SUNREY_ED25519_V1,
        publicKey: pubs[4]!,
      },
    };
    assert.doesNotThrow(() => assertSeparatedValidatorKeys(set));
    const collapsed = {
      ...set,
      blockProposal: { ...set.blockProposal, keyId: set.consensusVoting.keyId },
    };
    assert.throws(() => assertSeparatedValidatorKeys(collapsed));
    void registry;
  });
});
