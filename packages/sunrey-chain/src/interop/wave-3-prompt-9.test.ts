import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  assertInteropKeySeparation,
  createInteropCircuitBreakers,
  devAssetOnly,
  envelopeDigest,
  envelopeReplayKey,
  failClosedActivationGate,
  guardInteropMessage,
  interopMayCall,
  InteropSecurityFailure,
  productionInteropRemainsDisabled,
  requireEgress,
  requireProductionInterop,
  sampleEnvelope,
  validateEnvelopeStructure,
  watcherSecurityModel,
  DEFAULT_INTEROP_NETWORK_POLICY,
  ENVELOPE_SCHEMA_VERSION,
  DOMAIN_ENVELOPE,
  INTEROP_SIGNING_PURPOSE,
} from './security.ts';
import { DEV_INTEROP_TEST_ASSET } from './types.ts';

describe('wave 3 prompt 9 interop security', () => {
  it('keeps production interop disabled by default', () => {
    const gate = failClosedActivationGate();
    assert.equal(gate.state, 'DISABLED');
    assert.throws(() => requireProductionInterop(gate), (err: unknown) => {
      return err instanceof InteropSecurityFailure && err.code === 'PRODUCTION_INTEROP_DISABLED';
    });
    assert.equal(
      productionInteropRemainsDisabled({
        ...process.env,
        NODE_ENV: 'production',
        SUNREY_INTEROP_RPC_URL: 'https://rpc.example',
      }),
      true,
    );
  });

  it('rejects duplicate replay keys and expired envelopes', () => {
    const envelope = sampleEnvelope('hello');
    const replayA = envelopeReplayKey(envelope);
    const replayB = envelopeReplayKey(envelope);
    assert.equal(replayA, replayB);
    validateEnvelopeStructure(envelope, 1_700_000_000, 1);
    const expired = { ...envelope, expiryTimestamp: 1 };
    assert.throws(
      () => validateEnvelopeStructure(expired, 9_999_999, 1),
      (err: unknown) => err instanceof InteropSecurityFailure && err.code === 'MESSAGE_EXPIRED',
    );
  });

  it('rejects malformed envelope versions and domains', () => {
    const envelope = sampleEnvelope('x');
    assert.throws(
      () => validateEnvelopeStructure({ ...envelope, envelopeVersion: 99 }, 1, 1),
      (err: unknown) =>
        err instanceof InteropSecurityFailure && err.code === 'UNSUPPORTED_MESSAGE_VERSION',
    );
    assert.throws(
      () => validateEnvelopeStructure({ ...envelope, domain: 'evil' }, 1, 1),
      (err: unknown) => err instanceof InteropSecurityFailure && err.code === 'SCHEMA_INVALID',
    );
  });

  it('enforces circuit breakers and limits', () => {
    const circuits = createInteropCircuitBreakers();
    circuits.globalPaused = true;
    assert.throws(
      () => guardInteropMessage(circuits, 'net_a', null, 0n),
      (err: unknown) => err instanceof InteropSecurityFailure && err.code === 'GLOBAL_INTEROP_PAUSED',
    );
    circuits.globalPaused = false;
    circuits.pausedNetworks.add('net_a');
    assert.throws(
      () => guardInteropMessage(circuits, 'net_a', null, 0n),
      (err: unknown) => err instanceof InteropSecurityFailure && err.code === 'NETWORK_PAUSED',
    );
    circuits.pausedNetworks.clear();
    circuits.valueLimitMinor = 10n;
    assert.throws(
      () => guardInteropMessage(circuits, 'net_a', null, 20n),
      (err: unknown) => err instanceof InteropSecurityFailure && err.code === 'VALUE_LIMIT_EXCEEDED',
    );
  });

  it('blocks relayer admin RPC and watcher submission', () => {
    assert.throws(
      () => interopMayCall('RELAYER', 'POST', '/admin/produce-block'),
      (err: unknown) => err instanceof InteropSecurityFailure && err.code === 'RPC_METHOD_FORBIDDEN',
    );
    assert.throws(
      () => interopMayCall('WATCHER', 'POST', '/v1/transactions'),
      (err: unknown) => err instanceof InteropSecurityFailure && err.code === 'RPC_METHOD_FORBIDDEN',
    );
    interopMayCall('RELAYER', 'GET', '/v1/chain/status');
  });

  it('denies privileged network egress', () => {
    requireEgress(DEFAULT_INTEROP_NETWORK_POLICY, 'WATCHER', 'fixture://external-dev-rpc');
    assert.throws(
      () => requireEgress(DEFAULT_INTEROP_NETWORK_POLICY, 'WATCHER', 'postgres://ledger'),
      (err: unknown) => err instanceof InteropSecurityFailure && err.code === 'NETWORK_EGRESS_DENIED',
    );
    assert.throws(
      () =>
        requireEgress(
          DEFAULT_INTEROP_NETWORK_POLICY,
          'RELAYER',
          'https://vault.sunrey.internal/keys',
        ),
      (err: unknown) => err instanceof InteropSecurityFailure && err.code === 'NETWORK_EGRESS_DENIED',
    );
  });

  it('separates interop keys from validator and treasury keys', () => {
    assertInteropKeySeparation([INTEROP_SIGNING_PURPOSE, 'WATCHER_ATTESTATION']);
    assert.throws(
      () => assertInteropKeySeparation(['VALIDATOR_CONSENSUS_SIGNING']),
      (err: unknown) => err instanceof InteropSecurityFailure && err.code === 'KEY_PURPOSE_FORBIDDEN',
    );
  });

  it('documents single-watcher security model truthfully', () => {
    assert.equal(watcherSecurityModel(1), 'SINGLE_WATCHER_UNTRUSTED_UNTIL_VERIFIED');
    assert.equal(watcherSecurityModel(3), 'MULTI_WATCHER_QUORUM_REQUIRED_FOR_PRODUCTION');
  });

  it('keeps envelope digests deterministic', () => {
    const envelope = sampleEnvelope('deterministic');
    assert.equal(envelopeDigest(envelope), envelopeDigest(envelope));
    assert.equal(envelope.envelopeVersion, ENVELOPE_SCHEMA_VERSION);
    assert.equal(envelope.domain, DOMAIN_ENVELOPE);
  });

  it('restricts production assets', () => {
    devAssetOnly(DEV_INTEROP_TEST_ASSET);
    assert.throws(
      () => devAssetOnly('SUNREY_COIN'),
      (err: unknown) =>
        err instanceof InteropSecurityFailure && err.code === 'PRODUCTION_ASSET_UNAVAILABLE',
    );
  });
});
