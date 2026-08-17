import { decode, encodeEnvelope, injectUnknownField, processTransaction, ProtocolState } from '../protocol/index.ts';
import { signedTransferEnvelope } from '../protocol/fixtures.ts';
import { authorizeAccountAction } from '../wallet/index.ts';
import { CLASSICAL_WALLET_SUITE, publicDescriptorFromSeed, seedFromLabel, signWalletBytes } from '../wallet/keys.ts';
import { encodeAddress } from '../wallet/address.ts';
import type { BlockchainAccount } from '../wallet/types.ts';
import { ASSURANCE_CHAIN_ID, ASSURANCE_NETWORK_ID } from './types.ts';

function account(keyId: string): { account: BlockchainAccount; seed: Uint8Array; bodyHash: string } {
  const seed = seedFromLabel(keyId);
  const descriptor = publicDescriptorFromSeed(keyId, seed);
  const address = encodeAddress({
    networkId: ASSURANCE_NETWORK_ID,
    addressClass: 'SINGLE_KEY_ACCOUNT',
    algorithm: 'ED25519_V1',
    descriptorBytes: Buffer.from(descriptor.publicKeyHex, 'hex'),
  });
  const bodyHash = 'ab'.repeat(32);
  return {
    seed,
    bodyHash,
    account: {
      schemaVersion: 1,
      accountId: 'bca.sec',
      address,
      ownerActorId: 'actor.sec',
      controllerActorIds: ['actor.sec'],
      accountType: 'SINGLE_KEY_ACCOUNT',
      authorizationPolicy: {
        schemaVersion: 1,
        kind: 'SINGLE_SIGNATURE',
        threshold: 1,
        authorizedKeyIds: [keyId],
        roleBindings: {},
        recoveryKeyIds: [],
      },
      nonce: 1n,
      approvedCryptoSuites: [CLASSICAL_WALLET_SUITE],
      recoveryPolicyReference: null,
      createdHeight: 1,
      status: 'ACTIVE',
      keys: [
        {
          keyId,
          suiteId: CLASSICAL_WALLET_SUITE,
          algorithm: 'ED25519_V1',
          publicKeyHex: descriptor.publicKeyHex,
          purpose: 'WALLET_SIGNING',
          status: 'ACTIVE',
          version: 1,
          createdHeight: 1,
          activatedHeight: 1,
          revokedHeight: null,
          rotatedFrom: null,
        },
      ],
      delegatedLimits: [],
      pendingRecovery: null,
      pendingRotation: null,
      securityHoldPolicy: null,
    },
  };
}

export function runSecurityRegressionFixtures(): readonly string[] {
  const passed: string[] = [];
  const bytes = encodeEnvelope(signedTransferEnvelope());
  const mutated = Uint8Array.from(bytes);
  mutated[Math.min(8, mutated.length - 1)] ^= 0x01;
  if (decode(mutated).ok && Buffer.from(mutated).equals(Buffer.from(bytes))) {
    throw new Error('one-byte mutation was a no-op');
  }
  passed.push('one-byte-mutation');

  const unknown = injectUnknownField(bytes);
  if (decode(unknown).ok) {
    throw new Error('unknown protobuf field was accepted');
  }
  passed.push('unknown-field');

  const empty = decode(new Uint8Array());
  if (empty.ok) {
    throw new Error('empty input decoded');
  }
  passed.push('empty-input');

  const oversized = new Uint8Array(32_768);
  if (decode(oversized).ok) {
    throw new Error('oversized envelope accepted');
  }
  passed.push('maximum-sized-invalid');

  const replay = processTransaction(bytes, new ProtocolState(), {
    networkId: 'net_other',
    chainId: ASSURANCE_CHAIN_ID,
    blockTimeUnixSeconds: 1_750_000_000n,
  });
  if (replay.ok) {
    throw new Error('cross-network envelope accepted');
  }
  passed.push('cross-network-replay');

  const { account, seed, bodyHash } = account('sec.key');
  const signature = signWalletBytes(seed, Buffer.from(bodyHash, 'hex'));
  const malleated = Buffer.from(signature, 'hex');
  malleated[0] ^= 0x01;
  const bad = authorizeAccountAction({
    account,
    bodyHash,
    signatures: [
      {
        keyId: 'sec.key',
        suiteId: CLASSICAL_WALLET_SUITE,
        publicKeyHex: account.keys[0]!.publicKeyHex,
        signatureHex: malleated.toString('hex'),
      },
    ],
    currentHeight: 1,
  });
  if (bad.ok) {
    throw new Error('malleated signature authorized');
  }
  passed.push('signature-malleability');

  const downgrade = authorizeAccountAction({
    account,
    bodyHash,
    signatures: [
      {
        keyId: 'sec.key',
        suiteId: 'unknown-suite',
        publicKeyHex: account.keys[0]!.publicKeyHex,
        signatureHex: signature,
      },
    ],
    currentHeight: 1,
  });
  if (downgrade.ok) {
    throw new Error('algorithm downgrade accepted');
  }
  passed.push('algorithm-downgrade');
  return passed;
}
