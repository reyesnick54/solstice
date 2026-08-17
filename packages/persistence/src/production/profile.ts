/**
 * Production-candidate PostgreSQL profile.
 *
 * Application PostgreSQL is not blockchain consensus authority and is not a
 * second financial ledger. Credentials are secret references, never inline
 * production passwords. TLS is required for the production candidate.
 */

import { DATABASES, LOCAL_SIMULATION_PERSISTENCE_ENV, type PersistenceEnv } from '../env.ts';

export const POSTGRES_AUTHORITY = 'APPLICATION_ONLY' as const;
export const BLOCKCHAIN_AUTHORITY = 'SUNREY_CHAIN_STATE' as const;
export const LEDGER_AUTHORITY = 'packages/ledger Ledger.postJournal' as const;

export const CREDENTIAL_REFERENCE_KINDS = ['SECRET_REF', 'ENV_REF', 'FILE_REF'] as const;
export type CredentialReferenceKind = (typeof CREDENTIAL_REFERENCE_KINDS)[number];

export type CredentialReference = {
  readonly kind: CredentialReferenceKind;
  readonly name: string;
  readonly inlineSecretForbidden: true;
};

export const REPLICA_ROLES = ['PRIMARY', 'SYNC_REPLICA', 'ASYNC_REPLICA', 'READ_REPLICA'] as const;
export type ReplicaRole = (typeof REPLICA_ROLES)[number];

export const CONSISTENCY_LEVELS = ['CANONICAL', 'BOUNDED_STALE', 'EVENTUAL'] as const;
export type ConsistencyLevel = (typeof CONSISTENCY_LEVELS)[number];

export type TlsProfile = {
  readonly enabled: true;
  readonly mode: 'verify-full';
  readonly caCertRef: CredentialReference;
  readonly clientCertRef: CredentialReference | null;
  readonly rejectUnauthorized: true;
};

export type PoolProfile = {
  readonly max: number;
  readonly idleTimeoutMs: number;
  readonly connectionTimeoutMs: number;
  readonly statementTimeoutMs: number;
  readonly lockTimeoutMs: number;
};

export type ReplicaEndpoint = {
  readonly role: ReplicaRole;
  readonly hostRef: string;
  readonly port: number;
  readonly lagBudgetMs: bigint;
  readonly writable: boolean;
};

export type PostgresProductionProfile = {
  readonly environment: 'simulation';
  readonly authority: typeof POSTGRES_AUTHORITY;
  readonly notBlockchainConsensus: true;
  readonly notSecondLedger: true;
  readonly tls: TlsProfile;
  readonly credentials: {
    readonly bootstrap: CredentialReference;
    readonly migrator: CredentialReference;
    readonly customer: CredentialReference;
    readonly ledgerWriter: CredentialReference;
    readonly ledgerReader: CredentialReference;
    readonly evidence: CredentialReference;
    readonly security: CredentialReference;
  };
  readonly pooling: PoolProfile;
  readonly transactionTimeoutMs: number;
  readonly databases: typeof DATABASES;
  readonly topology: readonly ReplicaEndpoint[];
  readonly backupMetadataRequired: true;
  readonly managedPitrClaimed: false;
  readonly localPitrReady: true;
};

export const PRODUCTION_CANDIDATE_POOL: PoolProfile = Object.freeze({
  max: 16,
  idleTimeoutMs: 30_000,
  connectionTimeoutMs: 5_000,
  statementTimeoutMs: 15_000,
  lockTimeoutMs: 5_000,
});

export function secretRef(name: string): CredentialReference {
  return Object.freeze({ kind: 'SECRET_REF', name, inlineSecretForbidden: true });
}

export function productionCandidateProfile(): PostgresProductionProfile {
  return Object.freeze({
    environment: 'simulation',
    authority: POSTGRES_AUTHORITY,
    notBlockchainConsensus: true,
    notSecondLedger: true,
    tls: Object.freeze({
      enabled: true,
      mode: 'verify-full',
      caCertRef: secretRef('postgres/ca-cert'),
      clientCertRef: secretRef('postgres/client-cert'),
      rejectUnauthorized: true,
    }),
    credentials: Object.freeze({
      bootstrap: secretRef('postgres/bootstrap'),
      migrator: secretRef('postgres/migrator'),
      customer: secretRef('postgres/customer-app'),
      ledgerWriter: secretRef('postgres/ledger-writer'),
      ledgerReader: secretRef('postgres/ledger-reader'),
      evidence: secretRef('postgres/evidence-app'),
      security: secretRef('postgres/security-app'),
    }),
    pooling: PRODUCTION_CANDIDATE_POOL,
    transactionTimeoutMs: 10_000,
    databases: DATABASES,
    topology: Object.freeze([
      Object.freeze({
        role: 'PRIMARY',
        hostRef: 'postgres/primary-host',
        port: 5432,
        lagBudgetMs: 0n,
        writable: true,
      }),
      Object.freeze({
        role: 'SYNC_REPLICA',
        hostRef: 'postgres/sync-replica-host',
        port: 5432,
        lagBudgetMs: 0n,
        writable: false,
      }),
      Object.freeze({
        role: 'ASYNC_REPLICA',
        hostRef: 'postgres/async-replica-host',
        port: 5432,
        lagBudgetMs: 5_000n,
        writable: false,
      }),
      Object.freeze({
        role: 'READ_REPLICA',
        hostRef: 'postgres/read-replica-host',
        port: 5432,
        lagBudgetMs: 2_000n,
        writable: false,
      }),
    ]),
    backupMetadataRequired: true,
    managedPitrClaimed: false,
    localPitrReady: true,
  });
}

export function assertNoInlineProductionPassword(profile: PostgresProductionProfile): void {
  const refs = Object.values(profile.credentials);
  for (const ref of refs) {
    if (!ref.inlineSecretForbidden || ref.kind !== 'SECRET_REF') {
      throw new Error('production candidate credentials must be secret references');
    }
  }
}

export function simulationEnvRemainsLocal(env: PersistenceEnv = LOCAL_SIMULATION_PERSISTENCE_ENV): boolean {
  return env.host === '127.0.0.1' && env.bootstrapPassword.includes('dev_only');
}

export function poolOptionsFromProfile(profile: PostgresProductionProfile): {
  readonly max: number;
  readonly idleTimeoutMillis: number;
  readonly connectionTimeoutMillis: number;
  readonly ssl: { readonly rejectUnauthorized: true };
} {
  return {
    max: profile.pooling.max,
    idleTimeoutMillis: profile.pooling.idleTimeoutMs,
    connectionTimeoutMillis: profile.pooling.connectionTimeoutMs,
    ssl: { rejectUnauthorized: profile.tls.rejectUnauthorized },
  };
}
