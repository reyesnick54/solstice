/**
 * Persistent database, queue, object-storage, and secret wiring.
 * Production-critical async work must not depend on process memory.
 */

import { secretRef, type SecretReference } from '../../../../security/src/secrets.ts';
import { environmentBoundary } from './environments.ts';
import type { PlatformDeploymentEnvironment } from './types.ts';

export const DATABASE_ROLES = ['MIGRATOR', 'APP_READWRITE', 'APP_READONLY', 'BACKUP'] as const;
export type DatabaseRoleName = (typeof DATABASE_ROLES)[number];

export type PlatformDatabasePlan = {
  readonly engine: 'postgresql';
  readonly tlsRequired: true;
  readonly backupEnabled: true;
  readonly pitrCapable: boolean;
  readonly connectionPooling: true;
  readonly pooler: 'pgbouncer';
  readonly roleSeparation: readonly DatabaseRoleName[];
  readonly privateNetwork: true;
  readonly replicaCount: number;
  readonly haModel: 'PRIMARY_SYNC_REPLICA' | 'SINGLE_NODE_REHEARSAL';
  readonly migrationJob: true;
  readonly migrateBeforeIncompatibleRollout: true;
  readonly healthCheck: 'pg_isready';
  readonly monitoring: true;
  readonly credentialRefs: Readonly<Record<DatabaseRoleName, SecretReference>>;
};

export type PlatformQueuePlan = {
  readonly transport: 'durable-outbox';
  readonly owner: 'packages/events';
  readonly persistent: true;
  readonly processMemoryForbiddenForCritical: true;
  readonly channels: readonly ['events', 'jobs', 'workflows', 'dead-letters'];
  readonly deadLetterRequired: true;
  readonly credentialRef: SecretReference;
};

export const OBJECT_STORAGE_PURPOSES = [
  'EVIDENCE',
  'EXPORTS',
  'VAULT_OBJECTS',
  'AUDIT_BUNDLES',
  'BACKUPS',
] as const;
export type ObjectStoragePurpose = (typeof OBJECT_STORAGE_PURPOSES)[number];

export type PlatformObjectStoragePlan = {
  readonly purposes: readonly ObjectStoragePurpose[];
  readonly encryption: 'PROVIDER_MANAGED' | 'CUSTOMER_MANAGED_KMS';
  readonly publicAccess: false;
  readonly versioning: true;
  readonly retentionDays: number;
  readonly credentialRef: SecretReference;
};

export type PlatformSecretPlan = {
  readonly scheme: 'secret://';
  readonly referencesOnly: true;
  readonly rawCredentialsCommitted: false;
  readonly isolatedNonProductionAllowed: boolean;
  readonly productionRequiresApprovedKms: boolean;
  readonly bindings: readonly {
    readonly name: string;
    readonly href: string;
    readonly class: string;
  }[];
};

function envProvider(environment: PlatformDeploymentEnvironment): string {
  return `sunrey-${environment.toLowerCase()}`;
}

export function databasePlan(environment: PlatformDeploymentEnvironment): PlatformDatabasePlan {
  const boundary = environmentBoundary(environment);
  const provider = envProvider(environment);
  return Object.freeze({
    engine: 'postgresql',
    tlsRequired: true,
    backupEnabled: true,
    pitrCapable: boundary.haRequired,
    connectionPooling: true,
    pooler: 'pgbouncer',
    roleSeparation: DATABASE_ROLES,
    privateNetwork: true,
    replicaCount: boundary.haRequired ? 1 : 0,
    haModel: boundary.haRequired ? 'PRIMARY_SYNC_REPLICA' : 'SINGLE_NODE_REHEARSAL',
    migrationJob: true,
    migrateBeforeIncompatibleRollout: true,
    healthCheck: 'pg_isready',
    monitoring: true,
    credentialRefs: Object.freeze({
      MIGRATOR: secretRef(provider, 'database/migrator'),
      APP_READWRITE: secretRef(provider, 'database/app-readwrite'),
      APP_READONLY: secretRef(provider, 'database/app-readonly'),
      BACKUP: secretRef(provider, 'database/backup'),
    }),
  });
}

export function queuePlan(environment: PlatformDeploymentEnvironment): PlatformQueuePlan {
  return Object.freeze({
    transport: 'durable-outbox',
    owner: 'packages/events',
    persistent: true,
    processMemoryForbiddenForCritical: true,
    channels: Object.freeze(['events', 'jobs', 'workflows', 'dead-letters'] as const),
    deadLetterRequired: true,
    credentialRef: secretRef(envProvider(environment), 'queue/events'),
  });
}

export function objectStoragePlan(environment: PlatformDeploymentEnvironment): PlatformObjectStoragePlan {
  const boundary = environmentBoundary(environment);
  return Object.freeze({
    purposes: OBJECT_STORAGE_PURPOSES,
    encryption: boundary.kmsRequired ? 'CUSTOMER_MANAGED_KMS' : 'PROVIDER_MANAGED',
    publicAccess: false,
    versioning: true,
    retentionDays: environment === 'LOCAL' || environment === 'TEST' ? 14 : 90,
    credentialRef: secretRef(envProvider(environment), 'storage/objects'),
  });
}

export const PLATFORM_SECRET_CLASSES = Object.freeze([
  { name: 'database-migrator', class: 'DATABASE_CREDENTIAL', path: 'database/migrator' },
  { name: 'database-app', class: 'DATABASE_CREDENTIAL', path: 'database/app-readwrite' },
  { name: 'tls-api', class: 'TLS_PRIVATE_KEY', path: 'tls/api' },
  { name: 'tls-rpc', class: 'TLS_PRIVATE_KEY', path: 'tls/rpc' },
  { name: 'queue', class: 'EXTERNAL_PROVIDER_CREDENTIAL', path: 'queue/events' },
  { name: 'object-storage', class: 'BACKUP_ENCRYPTION_KEY', path: 'storage/objects' },
  { name: 'registry', class: 'CONTAINER_REGISTRY_CREDENTIAL', path: 'registry/pull' },
  { name: 'kms-auth', class: 'KMS_AUTH_REFERENCE', path: 'kms/auth' },
  { name: 'hsm-auth', class: 'HSM_AUTH_REFERENCE', path: 'hsm/auth' },
]);

export function secretPlan(environment: PlatformDeploymentEnvironment): PlatformSecretPlan {
  const boundary = environmentBoundary(environment);
  const provider = envProvider(environment);
  return Object.freeze({
    scheme: 'secret://',
    referencesOnly: true,
    rawCredentialsCommitted: false,
    isolatedNonProductionAllowed: boundary.isolatedNonProductionSecrets,
    productionRequiresApprovedKms: boundary.kmsRequired,
    bindings: Object.freeze(
      PLATFORM_SECRET_CLASSES.map((row) =>
        Object.freeze({
          name: row.name,
          href: secretRef(provider, row.path).href,
          class: row.class,
        }),
      ),
    ),
  });
}

export function refuseProductionWithoutKms(
  environment: PlatformDeploymentEnvironment,
  approvedKmsPresent: boolean,
): { readonly ok: boolean; readonly code: string } {
  if (environment !== 'PRODUCTION') {
    return Object.freeze({ ok: true, code: 'NON_PRODUCTION' });
  }
  if (!approvedKmsPresent) {
    return Object.freeze({ ok: false, code: 'PRODUCTION_KMS_REQUIRED' });
  }
  return Object.freeze({ ok: true, code: 'KMS_PRESENT' });
}
