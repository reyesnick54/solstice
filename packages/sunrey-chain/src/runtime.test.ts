import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  ACTIVE_DEPLOYABLE_NETWORK,
  ALLOWED_OPERATOR_TRANSITIONS,
  CHAOS_SCENARIOS,
  DEFAULT_MEMPOOL_POLICY,
  EXPLORER_API_ROUTES,
  EXPLORER_AUTHORITATIVE,
  FORBIDDEN_PUBLIC_RPC_METHODS,
  MAINNET_INACTIVE,
  NETWORK_ENVIRONMENTS,
  PHASE_G_03_RUNTIME,
  PRODUCTION_PRIVATE_KEYS_COMMITTED,
  PUBLIC_RPC_METHODS,
  RUNTIME_METRICS,
  TESTNET_DEPLOYMENT_PROFILES,
  admitToMempool,
  allowRequest,
  assertSeparatedRoles,
  classifyFinality,
  generateGenesis,
  identityFor,
  mainnetGenesisFailsClosed,
  methodAllowedOnPlane,
  metricSample,
  observeTransaction,
  refuseMainnetActivation,
  rejectCrossNetworkReplay,
  requiredFieldsPresent,
  rotateReference,
  runChaosSuite,
  selectByFeePriority,
  snapshotTrust,
  toOperatorLifecycle,
} from './runtime/index.ts';

describe('Phase G Prompt 3 chain runtime productization', () => {
  it('exposes explicit network environments and blocks cross-network replay', () => {
    assert.deepEqual(NETWORK_ENVIRONMENTS, [
      'LOCAL',
      'DEVNET',
      'TESTNET',
      'PREPRODUCTION',
      'MAINNET',
    ]);
    assert.equal(ACTIVE_DEPLOYABLE_NETWORK, 'TESTNET');
    assert.equal(MAINNET_INACTIVE, true);
    assert.equal(
      rejectCrossNetworkReplay({
        signedNetworkId: 'net_sunrey_testnet_1',
        signedChainId: 'chn_sunrey_testnet_1',
        localNetworkId: 'net_sunrey_local_dev',
        localChainId: 'chn_sunrey_local_dev',
      }),
      'WRONG_NETWORK',
    );
    assert.ok(identityFor('net_sunrey_testnet_1', 'chn_sunrey_testnet_1'));
  });

  it('requires the canonical transaction fields', () => {
    assert.equal(
      requiredFieldsPresent({
        sender: 'acct_1',
        nonce: 1n,
        action: 'NATIVE_ASSET',
        amountAsset: 'SUNREY_COIN',
        feeMinorUnits: 1n,
        networkId: 'net_sunrey_testnet_1',
        chainId: 'chn_sunrey_testnet_1',
        expiresAtMs: 1n,
        signature: 'aa',
        publicKey: 'bb',
        transactionHash: 'cc',
      }),
      true,
    );
  });

  it('does not treat local observation as finality', () => {
    assert.equal(classifyFinality('LOCAL_BLOCK_OBSERVATION'), 'INCLUDED');
    const observed = observeTransaction('tx1', 'LOCAL_BLOCK_OBSERVATION', 4);
    assert.equal(observed.status, 'INCLUDED');
    assert.equal(observed.localObservationIsNotFinality, true);
    assert.equal(observeTransaction('tx1', 'COMMIT_CERTIFICATE', 4).status, 'FINALIZED');
  });

  it('enforces mempool capacity, duplicates, expiry, and fee priority', () => {
    const known = new Set(['dup']);
    assert.equal(
      admitToMempool({
        knownIds: known,
        count: 0,
        bytes: 0,
        perActor: 0,
        txId: 'dup',
        size: 10,
        expired: false,
        valid: true,
      }).ok,
      false,
    );
    assert.equal(
      admitToMempool({
        knownIds: new Set(),
        count: DEFAULT_MEMPOOL_POLICY.maxCount,
        bytes: 0,
        perActor: 0,
        txId: 'new',
        size: 10,
        expired: false,
        valid: true,
      }).ok,
      false,
    );
    assert.deepEqual(
      selectByFeePriority([
        { txId: 'a', fee: 1n },
        { txId: 'b', fee: 5n },
      ]),
      ['b', 'a'],
    );
  });

  it('maps validator lifecycle and refuses unaided mainnet activation', () => {
    assert.equal(toOperatorLifecycle('BONDED'), 'REGISTERED');
    assert.equal(toOperatorLifecycle('JAILED'), 'SUSPENDED');
    assert.equal(toOperatorLifecycle('PENDING_EXIT'), 'EXITING');
    assert.deepEqual(ALLOWED_OPERATOR_TRANSITIONS.ACTIVE, ['EXITING', 'SUSPENDED']);
    assert.equal(refuseMainnetActivation('MAINNET', false), 'MAINNET_ACTIVATION_REQUIRES_GOVERNANCE');
  });

  it('separates RPC planes and rate-limits public traffic', () => {
    assert.equal(methodAllowedOnPlane('PUBLIC_RPC', 'POST', '/admin/produce-block'), false);
    assert.equal(methodAllowedOnPlane('ADMIN_RPC', 'POST', '/admin/produce-block'), true);
    assert.ok(PUBLIC_RPC_METHODS.includes('POST /v1/transactions'));
    assert.ok(FORBIDDEN_PUBLIC_RPC_METHODS.includes('POST /admin/produce-block'));
    let state = { count: 32, windowStartMs: 0 };
    const denied = allowRequest(state, 10);
    assert.equal(denied.allowed, false);
  });

  it('fails mainnet genesis closed and keeps explorer non-authoritative', () => {
    assert.equal(mainnetGenesisFailsClosed(), true);
    assert.equal(generateGenesis({
      environment: 'TESTNET',
      schemaRegistryHash: 'aa',
      cryptoPolicyId: 'cs',
      governanceFieldsComplete: false,
      economicParametersApproved: false,
      counselConfirmed: false,
    }).ok, true);
    assert.equal(EXPLORER_AUTHORITATIVE, false);
    assert.ok(EXPLORER_API_ROUTES.includes('GET /v1/blocks'));
  });

  it('keeps key roles separated and never commits production private keys', () => {
    assert.equal(PRODUCTION_PRIVATE_KEYS_COMMITTED, false);
    assert.equal(
      assertSeparatedRoles([
        { role: 'VALIDATOR_CONSENSUS', keyId: 'k1', publicKeyHex: 'aa', hsmOrKmsRef: 'kms://cons', privateMaterialPresent: false },
        { role: 'WALLET_USER', keyId: 'k2', publicKeyHex: 'bb', hsmOrKmsRef: null, privateMaterialPresent: false },
        { role: 'NODE_IDENTITY', keyId: 'k3', publicKeyHex: 'cc', hsmOrKmsRef: null, privateMaterialPresent: false },
        { role: 'ADMINISTRATIVE', keyId: 'k4', publicKeyHex: 'dd', hsmOrKmsRef: 'kms://admin', privateMaterialPresent: false },
      ]),
      'OK',
    );
    const rotated = rotateReference(
      { role: 'VALIDATOR_CONSENSUS', keyId: 'k1', publicKeyHex: 'aa', hsmOrKmsRef: 'kms://cons', privateMaterialPresent: false },
      'k1-next',
    );
    assert.equal(rotated.next.keyId, 'k1-next');
  });

  it('exposes metrics without secrets and verifies snapshots before trust', () => {
    assert.equal(RUNTIME_METRICS.length, 10);
    assert.equal(metricSample('block_height', 12, { network: 'testnet' }).value, 12);
    assert.throws(() => metricSample('rpc_latency_ms', 1, { token: 'secret' }));
    assert.equal(
      snapshotTrust({
        manifestHash: 'aaa',
        computedHash: 'aaa',
        chainId: 'chn_sunrey_testnet_1',
        expectedChainId: 'chn_sunrey_testnet_1',
      }),
      'TRUSTED_FOR_NON_PRODUCTION',
    );
    assert.equal(
      snapshotTrust({
        manifestHash: 'aaa',
        computedHash: 'bbb',
        chainId: 'chn_sunrey_testnet_1',
        expectedChainId: 'chn_sunrey_testnet_1',
      }),
      'REJECTED',
    );
  });

  it('deploys testnet profiles only and passes the chaos suite contract', () => {
    assert.equal(TESTNET_DEPLOYMENT_PROFILES.every((row) => row.mainnetDeployed === false), true);
    assert.equal(PHASE_G_03_RUNTIME.replacedByEthereumOrEvm, false);
    assert.equal(PHASE_G_03_RUNTIME.mainnetActive, false);
    const outcomes = runChaosSuite({
      VALIDATOR_OFFLINE: 'REMAINING_QUORUM_FINALIZES',
      NETWORK_PARTITION: 'NO_CONFLICTING_FINALITY',
      SLOW_VALIDATOR: 'ROUND_CHANGE_THEN_COMMIT',
      INVALID_TRANSACTION_FLOOD: 'MEMPOOL_OR_RPC_REJECTS',
      INVALID_BLOCK: 'BLOCK_REJECTED',
      DUPLICATE_TRANSACTION: 'REPLAY_REJECTED',
      RPC_OVERLOAD: 'RATE_LIMITED',
      NODE_RESTART: 'STATE_RECOVERED',
      STATE_RESTORE: 'INTEGRITY_VERIFIED',
    });
    assert.equal(outcomes.length, CHAOS_SCENARIOS.length);
    assert.equal(outcomes.every((row) => row.passed), true);
  });
});
