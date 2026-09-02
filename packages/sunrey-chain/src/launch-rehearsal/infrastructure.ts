/**
 * Production-candidate topology, storage, secrets, and signer fencing
 * for the rehearsal.
 *
 * Chunk 66/67 interfaces are represented by the existing ops topology,
 * SecretReference workload identity, and production-candidate storage
 * profile. No committed private secrets.
 */

import { secretRef, type SecretReference } from '../../../security/src/secrets.ts';
import { SignerFencingController } from '../ops/fencing.ts';
import { createSnapshot, genesisFingerprint, verifySnapshot } from '../ops/snapshots.ts';
import {
  createSignerSafetyBackup,
  dumpApplicationDatabase,
  verifyDatabaseDump,
} from '../ops/backup.ts';
import { REHEARSAL_CHAIN_ID, REHEARSAL_NETWORK_ID } from './identity.ts';
import { sevenRehearsalValidators } from './genesis.ts';

export const REHEARSAL_FAILURE_DOMAINS = ['fd_rehearsal_alpha', 'fd_rehearsal_bravo', 'fd_rehearsal_charlie'] as const;
export const PRODUCTION_CANDIDATE_STORAGE_ENGINE = 'sunrey.storage.production-candidate.v1' as const;
export const PRODUCTION_CANDIDATE_POSTGRES_PROFILE = 'sunrey.postgres.production-candidate.v1' as const;

export type RehearsalSentry = {
  readonly sentryId: string;
  readonly validatorId: string;
  readonly domainId: string;
  readonly canSign: false;
};

export type RehearsalService = {
  readonly serviceId: string;
  readonly role:
    | 'RPC'
    | 'EXPLORER'
    | 'MONITORING'
    | 'BACKUP'
    | 'ORACLE_COLLECTOR'
    | 'RELAYER'
    | 'EXCHANGE_SANDBOX'
    | 'CUSTODY_SANDBOX';
  readonly domainId: string;
  readonly secretRef: SecretReference;
  online: boolean;
};

export type RehearsalTopology = {
  readonly validators: readonly { readonly validatorId: string; readonly domainId: string; readonly votingPower: bigint }[];
  readonly sentries: readonly RehearsalSentry[];
  readonly services: readonly RehearsalService[];
  readonly failureDomains: readonly string[];
};

export function rehearsalTopology(): RehearsalTopology {
  const validators = sevenRehearsalValidators().map((row) =>
    Object.freeze({
      validatorId: row.validatorId,
      domainId: row.failureDomain,
      votingPower: row.votingPower,
    }),
  );
  const sentries: RehearsalSentry[] = validators.flatMap((row) => [
    Object.freeze({
      sentryId: `sentry_${row.validatorId}_a`,
      validatorId: row.validatorId,
      domainId: row.domainId,
      canSign: false as const,
    }),
    Object.freeze({
      sentryId: `sentry_${row.validatorId}_b`,
      validatorId: row.validatorId,
      domainId: row.domainId,
      canSign: false as const,
    }),
  ]);
  const services: RehearsalService[] = [
    { serviceId: 'rpc_alpha', role: 'RPC', domainId: 'fd_rehearsal_alpha', secretRef: secretRef('simulation', 'rehearsal/rpc-alpha'), online: true },
    { serviceId: 'rpc_bravo', role: 'RPC', domainId: 'fd_rehearsal_bravo', secretRef: secretRef('simulation', 'rehearsal/rpc-bravo'), online: true },
    { serviceId: 'rpc_charlie', role: 'RPC', domainId: 'fd_rehearsal_charlie', secretRef: secretRef('simulation', 'rehearsal/rpc-charlie'), online: true },
    { serviceId: 'explorer_alpha', role: 'EXPLORER', domainId: 'fd_rehearsal_alpha', secretRef: secretRef('simulation', 'rehearsal/explorer'), online: true },
    { serviceId: 'monitor_alpha', role: 'MONITORING', domainId: 'fd_rehearsal_alpha', secretRef: secretRef('simulation', 'rehearsal/monitor-alpha'), online: true },
    { serviceId: 'monitor_bravo', role: 'MONITORING', domainId: 'fd_rehearsal_bravo', secretRef: secretRef('simulation', 'rehearsal/monitor-bravo'), online: true },
    { serviceId: 'backup_bravo', role: 'BACKUP', domainId: 'fd_rehearsal_bravo', secretRef: secretRef('simulation', 'rehearsal/backup'), online: true },
    { serviceId: 'oracle_alpha', role: 'ORACLE_COLLECTOR', domainId: 'fd_rehearsal_alpha', secretRef: secretRef('simulation', 'rehearsal/oracle-a'), online: true },
    { serviceId: 'oracle_bravo', role: 'ORACLE_COLLECTOR', domainId: 'fd_rehearsal_bravo', secretRef: secretRef('simulation', 'rehearsal/oracle-b'), online: true },
    { serviceId: 'oracle_charlie', role: 'ORACLE_COLLECTOR', domainId: 'fd_rehearsal_charlie', secretRef: secretRef('simulation', 'rehearsal/oracle-c'), online: true },
    { serviceId: 'relayer_bravo', role: 'RELAYER', domainId: 'fd_rehearsal_bravo', secretRef: secretRef('simulation', 'rehearsal/relayer'), online: true },
    { serviceId: 'exchange_sandbox', role: 'EXCHANGE_SANDBOX', domainId: 'fd_rehearsal_charlie', secretRef: secretRef('simulation', 'rehearsal/exchange-sandbox'), online: true },
    { serviceId: 'custody_sandbox', role: 'CUSTODY_SANDBOX', domainId: 'fd_rehearsal_charlie', secretRef: secretRef('simulation', 'rehearsal/custody-sandbox'), online: true },
  ];
  return Object.freeze({
    validators: Object.freeze(validators),
    sentries: Object.freeze(sentries),
    services: Object.freeze(services),
    failureDomains: REHEARSAL_FAILURE_DOMAINS,
  });
}

export function assertNoValidatorKeyOnPublicSurface(topology: RehearsalTopology): boolean {
  return topology.sentries.every((row) => row.canSign === false)
    && topology.services.filter((row) => row.role === 'RPC').every((row) => row.secretRef.path.includes('rpc'));
}

export function rehearsalSecretCatalog(topology: RehearsalTopology): readonly SecretReference[] {
  return Object.freeze([
    secretRef('simulation', 'rehearsal/signer-active'),
    secretRef('simulation', 'rehearsal/signer-passive'),
    secretRef('simulation', 'rehearsal/backup-encryption'),
    ...topology.services.map((row) => row.secretRef),
  ]);
}

export function provisionRehearsalSigners(): {
  readonly fencing: SignerFencingController;
  readonly activeOnly: boolean;
  readonly validatorIds: readonly string[];
} {
  const fencing = new SignerFencingController();
  const validators = sevenRehearsalValidators();
  for (const row of validators) {
    fencing.register(row.validatorId, `${row.validatorId}:active`, `${row.validatorId}:passive`);
  }
  const activeOnly = validators.every((row) => {
    const fence = fencing.fence(row.validatorId);
    return fencing.role(row.validatorId, fence.activeSite ?? '') === 'ACTIVE'
      && fencing.role(row.validatorId, fence.passiveSite ?? '') === 'PASSIVE';
  });
  return Object.freeze({
    fencing,
    activeOnly,
    validatorIds: validators.map((row) => row.validatorId),
  });
}

export type RehearsalStorage = {
  readonly engine: typeof PRODUCTION_CANDIDATE_STORAGE_ENGINE;
  readonly postgresProfile: typeof PRODUCTION_CANDIDATE_POSTGRES_PROFILE;
  stateRoot: string;
  height: bigint;
  destroyed: boolean;
  readonly snapshotOk: boolean;
};

export function provisionRehearsalStorage(stateRoot: string, height: bigint): RehearsalStorage {
  const snapshot = createSnapshot({
    networkId: REHEARSAL_NETWORK_ID,
    chainId: REHEARSAL_CHAIN_ID,
    genesisFingerprint: genesisFingerprint(REHEARSAL_NETWORK_ID, REHEARSAL_CHAIN_ID, stateRoot),
    height,
    blockId: `block-${height.toString()}`,
    stateRoot,
    protocolVersion: '1',
    validatorSetHash: stateRoot,
    validatorSetVersion: 1n,
    payload: JSON.stringify({ engine: PRODUCTION_CANDIDATE_STORAGE_ENGINE, stateRoot }),
    createdAtUtc: '2026-01-01T00:00:00Z',
  });
  const trust = {
    networkId: REHEARSAL_NETWORK_ID,
    chainId: REHEARSAL_CHAIN_ID,
    genesisFingerprint: genesisFingerprint(REHEARSAL_NETWORK_ID, REHEARSAL_CHAIN_ID, stateRoot),
    protocolVersion: '1',
    trustedFinalizedHeight: height,
    trustedStateRoot: stateRoot,
  };
  const verified = snapshot.ok ? verifySnapshot(snapshot.value, trust) : { ok: false };
  return {
    engine: PRODUCTION_CANDIDATE_STORAGE_ENGINE,
    postgresProfile: PRODUCTION_CANDIDATE_POSTGRES_PROFILE,
    stateRoot,
    height,
    destroyed: false,
    snapshotOk: verified.ok,
  };
}

export function rehearsalPostgresProfile() {
  return Object.freeze({
    profileId: PRODUCTION_CANDIDATE_POSTGRES_PROFILE,
    integrationEquivalent: true,
    liveConnection: false,
    schema: true,
    credentialsViaSecretReference: true,
  });
}

export function rehearsalApplicationDump() {
  const dump = dumpApplicationDatabase({
    ledger_journals: [{ id: 'j1', debit: '100', credit: '100' }],
    custody_workflows: [{ id: 'c1', chain: '40', books: '40' }],
    exchange_settlements: [{ id: 'e1', reserved: '10', settled: '10' }],
    event_outbox: [{ id: 'o1', applied: '1' }],
  });
  verifyDatabaseDump(dump);
  return dump;
}

export function rehearsalSignerSafetyBackup(validatorId: string) {
  return createSignerSafetyBackup({
    validatorId,
    chainId: REHEARSAL_CHAIN_ID,
    trustedHighWatermark: 8n,
    lastRound: 8n,
    createdAtUtc: '2026-01-01T00:00:00.000Z',
  });
}
