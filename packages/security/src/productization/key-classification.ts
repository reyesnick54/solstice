/**
 * Wave 7 — explicit key role taxonomy.
 *
 * Each role is distinct. A compromised API credential must not authorize
 * validator consensus, governance signing, or user custody.
 */

import { securityErr, securityOk, type SecurityResult } from '../errors.ts';
import type { KeyPurpose } from '../purposes.ts';
import type { SecretClass } from './secrets.ts';

export const KEY_ROLES = [
  'USER_WALLET_KEY',
  'VALIDATOR_KEY',
  'GOVERNANCE_SIGNING_KEY',
  'SERVICE_KEY',
  'API_CREDENTIAL',
  'DATABASE_CREDENTIAL',
  'ENCRYPTION_KEY',
  'ADMIN_AUTHENTICATION_CREDENTIAL',
] as const;

export type KeyRole = (typeof KEY_ROLES)[number];

export type KeyRolePolicy = {
  readonly role: KeyRole;
  readonly purposes: readonly KeyPurpose[];
  readonly secretClass: SecretClass | null;
  readonly hsmRequired: boolean;
  readonly exportable: false;
  readonly reuseForbiddenRoles: readonly KeyRole[];
  readonly storage: readonly string[];
  readonly description: string;
};

export const KEY_ROLE_POLICIES: Readonly<Record<KeyRole, KeyRolePolicy>> = Object.freeze({
  USER_WALLET_KEY: {
    role: 'USER_WALLET_KEY',
    purposes: ['WALLET_SIGNING'],
    secretClass: 'CUSTODY_CREDENTIAL',
    hsmRequired: true,
    exportable: false,
    reuseForbiddenRoles: [
      'VALIDATOR_KEY',
      'GOVERNANCE_SIGNING_KEY',
      'SERVICE_KEY',
      'API_CREDENTIAL',
      'ADMIN_AUTHENTICATION_CREDENTIAL',
    ],
    storage: ['HSM', 'CLOUD_KMS', 'CUSTODY_PRIVATE'],
    description: 'User custody signing; never a validator or governance key',
  },
  VALIDATOR_KEY: {
    role: 'VALIDATOR_KEY',
    purposes: ['VALIDATOR_CONSENSUS_SIGNING', 'BLOCK_PROPOSAL_SIGNING', 'P2P_IDENTITY'],
    secretClass: 'VALIDATOR_KEY',
    hsmRequired: true,
    exportable: false,
    reuseForbiddenRoles: [
      'USER_WALLET_KEY',
      'GOVERNANCE_SIGNING_KEY',
      'SERVICE_KEY',
      'API_CREDENTIAL',
      'ADMIN_AUTHENTICATION_CREDENTIAL',
    ],
    storage: ['HSM', 'SIGNER_PRIVATE'],
    description: 'Validator consensus and proposal signing; not on public API containers',
  },
  GOVERNANCE_SIGNING_KEY: {
    role: 'GOVERNANCE_SIGNING_KEY',
    purposes: ['GOVERNANCE_SIGNING', 'GENESIS_SIGNING', 'RELEASE_SIGNING'],
    secretClass: null,
    hsmRequired: true,
    exportable: false,
    reuseForbiddenRoles: [
      'USER_WALLET_KEY',
      'VALIDATOR_KEY',
      'SERVICE_KEY',
      'API_CREDENTIAL',
      'ADMIN_AUTHENTICATION_CREDENTIAL',
    ],
    storage: ['HSM', 'OFFLINE_CEREMONY'],
    description: 'Protocol and monetary governance signing; offline or ceremony-only',
  },
  SERVICE_KEY: {
    role: 'SERVICE_KEY',
    purposes: ['SERVICE_AUTHENTICATION', 'WEBHOOK_SIGNING', 'PROVIDER_AUTHENTICATION'],
    secretClass: 'API_CREDENTIAL',
    hsmRequired: false,
    exportable: false,
    reuseForbiddenRoles: [
      'USER_WALLET_KEY',
      'VALIDATOR_KEY',
      'GOVERNANCE_SIGNING_KEY',
      'ADMIN_AUTHENTICATION_CREDENTIAL',
    ],
    storage: ['CLOUD_SECRET_MANAGER', 'VAULT', 'SIMULATION_STORE'],
    description: 'Inter-service authentication; cannot sign transactions or governance',
  },
  API_CREDENTIAL: {
    role: 'API_CREDENTIAL',
    purposes: ['SESSION_SIGNING'],
    secretClass: 'API_CREDENTIAL',
    hsmRequired: false,
    exportable: false,
    reuseForbiddenRoles: [
      'USER_WALLET_KEY',
      'VALIDATOR_KEY',
      'GOVERNANCE_SIGNING_KEY',
      'ADMIN_AUTHENTICATION_CREDENTIAL',
    ],
    storage: ['CLOUD_SECRET_MANAGER', 'VAULT', 'SIMULATION_STORE'],
    description: 'External API client credentials; not internal service identity',
  },
  DATABASE_CREDENTIAL: {
    role: 'DATABASE_CREDENTIAL',
    purposes: [],
    secretClass: 'DATABASE_CREDENTIAL',
    hsmRequired: false,
    exportable: false,
    reuseForbiddenRoles: [
      'USER_WALLET_KEY',
      'VALIDATOR_KEY',
      'GOVERNANCE_SIGNING_KEY',
      'SERVICE_KEY',
      'API_CREDENTIAL',
      'ADMIN_AUTHENTICATION_CREDENTIAL',
    ],
    storage: ['CLOUD_SECRET_MANAGER', 'VAULT'],
    description: 'Database connection credentials; never a signing key',
  },
  ENCRYPTION_KEY: {
    role: 'ENCRYPTION_KEY',
    purposes: ['DATA_ENCRYPTION', 'BACKUP_ENCRYPTION'],
    secretClass: 'ENCRYPTION_KEY',
    hsmRequired: false,
    exportable: false,
    reuseForbiddenRoles: [
      'USER_WALLET_KEY',
      'VALIDATOR_KEY',
      'GOVERNANCE_SIGNING_KEY',
      'SERVICE_KEY',
      'API_CREDENTIAL',
      'ADMIN_AUTHENTICATION_CREDENTIAL',
    ],
    storage: ['CLOUD_KMS', 'HSM', 'SIMULATION_STORE'],
    description: 'Envelope encryption only; not a signing or authentication key',
  },
  ADMIN_AUTHENTICATION_CREDENTIAL: {
    role: 'ADMIN_AUTHENTICATION_CREDENTIAL',
    purposes: ['ADMINISTRATION_SIGNING'],
    secretClass: 'ADMINISTRATIVE_CREDENTIAL',
    hsmRequired: false,
    exportable: false,
    reuseForbiddenRoles: [
      'USER_WALLET_KEY',
      'VALIDATOR_KEY',
      'GOVERNANCE_SIGNING_KEY',
      'SERVICE_KEY',
      'API_CREDENTIAL',
    ],
    storage: ['VAULT', 'CLOUD_SECRET_MANAGER'],
    description: 'Named human admin authentication; step-up required for mutation',
  },
});

export function isKeyRole(value: unknown): value is KeyRole {
  return typeof value === 'string' && (KEY_ROLES as readonly string[]).includes(value);
}

export function policyForKeyRole(role: KeyRole): KeyRolePolicy {
  return KEY_ROLE_POLICIES[role];
}

export function roleForPurpose(purpose: KeyPurpose): KeyRole | null {
  for (const role of KEY_ROLES) {
    if ((KEY_ROLE_POLICIES[role].purposes as readonly string[]).includes(purpose)) {
      return role;
    }
  }
  if (purpose === 'EXECUTION_AUTHORITY_SIGNING' || purpose === 'EVIDENCE_INTEGRITY') {
    return 'SERVICE_KEY';
  }
  return null;
}

export function assertKeyRoleSeparation(left: KeyRole, right: KeyRole): SecurityResult<true> {
  if (left === right) {
    return securityOk(true);
  }
  const leftPolicy = KEY_ROLE_POLICIES[left];
  if (leftPolicy.reuseForbiddenRoles.includes(right)) {
    return securityErr(
      'KEY_DOMAIN_CROSSING',
      `${left} cannot be reused as ${right}`,
    );
  }
  return securityOk(true);
}

export function assertPurposeMatchesRole(
  purpose: KeyPurpose,
  role: KeyRole,
): SecurityResult<KeyPurpose> {
  const policy = KEY_ROLE_POLICIES[role];
  if (policy.purposes.length > 0 && !(policy.purposes as readonly string[]).includes(purpose)) {
    return securityErr(
      'PURPOSE_MISMATCH',
      `${purpose} is not authorized for key role ${role}`,
    );
  }
  return securityOk(purpose);
}

export function assertWrongKeyType(
  attemptedRole: KeyRole,
  actualRole: KeyRole,
): SecurityResult<true> {
  if (attemptedRole === actualRole) {
    return securityOk(true);
  }
  return securityErr(
    'PURPOSE_MISMATCH',
    `wrong key type: expected ${attemptedRole}, got ${actualRole}`,
  );
}
