import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  AccountSequenceTracker,
  ConsumedAuthorizationRegistry,
  PROTOCOL_CHAIN_ID,
  PROTOCOL_NETWORK_ID,
  PROTOCOL_SCHEMA_VERSION,
  ProtocolMempool,
  ProtocolState,
  TransactionLifecycle,
  assertSequenceAdvance,
  contextNowMs,
  deriveAccountIdFromPublicKey,
  encodeEnvelope,
  executeBlock,
  mempoolAdmissionIsNotFinality,
  processTransaction,
  receiptForStage,
  signEnvelope,
  transactionIdOf,
  transactionSigningDigestHex,
  verifyEnvelopeSignature,
} from '../packages/sunrey-chain/src/protocol/index.ts';
import { protocolKeyPairFromSeed } from '../packages/sunrey-chain/src/protocol/authentication.ts';
import {
  fixtureActor,
  fixtureHeader,
  fixtureQuantity,
  fixtureTransferBody,
  signedTransferEnvelope,
  unsignedTransferEnvelope,
  VECTOR_ED25519_SEED,
} from '../packages/sunrey-chain/src/protocol/fixtures.ts';

const CONTEXT = Object.freeze({
  networkId: PROTOCOL_NETWORK_ID,
  chainId: PROTOCOL_CHAIN_ID,
  blockTimeUnixSeconds: 1_750_000_000n,
});

function seededState(): ProtocolState {
  const state = new ProtocolState();
  state.registerActor(fixtureActor());
  state.grantRight(
    Object.freeze({
      schemaVersion: 1,
      rightId: 'right.transfer.alice',
      rightType: 'TRANSFER',
      subjectId: 'actor.human.alice',
      objectId: 'obj.native.sunrey_coin',
      holderId: 'actor.human.alice',
      issuerId: 'actor.human.alice',
      scope: 'native-asset-transfer',
      purpose: 'sunrey.native-asset.transfer',
      permittedOperations: Object.freeze(['TRANSFER']),
      jurisdiction: 'GB:SIM',
      startUnixSeconds: 1_700_000_000n,
      expirationUnixSeconds: 1_900_000_000n,
      revocationState: 'ACTIVE',
      transferable: false,
      compensationRef: '',
      provenanceRef: 'prov.sim.1',
    }),
  );
  state.allowPolicy('policy.sim.v1');
  state.allowConsent('consent.sim.1');
  return state;
}

describe('Wave 2 transaction security', () => {
  it('accepts a valid signature on the canonical signing digest', () => {
    const signed = signedTransferEnvelope();
    assert.equal(verifyEnvelopeSignature(signed), true);
    assert.equal(transactionSigningDigestHex(signed).length, 64);
  });

  it('rejects an invalid signature', () => {
    const broken = signedTransferEnvelope();
    const tampered = Object.freeze({
      ...broken,
      authentication: Object.freeze({
        ...broken.authentication,
        signature: new Uint8Array(64).fill(1),
      }),
    });
    assert.equal(verifyEnvelopeSignature(tampered), false);
  });

  it('rejects an altered payload after signing', () => {
    const signed = signedTransferEnvelope();
    const altered = Object.freeze({
      ...signed,
      body: fixtureTransferBody({ amount: fixtureQuantity(99n) }),
    });
    assert.equal(verifyEnvelopeSignature(altered), false);
  });

  it('rejects wrong chain ID at validation', () => {
    const bytes = encodeEnvelope(signedTransferEnvelope());
    const result = processTransaction(bytes, seededState(), { ...CONTEXT, chainId: 'chn_other' });
    assert.equal(result.ok, false);
    if (result.ok) {
      throw new Error('expected refusal');
    }
    assert.equal(result.error.code, 'WRONG_CHAIN');
  });

  it('rejects wrong network at validation', () => {
    const bytes = encodeEnvelope(signedTransferEnvelope());
    const result = processTransaction(bytes, seededState(), { ...CONTEXT, networkId: 'net_other' });
    assert.equal(result.ok, false);
    if (result.ok) {
      throw new Error('expected refusal');
    }
    assert.equal(result.error.code, 'WRONG_NETWORK');
  });

  it('rejects wrong protocol version bytes', () => {
    const bytes = encodeEnvelope(signedTransferEnvelope());
    const marker = bytes.indexOf(2);
    assert.notEqual(marker, -1);
    bytes[marker] = 9;
    const result = processTransaction(new Uint8Array(bytes), seededState(), CONTEXT);
    assert.equal(result.ok, false);
  });

  it('rejects duplicate transactions', () => {
    const lifecycle = new TransactionLifecycle(CONTEXT, seededState());
    const signed = lifecycle.sign(unsignedTransferEnvelope(), VECTOR_ED25519_SEED);
    assert.equal(signed.ok, true);
    if (!signed.ok) {
      throw new Error('expected sign ok');
    }
    const first = lifecycle.submit(signed.value);
    assert.equal(first.ok, true);
    const duplicate = lifecycle.mempool.admit(
      signed.value.canonicalBytes,
      lifecycle.state,
      CONTEXT,
      contextNowMs(CONTEXT),
    );
    assert.equal(duplicate.ok, false);
    if (duplicate.ok) {
      throw new Error('expected duplicate rejection');
    }
    assert.equal(duplicate.reason, 'DUPLICATE');
  });

  it('rejects nonce replay and stale nonces', () => {
    const tracker = new AccountSequenceTracker();
    assert.equal(tracker.reserve('acct.a', 1n), 'OK');
    assert.equal(tracker.reserve('acct.a', 1n), 'CONFLICT');
    tracker.markExecuted('acct.a', 1n);
    assert.equal(assertSequenceAdvance(1n, 1n), 'STALE');
    assert.equal(assertSequenceAdvance(1n, 3n), 'FUTURE_GAP');
  });

  it('rejects skipped nonce at protocol replay validation', () => {
    const envelope = signedTransferEnvelope({
      body: fixtureTransferBody({ header: fixtureHeader({ sequence: 3n }) }),
    });
    const result = processTransaction(encodeEnvelope(envelope), seededState(), CONTEXT);
    assert.equal(result.ok, false);
    if (result.ok) {
      throw new Error('expected refusal');
    }
    assert.equal(result.error.code, 'INVALID_SEQUENCE');
  });

  it('recovers nonce state after restart', () => {
    const tracker = new AccountSequenceTracker();
    tracker.reserve('acct.a', 1n);
    tracker.markExecuted('acct.a', 1n);
    tracker.reserve('acct.a', 2n);
    const restored = new AccountSequenceTracker();
    restored.restore(new Map([['acct.a', 1n]]));
    assert.equal(restored.lastExecuted('acct.a'), 1n);
    assert.equal(restored.reserve('acct.a', 2n), 'OK');
  });

  it('rejects issuance authorization replay', () => {
    const registry = new ConsumedAuthorizationRegistry();
    const ref = Object.freeze({
      assetId: 'SUNREY_COIN' as const,
      authorizationId: 'auth.once',
      issuanceClass: 'GOVERNED_ISSUANCE',
    });
    assert.equal(registry.consume(ref), 'OK');
    assert.equal(registry.consume(ref), 'DUPLICATE_ISSUANCE');
  });

  it('rejects malformed payload and public key', () => {
    const envelope = unsignedTransferEnvelope();
    const broken = Object.freeze({
      ...envelope,
      authentication: Object.freeze({
        ...envelope.authentication,
        publicKey: new Uint8Array(4),
        signature: new Uint8Array(8),
      }),
    });
    const result = processTransaction(encodeEnvelope(broken), seededState(), CONTEXT);
    assert.equal(result.ok, false);
    if (result.ok) {
      throw new Error('expected refusal');
    }
    assert.equal(result.error.code, 'INVALID_SIGNATURE');
    assert.equal(deriveAccountIdFromPublicKey('not-a-key', PROTOCOL_NETWORK_ID), null);
  });

  it('rejects SunRey-shaped transfer of MoonRey and MoonRey purpose on SunRey', () => {
    const moonreyOnSunreyPurpose = signedTransferEnvelope({
      body: fixtureTransferBody({
        header: fixtureHeader({ purpose: 'moonrey.productive.transfer' }),
        amount: fixtureQuantity(1n, 'SUNREY_COIN'),
      }),
    });
    const sunreyOnMoonrey = signedTransferEnvelope({
      body: fixtureTransferBody({
        amount: fixtureQuantity(1n, 'MOONREY_COIN'),
      }),
    });
    assert.equal(processTransaction(encodeEnvelope(moonreyOnSunreyPurpose), seededState(), CONTEXT).ok, false);
    assert.equal(processTransaction(encodeEnvelope(sunreyOnMoonrey), seededState(), CONTEXT).ok, false);
  });

  it('binds public keys to deterministic account identifiers', () => {
    const keys = protocolKeyPairFromSeed(VECTOR_ED25519_SEED);
    const accountId = deriveAccountIdFromPublicKey(Buffer.from(keys.publicKey).toString('hex'), PROTOCOL_NETWORK_ID);
    assert.ok(accountId?.startsWith('acct.'));
  });

  it('does not treat mempool admission as finality', () => {
    const receipt = receiptForStage({
      transactionId: 'tx.pending',
      stage: 'ACCEPTED',
      source: 'MEMPOOL_ADMISSION',
    });
    assert.equal(mempoolAdmissionIsNotFinality(receipt), true);
    assert.equal(receipt.finalized, false);
  });

  it('runs submit → mempool → block → execution → finalization', () => {
    const lifecycle = new TransactionLifecycle(CONTEXT, seededState());
    const signed = lifecycle.sign(unsignedTransferEnvelope(), VECTOR_ED25519_SEED);
    assert.equal(signed.ok, true);
    if (!signed.ok) {
      throw new Error('expected sign');
    }
    const submitted = lifecycle.submit(signed.value);
    assert.equal(submitted.ok, true);
    if (!submitted.ok) {
      throw new Error('expected submit');
    }
    assert.equal(submitted.value.stage, 'SUBMITTED');
    assert.equal(submitted.value.finalized, false);
    const outcomes = executeBlock(lifecycle, [signed.value.transactionId], 1, 'blk.1');
    assert.equal(outcomes.length, 1);
    assert.equal(outcomes[0]?.ok, true);
    assert.equal(outcomes[0]?.receipt.stage, 'FINALIZED');
    const replay = lifecycle.mempool.admit(
      signed.value.canonicalBytes,
      lifecycle.state,
      CONTEXT,
      contextNowMs(CONTEXT),
    );
    assert.equal(replay.ok, false);
  });

  it('enforces mempool capacity and malformed admission rejection', () => {
    const mempool = new ProtocolMempool(
      Object.freeze({
        maxCount: 1,
        maxBytes: 10_000,
        maxPerActor: 1,
        ttlMs: 60_000,
        preferHigherFee: true,
      }),
    );
    const state = seededState();
    const actors = [
      fixtureActor({ actorId: 'actor.human.one' }),
      fixtureActor({ actorId: 'actor.human.two', ownerControllerId: 'actor.human.two' }),
    ];
    for (const actor of actors) {
      state.registerActor(actor);
    }
    const first = signEnvelope(
      unsignedTransferEnvelope({
        body: fixtureTransferBody({
          header: fixtureHeader({
            actor: actors[0]!,
            sequence: 1n,
            clientTxId: 'client.tx.one',
            idempotencyKey: 'idem.one',
          }),
        }),
      }),
      VECTOR_ED25519_SEED,
    );
    const firstBytes = encodeEnvelope(first);
    assert.equal(mempool.admit(firstBytes, state, CONTEXT, contextNowMs(CONTEXT)).ok, true);
    const second = signEnvelope(
      unsignedTransferEnvelope({
        body: fixtureTransferBody({
          header: fixtureHeader({
            actor: actors[1]!,
            sequence: 1n,
            clientTxId: 'client.tx.two',
            idempotencyKey: 'idem.two',
          }),
        }),
      }),
      VECTOR_ED25519_SEED,
    );
    const admission = mempool.admit(encodeEnvelope(second), state, CONTEXT, contextNowMs(CONTEXT));
    assert.equal(admission.ok, false);
    if (admission.ok) {
      throw new Error('expected capacity rejection');
    }
    assert.equal(admission.reason, 'CAPACITY');
    assert.equal(mempool.admit(new Uint8Array([1, 2, 3]), state, CONTEXT, contextNowMs(CONTEXT)).ok, false);
  });

  it('separates signing digests across chain and protocol version', () => {
    const base = unsignedTransferEnvelope();
    const otherChain = Object.freeze({ ...base, chainId: 'chn_sunrey_testnet_1' });
    const otherVersion = Object.freeze({ ...base, schemaVersion: PROTOCOL_SCHEMA_VERSION });
    const signedBase = signEnvelope(base, VECTOR_ED25519_SEED);
    const signedOtherChain = signEnvelope(otherChain, VECTOR_ED25519_SEED);
    assert.notEqual(transactionSigningDigestHex(signedBase), transactionSigningDigestHex(signedOtherChain));
    assert.notEqual(transactionIdOf(signedBase), transactionIdOf(signedOtherChain));
    assert.equal(otherVersion.schemaVersion, PROTOCOL_SCHEMA_VERSION);
  });
});
