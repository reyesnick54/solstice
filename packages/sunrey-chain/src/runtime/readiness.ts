/**
 * Wave 2 — runtime health and readiness semantics.
 *
 * A process being alive does not mean it is blockchain-ready.
 */

import type { NetworkEnvironment } from './identity.ts';
import { assertProtocolCompatible } from './protocol-version.ts';

export type RuntimeHealthStatus = 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY';

export type RuntimeReadinessCheck = {
  readonly id: string;
  readonly ok: boolean;
  readonly detail: string;
};

export type RuntimeReadinessInput = {
  readonly environment: NetworkEnvironment;
  readonly role: 'VALIDATOR' | 'FULL_NODE' | 'READ_ONLY_RPC';
  readonly storageAvailable: boolean;
  readonly genesisLoaded: boolean;
  readonly genesisHash: string;
  readonly consensusInitialized: boolean;
  readonly stateConsistent: boolean;
  readonly syncLagBlocks: bigint;
  readonly maxSyncLagBlocks: bigint;
  readonly validatorKeyAvailable: boolean;
  readonly canonicalStateCorruption: boolean;
  readonly localProtocolVersion: string;
  readonly networkProtocolVersion: string;
  readonly diskPressure: boolean;
  readonly snapshotHealthy: boolean;
};

export type RuntimeReadinessReport = {
  readonly ready: boolean;
  readonly health: RuntimeHealthStatus;
  readonly environment: NetworkEnvironment;
  readonly role: RuntimeReadinessInput['role'];
  readonly checks: readonly RuntimeReadinessCheck[];
};

export function evaluateRuntimeHealth(input: {
  readonly processAlive: boolean;
  readonly storageAvailable: boolean;
  readonly canonicalStateCorruption: boolean;
}): RuntimeHealthStatus {
  if (!input.processAlive || input.canonicalStateCorruption) {
    return 'UNHEALTHY';
  }
  if (!input.storageAvailable) {
    return 'DEGRADED';
  }
  return 'HEALTHY';
}

export function evaluateRuntimeReadiness(input: RuntimeReadinessInput): RuntimeReadinessReport {
  const protocol = assertProtocolCompatible({
    localVersion: input.localProtocolVersion,
    networkVersion: input.networkProtocolVersion,
  });
  const syncOk = input.syncLagBlocks <= input.maxSyncLagBlocks;
  const validatorKeyOk = input.role !== 'VALIDATOR' || input.validatorKeyAvailable;
  const checks: RuntimeReadinessCheck[] = [
    {
      id: 'storage-available',
      ok: input.storageAvailable && !input.diskPressure,
      detail: input.diskPressure ? 'disk pressure' : 'ok',
    },
    {
      id: 'genesis-loaded',
      ok: input.genesisLoaded && input.genesisHash.length === 64,
      detail: input.genesisHash || 'missing',
    },
    {
      id: 'consensus-initialized',
      ok: input.consensusInitialized,
      detail: input.consensusInitialized ? 'initialized' : 'not initialized',
    },
    {
      id: 'state-consistent',
      ok: input.stateConsistent && !input.canonicalStateCorruption,
      detail: input.canonicalStateCorruption ? 'corruption detected' : 'consistent',
    },
    {
      id: 'sync-within-bounds',
      ok: syncOk,
      detail: `lag ${input.syncLagBlocks.toString()} / max ${input.maxSyncLagBlocks.toString()}`,
    },
    {
      id: 'validator-key',
      ok: validatorKeyOk,
      detail: validatorKeyOk ? 'available or not required' : 'validator key missing',
    },
    {
      id: 'protocol-version',
      ok: protocol.ok,
      detail: protocol.ok ? input.localProtocolVersion : protocol.reason,
    },
    {
      id: 'snapshot-status',
      ok: input.snapshotHealthy,
      detail: input.snapshotHealthy ? 'healthy' : 'snapshot issue',
    },
  ];
  const ready = checks.every((check) => check.ok);
  const health = evaluateRuntimeHealth({
    processAlive: true,
    storageAvailable: input.storageAvailable,
    canonicalStateCorruption: input.canonicalStateCorruption,
  });
  return {
    ready,
    health,
    environment: input.environment,
    role: input.role,
    checks,
  };
}

export const READINESS_PROBE_PATHS = Object.freeze({
  liveness: '/health',
  readiness: '/ready',
  versionedLiveness: '/v1/health',
  versionedReadiness: '/v1/ready',
});
