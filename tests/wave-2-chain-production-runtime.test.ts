import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { ENVIRONMENT, LIVE_MOONREY_PRODUCTIVE_ISSUANCE_ENABLED } from '../packages/config/src/flags.ts';
import {
  ENVIRONMENT_MATRIX,
  MAINNET_INACTIVE,
  MULTI_VALIDATOR_DEVNET,
  PUBLIC_RPC_METHODS,
  RUNTIME_METRICS,
  WAVE2_PRODUCTION_RUNTIME,
  assertEnvironmentBinding,
  assertProtocolCompatible,
  assertResourceIsolation,
  assertSafeLogPayload,
  defaultSecurityConfig,
  developmentSignatureInvalidOnMainnet,
  evaluateMainnetRuntimeGate,
  evaluateRuntimeReadiness,
  mainnetGenesisFailsClosed,
  methodAllowedOnPlane,
  nodeRoleConfig,
  refuseMainnetRuntimeAction,
  validateNodeRoleConfig,
  validateSecurityConfig,
} from '../packages/sunrey-chain/src/runtime/index.ts';

const ROOT = join(import.meta.dirname, '..');

describe('Wave 2 — SunRey chain production runtime', () => {
  it('documents runtime architecture and operations runbook', () => {
    const arch = readFileSync(join(ROOT, 'docs/architecture/WAVE2_PRODUCTION_RUNTIME.md'), 'utf8');
    const runbook = readFileSync(join(ROOT, 'docs/runbooks/SUNREY_NODE_OPERATIONS.md'), 'utf8');
    assert.match(arch, /MAINNET_ACTIVE=false/);
    assert.match(arch, /productionEconomicsAuthorized=false/);
    assert.match(arch, /Supported environments/i);
    assert.match(runbook, /startup/i);
    assert.match(runbook, /shutdown/i);
    assert.match(runbook, /recovery/i);
  });

  it('keeps simulation posture and mainnet fail-closed', () => {
    assert.equal(ENVIRONMENT, 'simulation');
    assert.equal(MAINNET_INACTIVE, true);
    assert.equal(LIVE_MOONREY_PRODUCTIVE_ISSUANCE_ENABLED, false);
    assert.equal(mainnetGenesisFailsClosed(), true);
    const gate = evaluateMainnetRuntimeGate();
    assert.equal(gate.passed, false);
    assert.equal(gate.mainnetActive, false);
    assert.equal(gate.productionEconomicsAuthorized, false);
    assert.ok(gate.missingBlockerIds.length > 0);
    assert.equal(refuseMainnetRuntimeAction('START_NODE', 'MAINNET'), 'MAINNET_RUNTIME_REFUSED');
    assert.equal(refuseMainnetRuntimeAction('ACTIVATE_SUNREY_ISSUANCE', 'TESTNET'), 'OK');
  });

  it('defines environment isolation matrix for all supported environments', () => {
    assert.equal(ENVIRONMENT_MATRIX.length, 5);
    const environments = new Set(ENVIRONMENT_MATRIX.map((row) => row.environment));
    assert.ok(environments.has('LOCAL'));
    assert.ok(environments.has('DEVNET'));
    assert.ok(environments.has('TESTNET'));
    assert.ok(environments.has('PREPRODUCTION'));
    assert.ok(environments.has('MAINNET'));
    for (const row of ENVIRONMENT_MATRIX) {
      assert.equal(row.productionEconomicsAuthorized, false);
      assert.ok(row.replayBinding.startsWith('sunrey.replay.v1|'));
    }
    const mainnet = ENVIRONMENT_MATRIX.find((row) => row.environment === 'MAINNET');
    assert.ok(mainnet);
    assert.equal(mainnet.deployable, false);
  });

  it('rejects cross-environment identity binding and resource reuse', () => {
    const devnet = assertEnvironmentBinding({
      expectedEnvironment: 'DEVNET',
      networkId: 'net_sunrey_development',
      chainId: 'chn_sunrey_development',
    });
    assert.equal(devnet.ok, true);

    const wrong = assertEnvironmentBinding({
      expectedEnvironment: 'TESTNET',
      networkId: 'net_sunrey_development',
      chainId: 'chn_sunrey_development',
    });
    assert.equal(wrong.ok, false);
    if (!wrong.ok) {
      assert.ok(wrong.code === 'CROSS_ENVIRONMENT_REUSE' || wrong.code === 'WRONG_NETWORK');
    }

    const reuse = assertResourceIsolation({
      sourceEnvironment: 'DEVNET',
      targetEnvironment: 'MAINNET',
      resource: 'DATABASE',
      sourceValue: 'sunrey_chain_devnet',
      targetValue: 'sunrey_chain_devnet',
    });
    assert.equal(reuse.ok, false);

    assert.equal(
      developmentSignatureInvalidOnMainnet({
        signedNetworkId: 'net_sunrey_development',
        signedChainId: 'chn_sunrey_development',
      }),
      false,
    );
  });

  it('enforces node role secure boundaries', () => {
    const validator = nodeRoleConfig('VALIDATOR', 'TESTNET');
    const rpc = nodeRoleConfig('READ_ONLY_RPC', 'TESTNET');
    assert.equal(validateNodeRoleConfig(validator).ok, true);
    assert.equal(validateNodeRoleConfig(rpc).ok, true);
    assert.equal(validator.holdsValidatorPrivateKeys, true);
    assert.equal(rpc.holdsValidatorPrivateKeys, false);
    assert.equal(validator.exposesPublicRpc, false);
    assert.equal(rpc.exposesPublicRpc, true);

    const bad = {
      ...rpc,
      holdsValidatorPrivateKeys: true as const,
    };
    assert.equal(validateNodeRoleConfig(bad).ok, false);
  });

  it('evaluates meaningful readiness beyond process liveness', () => {
    const ready = evaluateRuntimeReadiness({
      environment: 'TESTNET',
      role: 'VALIDATOR',
      storageAvailable: true,
      genesisLoaded: true,
      genesisHash: 'a'.repeat(64),
      consensusInitialized: true,
      stateConsistent: true,
      syncLagBlocks: 0n,
      maxSyncLagBlocks: 2n,
      validatorKeyAvailable: true,
      canonicalStateCorruption: false,
      localProtocolVersion: '1',
      networkProtocolVersion: '1',
      diskPressure: false,
      snapshotHealthy: true,
    });
    assert.equal(ready.ready, true);
    assert.equal(ready.health, 'HEALTHY');

    const notReady = evaluateRuntimeReadiness({
      environment: 'TESTNET',
      role: 'VALIDATOR',
      storageAvailable: true,
      genesisLoaded: true,
      genesisHash: 'a'.repeat(64),
      consensusInitialized: true,
      stateConsistent: true,
      syncLagBlocks: 99n,
      maxSyncLagBlocks: 2n,
      validatorKeyAvailable: false,
      canonicalStateCorruption: false,
      localProtocolVersion: '1',
      networkProtocolVersion: '1',
      diskPressure: false,
      snapshotHealthy: true,
    });
    assert.equal(notReady.ready, false);
  });

  it('rejects incompatible protocol versions', () => {
    assert.equal(assertProtocolCompatible({ localVersion: '1', networkVersion: '1' }).ok, true);
    const mismatch = assertProtocolCompatible({ localVersion: '1', networkVersion: '2' });
    assert.equal(mismatch.ok, false);
    if (!mismatch.ok) {
      assert.ok(mismatch.reason === 'VERSION_MISMATCH' || mismatch.reason === 'UNSUPPORTED_VERSION');
    }
  });

  it('exposes operational RPC surfaces without admin balance mutation', () => {
    assert.ok(PUBLIC_RPC_METHODS.includes('GET /v1/health'));
    assert.ok(PUBLIC_RPC_METHODS.includes('GET /v1/ready'));
    assert.ok(PUBLIC_RPC_METHODS.includes('GET /v1/chain/blocks/finalized'));
    assert.ok(PUBLIC_RPC_METHODS.includes('GET /v1/assets/supply'));
    assert.equal(methodAllowedOnPlane('PUBLIC_RPC', 'POST', '/admin/mutate-balance'), false);
    assert.equal(methodAllowedOnPlane('PUBLIC_RPC', 'GET', '/v1/chain/status'), true);
    assert.equal(methodAllowedOnPlane('ADMIN_RPC', 'POST', '/admin/produce-block'), true);
  });

  it('defines observability metrics without secret labels', () => {
    assert.ok(RUNTIME_METRICS.includes('finalized_height'));
    assert.ok(RUNTIME_METRICS.includes('peer_count'));
    assert.ok(RUNTIME_METRICS.includes('supply_reconciliation_status'));
    assert.equal(assertSafeLogPayload('block_height=42'), 'OK');
    assert.equal(assertSafeLogPayload('private_key=deadbeef'), 'SECRET_LEAK');
  });

  it('applies secure defaults for RPC security configuration', () => {
    const publicCfg = defaultSecurityConfig('PUBLIC_RPC');
    const adminCfg = defaultSecurityConfig('ADMIN_RPC');
    assert.equal(validateSecurityConfig(publicCfg).ok, true);
    assert.equal(validateSecurityConfig(adminCfg).ok, true);
    assert.equal(publicCfg.exposeStackTraces, false);
    assert.equal(adminCfg.requireAdminAuth, true);
  });

  it('supports reproducible multi-validator devnet startup scripts', () => {
    assert.equal(existsSync(join(ROOT, 'scripts/sunrey-devnet.sh')), true);
    assert.equal(existsSync(join(ROOT, 'scripts/sunrey-validator-devnet.sh')), true);
    assert.equal(MULTI_VALIDATOR_DEVNET.length, 2);
    assert.ok(MULTI_VALIDATOR_DEVNET.some((row) => row.validatorCount === 4));
  });

  it('extends canonical chain runtime owner without parallel packages', () => {
    assert.equal(WAVE2_PRODUCTION_RUNTIME.mainnetActive, false);
    assert.equal(WAVE2_PRODUCTION_RUNTIME.productionEconomicsAuthorized, false);
    assert.equal(existsSync(join(ROOT, 'packages/blockchain')), false);
    assert.equal(existsSync(join(ROOT, 'packages/sunrey-node')), false);
    assert.equal(existsSync(join(ROOT, 'packages/sunrey-rpc')), false);
  });
});
