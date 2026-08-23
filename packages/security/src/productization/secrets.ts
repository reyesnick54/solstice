/**
 * Canonical secret classification for production components.
 * Configuration holds SecretReference values, never plaintext secrets.
 */

import { securityErr, securityOk, type SecurityResult } from '../errors.ts';
import { parseSecretReference, type SecretReference } from '../secrets.ts';

export const SECRET_CLASSES = [
  'API_CREDENTIAL',
  'DATABASE_CREDENTIAL',
  'JWT_SIGNING_KEY',
  'PROVIDER_KEY',
  'CUSTODY_CREDENTIAL',
  'VALIDATOR_KEY',
  'TLS_PRIVATE_KEY',
  'ENCRYPTION_KEY',
  'ADMINISTRATIVE_CREDENTIAL',
] as const;

export type SecretClass = (typeof SECRET_CLASSES)[number];

export const SECRET_STORAGE_KINDS = [
  'CLOUD_SECRET_MANAGER',
  'VAULT',
  'HSM',
  'CLOUD_KMS',
  'SIMULATION_STORE',
] as const;
export type SecretStorageKind = (typeof SECRET_STORAGE_KINDS)[number];

export type SecretClassPolicy = {
  readonly secretClass: SecretClass;
  readonly storage: readonly SecretStorageKind[];
  readonly access: string;
  readonly rotation: string;
  readonly audit: string;
  readonly environment: string;
  readonly plaintextInCodeForbidden: true;
  readonly sharedAccountForbidden: true;
};

export const SECRET_CLASS_POLICIES: Readonly<Record<SecretClass, SecretClassPolicy>> = Object.freeze({
  API_CREDENTIAL: {
    secretClass: 'API_CREDENTIAL',
    storage: ['CLOUD_SECRET_MANAGER', 'VAULT', 'SIMULATION_STORE'],
    access: 'owning service identity only; short-lived lease',
    rotation: '90 days or on compromise; overlapping verification window',
    audit: 'resolve, rotate, revoke, and failed resolve',
    environment: 'bound; sandbox cannot serve production',
    plaintextInCodeForbidden: true,
    sharedAccountForbidden: true,
  },
  DATABASE_CREDENTIAL: {
    secretClass: 'DATABASE_CREDENTIAL',
    storage: ['CLOUD_SECRET_MANAGER', 'VAULT', 'SIMULATION_STORE'],
    access: 'named application role; never superuser',
    rotation: '60 days; migrator and app roles rotate independently',
    audit: 'connect role, rotation generation, TLS requirement',
    environment: 'bound; local fixture rejected in PRODUCTION_CANDIDATE',
    plaintextInCodeForbidden: true,
    sharedAccountForbidden: true,
  },
  JWT_SIGNING_KEY: {
    secretClass: 'JWT_SIGNING_KEY',
    storage: ['CLOUD_KMS', 'HSM', 'SIMULATION_STORE'],
    access: 'identity / API session signer only',
    rotation: 'versioned; previous version verifies until policy retire',
    audit: 'sign, verify, rotate, revoke; no material in events',
    environment: 'SESSION_SIGNING purpose; not provider or validator',
    plaintextInCodeForbidden: true,
    sharedAccountForbidden: true,
  },
  PROVIDER_KEY: {
    secretClass: 'PROVIDER_KEY',
    storage: ['CLOUD_SECRET_MANAGER', 'VAULT', 'SIMULATION_STORE'],
    access: 'provider adapter workload; Chunk 149 descriptor only',
    rotation: 'provider-coordinated overlap; webhook versions overlap',
    audit: 'descriptor use, environment, workload, operation',
    environment: 'exact match; sandbox never production',
    plaintextInCodeForbidden: true,
    sharedAccountForbidden: true,
  },
  CUSTODY_CREDENTIAL: {
    secretClass: 'CUSTODY_CREDENTIAL',
    storage: ['HSM', 'CLOUD_KMS', 'VAULT'],
    access: 'custody workload in CUSTODY_PRIVATE only',
    rotation: 'ceremony or provider rotate; no export',
    audit: 'HSM handle, purpose WALLET_SIGNING, attestation ref',
    environment: 'custody zone; RPC and Explorer denied',
    plaintextInCodeForbidden: true,
    sharedAccountForbidden: true,
  },
  VALIDATOR_KEY: {
    secretClass: 'VALIDATOR_KEY',
    storage: ['HSM'],
    access: 'validator identity in SIGNER_PRIVATE only',
    rotation: 'dual-control ceremony; historical verify retained',
    audit: 'ceremony transcript; never a general service secret',
    environment: 'not a SecretProvider service secret',
    plaintextInCodeForbidden: true,
    sharedAccountForbidden: true,
  },
  TLS_PRIVATE_KEY: {
    secretClass: 'TLS_PRIVATE_KEY',
    storage: ['CLOUD_SECRET_MANAGER', 'HSM', 'VAULT'],
    access: 'terminating service identity; mTLS leaf or server',
    rotation: 'certificate validity window; overlapping trust anchors',
    audit: 'issue, rotate, revoke; no PEM committed',
    environment: 'deploy-time reference only; no repo material',
    plaintextInCodeForbidden: true,
    sharedAccountForbidden: true,
  },
  ENCRYPTION_KEY: {
    secretClass: 'ENCRYPTION_KEY',
    storage: ['CLOUD_KMS', 'HSM', 'SIMULATION_STORE'],
    access: 'DATA_ENCRYPTION or BACKUP_ENCRYPTION purpose only',
    rotation: 'new DEK wrap version; historical envelopes decrypt until retire',
    audit: 'encrypt, decrypt, rotate; no plaintext key bytes',
    environment: 'purpose-bound; not a signing key',
    plaintextInCodeForbidden: true,
    sharedAccountForbidden: true,
  },
  ADMINISTRATIVE_CREDENTIAL: {
    secretClass: 'ADMINISTRATIVE_CREDENTIAL',
    storage: ['VAULT', 'CLOUD_SECRET_MANAGER'],
    access: 'named human admin; step-up; no shared accounts',
    rotation: 'short-lived session or break-glass lease',
    audit: 'every privileged use and every break-glass open/close',
    environment: 'ADMIN_OPERATIONS surface only',
    plaintextInCodeForbidden: true,
    sharedAccountForbidden: true,
  },
});

const LOOKS_LIKE_PLAINTEXT =
  /^(sk_|pk_|whsec_|-----BEGIN |password=|postgres:\/\/[^:]+:[^@]+@)/i;

export function isSecretClass(value: unknown): value is SecretClass {
  return typeof value === 'string' && (SECRET_CLASSES as readonly string[]).includes(value);
}

export function policyForSecretClass(secretClass: SecretClass): SecretClassPolicy {
  return SECRET_CLASS_POLICIES[secretClass];
}

export function assertConfigurationSecretReference(value: string): SecurityResult<SecretReference> {
  if (LOOKS_LIKE_PLAINTEXT.test(value) || !value.startsWith('secret://')) {
    return securityErr(
      'PLAINTEXT_SECRET_REJECTED',
      'production configuration must hold a secret:// reference, not a plaintext secret',
    );
  }
  return parseSecretReference(value);
}

export function assertSecretClassAccess(input: {
  readonly secretClass: SecretClass;
  readonly caller: string;
  readonly allowedCallers: readonly string[];
}): SecurityResult<true> {
  if (!input.allowedCallers.includes(input.caller)) {
    return securityErr(
      'SECRET_UNRESOLVED',
      `caller '${input.caller}' cannot retrieve ${input.secretClass}`,
    );
  }
  return securityOk(true);
}
