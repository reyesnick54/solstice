import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { AssetQuantity } from '../../money/src/asset-quantity.ts';
import {
  PROTOCOL_CHAIN_ID,
  PROTOCOL_NETWORK_ID,
  PROTOCOL_REJECTION_CODES,
  decodeEnvelope,
  encodeEconomicObject,
  encodeEnvelope,
  encodeUnsignedEnvelope,
  injectUnknownField,
  processTransaction,
  ProtocolState,
  toDebugJson,
  debugJsonMustNotBeHashed,
  transactionIdOf,
  transactionIdFromCanonicalBytes,
  hashForDomain,
  HASH_DOMAINS,
  NATIVE_ASSET_TICKER_STATUS,
  moonreyIssuanceActivated,
  ownershipImpliesUnlimitedUse,
  parseScaledUnits,
  toAssetQuantity,
  NATIVE_ASSET_PROTOCOL_KEYS,
} from './protocol/index.ts';
import {
  fixtureActor,
  fixtureHeader,
  fixtureObject,
  fixtureQuantity,
  fixtureRight,
  fixtureTransferBody,
  signedTransferEnvelope,
  unsignedTransferEnvelope,
  VECTOR_ED25519_SEED,
} from './protocol/fixtures.ts';
import { signEnvelope } from './protocol/authentication.ts';
import { decode } from './protocol/validation.ts';

const ROOT = join(import.meta.dirname, '..', '..', '..');
const VECTOR_PATH = join(ROOT, 'packages/sunrey-chain/protocol/test-vectors/v1/vectors.json');

const CONTEXT = Object.freeze({
  networkId: PROTOCOL_NETWORK_ID,
  chainId: PROTOCOL_CHAIN_ID,
  blockTimeUnixSeconds: 1_750_000_000n,
});

function seededState(): ProtocolState {
  const state = new ProtocolState();
  const actor = fixtureActor();
  state.registerActor(actor);
  state.grantRight(fixtureRight());
  state.allowPolicy('policy.sim.v1');
  state.allowConsent('consent.sim.1');
  return state;
}

describe('SunRey transaction protocol v1', () => {
  it('accepts a SunRey Coin transfer-shaped envelope without changing ledger supply', () => {
    const envelope = signedTransferEnvelope();
    const state = seededState();
    const result = processTransaction(encodeEnvelope(envelope), state, CONTEXT);
    if (!result.ok) {
      return;
    }
    assert.equal(result.value.accepted, true);
    assert.equal(result.value.events[0]?.ledgerSupplyChanged, false);
    assert.equal(result.value.events[0]?.chainBalanceAuthoritative, false);
    assert.equal(moonreyIssuanceActivated(), false);
    assert.equal(NATIVE_ASSET_TICKER_STATUS, 'NOT_ASSIGNED');
    assert.equal(ownershipImpliesUnlimitedUse(), false);
  });

  it('produces identical canonical bytes for identical input', () => {
    const left = encodeEnvelope(signedTransferEnvelope());
    const right = encodeEnvelope(signedTransferEnvelope());
    assert.equal(Buffer.from(left).toString('hex'), Buffer.from(right).toString('hex'));
  });

  it('produces identical transaction IDs from identical bytes', () => {
    const envelope = signedTransferEnvelope();
    const unsigned = encodeUnsignedEnvelope(envelope);
    const first = transactionIdFromCanonicalBytes(envelope.networkId, envelope.chainId, unsigned);
    const second = transactionIdFromCanonicalBytes(envelope.networkId, envelope.chainId, unsigned);
    assert.equal(first, second);
    assert.equal(first, transactionIdOf(envelope));
  });

  it('changes the transaction ID when one semantic byte changes', () => {
    const base = signedTransferEnvelope();
    const changed = signedTransferEnvelope({
      body: fixtureTransferBody({ header: fixtureHeader({ sequence: 2n }) }),
    });
    assert.notEqual(transactionIdOf(base), transactionIdOf(changed));
  });

  it('rejects the wrong network', () => {
    const result = processTransaction(encodeEnvelope(signedTransferEnvelope()), seededState(), {
      ...CONTEXT,
      networkId: 'net_other',
    });
    assert.equal(result.ok, false);
    if (result.ok) {
      return;
    }
    assert.equal(result.error.code, 'WRONG_NETWORK');
  });

  it('rejects the wrong chain', () => {
    const result = processTransaction(encodeEnvelope(signedTransferEnvelope()), seededState(), {
      ...CONTEXT,
      chainId: 'chn_other',
    });
    assert.equal(result.ok, false);
    if (result.ok) {
      return;
    }
    assert.equal(result.error.code, 'WRONG_CHAIN');
  });

  it('rejects replay of the same transaction', () => {
    const bytes = encodeEnvelope(signedTransferEnvelope());
    const state = seededState();
    const first = processTransaction(bytes, state, CONTEXT);
    assert.equal(first.ok, true);
    const second = processTransaction(bytes, state, CONTEXT);
    assert.equal(second.ok, false);
    if (second.ok) {
      return;
    }
    assert.equal(second.error.code, 'REPLAY');
  });

  it('rejects an expired transaction', () => {
    const envelope = signedTransferEnvelope({
      body: fixtureTransferBody({ header: fixtureHeader({ expirationUnixSeconds: 1n }) }),
    });
    const result = processTransaction(encodeEnvelope(envelope), seededState(), CONTEXT);
    assert.equal(result.ok, false);
    if (result.ok) {
      return;
    }
    assert.equal(result.error.code, 'EXPIRED');
  });

  it('rejects an unsupported schema version', () => {
    const bytes = Buffer.from(encodeEnvelope(signedTransferEnvelope()));
    const marker = bytes.indexOf(Buffer.from([0x20, 0x01]));
    assert.notEqual(marker, -1);
    bytes[marker + 1] = 2;
    const result = decode(new Uint8Array(bytes));
    assert.equal(result.ok, false);
    if (result.ok) {
      return;
    }
    assert.equal(result.error.code, 'INVALID_VERSION');
  });

  it('rejects unknown protobuf fields', () => {
    const bytes = injectUnknownField(encodeEnvelope(signedTransferEnvelope()));
    const result = decode(bytes);
    assert.equal(result.ok, false);
    if (result.ok) {
      return;
    }
    assert.equal(result.error.code, 'MALFORMED');
  });

  it('rejects an unauthorized purpose', () => {
    const envelope = signedTransferEnvelope({
      body: fixtureTransferBody({ header: fixtureHeader({ purpose: 'unlisted-purpose' }) }),
    });
    const result = processTransaction(encodeEnvelope(envelope), seededState(), CONTEXT);
    assert.equal(result.ok, false);
    if (result.ok) {
      return;
    }
    assert.equal(result.error.code, 'PURPOSE_NOT_AUTHORIZED');
  });

  it('rejects an AI actor used as an unrestricted wallet', () => {
    const actor = fixtureActor({
      actorId: 'actor.agent.one',
      actorType: 'AI_AGENT',
      capabilityRefs: [],
      modelFirmwareRef: 'model.sim.1',
    });
    const envelope = signedTransferEnvelope({
      body: fixtureTransferBody({ header: fixtureHeader({ actor, capabilityRef: '' }) }),
    });
    const result = processTransaction(encodeEnvelope(envelope), seededState(), CONTEXT);
    assert.equal(result.ok, false);
    if (result.ok) {
      return;
    }
    assert.equal(result.error.code, 'CAPABILITY_INVALID');
  });

  it('round-trips a productive-capacity object', () => {
    const object = fixtureObject({
      objectId: 'obj.capacity.press.1',
      objectType: 'PRODUCTIVE_CAPACITY_RIGHT',
      commitmentHex: 'bb'.repeat(32),
      quantity: null,
    });
    const encoded = encodeEconomicObject(object);
    const again = encodeEconomicObject(object);
    assert.equal(Buffer.from(encoded).toString('hex'), Buffer.from(again).toString('hex'));
    const envelope = signEnvelope(
      unsignedTransferEnvelope({
        transactionType: 'PRODUCTIVE_CAPACITY',
        body: {
          family: 'PRODUCTIVE_CAPACITY',
          header: fixtureHeader({
            purpose: 'sunrey.productive-capacity.record',
            idempotencyKey: 'idem.capacity.1',
          }),
          capacity: object,
          rightsExercised: [fixtureRight({ rightType: 'USE', rightId: 'right.use.alice', purpose: 'sunrey.productive-capacity.record' })],
          quantity: fixtureQuantity(3n),
        },
      }),
      VECTOR_ED25519_SEED,
    );
    const state = seededState();
    state.grantRight(fixtureRight({ rightType: 'USE', rightId: 'right.use.alice', purpose: 'sunrey.productive-capacity.record' }));
    state.setCapacity(object.objectId, 10n);
    const result = processTransaction(encodeEnvelope(envelope), state, CONTEXT);
    assert.equal(result.ok, true);
  });

  it('rejects a raw sensitive payload', () => {
    const envelope = signedTransferEnvelope({
      body: fixtureTransferBody({
        header: fixtureHeader({ purpose: 'sunrey.native-asset.transfer' }),
        executionConditions: 'rawPdv=ciphertext-from-vault',
      }),
    });
    const result = processTransaction(encodeEnvelope(envelope), seededState(), CONTEXT);
    assert.equal(result.ok, false);
    if (result.ok) {
      return;
    }
    assert.equal(result.error.code, 'INVALID_OBJECT_TYPE');
  });

  it('rejects MoonRey issuance', () => {
    const envelope = signedTransferEnvelope({
      body: fixtureTransferBody({
        operation: 'ISSUE',
        amount: fixtureQuantity(1n, 'MOONREY_COIN'),
      }),
    });
    const result = processTransaction(encodeEnvelope(envelope), seededState(), CONTEXT);
    assert.equal(result.ok, false);
    if (result.ok) {
      return;
    }
    assert.equal(result.error.code, 'TRANSACTION_NOT_ACTIVATED');
  });

  it('rejects overflow and non-integer quantities', () => {
    assert.equal(parseScaledUnits('1.5'), null);
    assert.equal(parseScaledUnits('01'), null);
    assert.equal(parseScaledUnits('9'.repeat(39)), null);
    const quantity = fixtureQuantity(25n);
    const asset = toAssetQuantity(quantity);
    assert.equal(asset instanceof AssetQuantity, true);
    assert.equal(asset.assetId, NATIVE_ASSET_PROTOCOL_KEYS.SUNREY_COIN);
  });

  it('rejects a malformed signature descriptor', () => {
    const envelope = unsignedTransferEnvelope();
    const broken = Object.freeze({
      ...envelope,
      authentication: Object.freeze({
        ...envelope.authentication,
        publicKey: new Uint8Array(3),
        signature: new Uint8Array(8),
      }),
    });
    const result = processTransaction(encodeEnvelope(broken), seededState(), CONTEXT);
    assert.equal(result.ok, false);
    if (result.ok) {
      return;
    }
    assert.equal(result.error.code, 'INVALID_SIGNATURE');
  });

  it('refuses to hash the debug JSON projection', () => {
    const envelope = signedTransferEnvelope();
    const json = toDebugJson(envelope);
    assert.equal(json.notForConsensusHash, true);
    assert.equal(json.tickerStatus, 'NOT_ASSIGNED');
    const canonical = transactionIdOf(envelope);
    const jsonBytes = Buffer.from(JSON.stringify(json));
    const accidental = hashForDomain('SUNREY_TX_V1', envelope.networkId, envelope.chainId, jsonBytes);
    assert.notEqual(accidental, canonical);
    assert.throws(() => debugJsonMustNotBeHashed(json), /debug JSON/);
  });

  it('binds every hash domain and keeps rejection codes stable', () => {
    const payload = new Uint8Array([1, 2, 3]);
    const hashes = HASH_DOMAINS.map((domain) => hashForDomain(domain, PROTOCOL_NETWORK_ID, PROTOCOL_CHAIN_ID, payload));
    assert.equal(new Set(hashes).size, HASH_DOMAINS.length);
    assert.equal(PROTOCOL_REJECTION_CODES.includes('REPLAY'), true);
    assert.equal(PROTOCOL_REJECTION_CODES.includes('INVALID_QUANTITY'), true);
    const decoded = decodeEnvelope(encodeEnvelope(signedTransferEnvelope()));
    assert.equal(decoded.transactionType, 'NATIVE_ASSET');
  });

  it('stores reusable language-neutral test vectors', () => {
    assert.equal(existsSync(VECTOR_PATH), true);
    const vectors = JSON.parse(readFileSync(VECTOR_PATH, 'utf8')) as {
      codecId: string;
      tickerStatus: string;
      moonreyIssuance: string;
      cases: readonly {
        readonly name: string;
        readonly expected: string;
        readonly signedBytesHex?: string;
        readonly transactionIdHex?: string;
      }[];
    };
    assert.equal(vectors.codecId, 'sunrey.protobuf.canonical.v1');
    assert.equal(vectors.tickerStatus, 'NOT_ASSIGNED');
    assert.equal(vectors.moonreyIssuance, 'unavailable');
    const names = vectors.cases.map((item) => item.name);
    for (const required of [
      'valid-sunrey-coin-transfer-shape',
      'identical-bytes',
      'wrong-network',
      'replay',
      'expired',
      'unknown-fields',
      'ai-capability-mismatch',
      'raw-sensitive-payload',
      'moonrey-issuance-unavailable',
    ]) {
      assert.equal(names.includes(required), true, required);
    }
    const transfer = vectors.cases.find((item) => item.name === 'valid-sunrey-coin-transfer-shape');
    assert.ok(transfer);
    assert.ok(transfer.signedBytesHex);
    assert.ok(transfer.transactionIdHex);
    const envelope = signedTransferEnvelope();
    assert.equal(Buffer.from(encodeEnvelope(envelope)).toString('hex'), transfer.signedBytesHex);
    assert.equal(transactionIdOf(envelope), transfer.transactionIdHex);
  });
});
