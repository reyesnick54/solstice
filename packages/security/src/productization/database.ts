/**
 * Production database security design. Application connections are never
 * the PostgreSQL superuser. TLS, role separation, and backup encryption
 * are mandatory in the production candidate.
 */

import { securityErr, securityOk, type SecurityResult } from '../errors.ts';

export const DATABASE_ROLES = [
  'MIGRATOR',
  'CUSTOMER_APP',
  'LEDGER_WRITER',
  'LEDGER_READER',
  'EVIDENCE_APP',
  'SECURITY_APP',
] as const;
export type DatabaseRole = (typeof DATABASE_ROLES)[number];

export type DatabaseRolePolicy = {
  readonly role: DatabaseRole;
  readonly ddl: boolean;
  readonly dml: boolean;
  readonly superuser: false;
  readonly schemas: readonly string[];
};

export const DATABASE_ROLE_POLICIES: Readonly<Record<DatabaseRole, DatabaseRolePolicy>> = Object.freeze({
  MIGRATOR: {
    role: 'MIGRATOR',
    ddl: true,
    dml: false,
    superuser: false,
    schemas: ['public', 'customer', 'ledger', 'evidence', 'security'],
  },
  CUSTOMER_APP: {
    role: 'CUSTOMER_APP',
    ddl: false,
    dml: true,
    superuser: false,
    schemas: ['customer', 'identity', 'payments', 'cards'],
  },
  LEDGER_WRITER: {
    role: 'LEDGER_WRITER',
    ddl: false,
    dml: true,
    superuser: false,
    schemas: ['ledger'],
  },
  LEDGER_READER: {
    role: 'LEDGER_READER',
    ddl: false,
    dml: false,
    superuser: false,
    schemas: ['ledger'],
  },
  EVIDENCE_APP: {
    role: 'EVIDENCE_APP',
    ddl: false,
    dml: true,
    superuser: false,
    schemas: ['evidence'],
  },
  SECURITY_APP: {
    role: 'SECURITY_APP',
    ddl: false,
    dml: true,
    superuser: false,
    schemas: ['security'],
  },
});

export const PRODUCTION_DATABASE_CONTROLS = Object.freeze({
  tlsRequired: true,
  tlsMode: 'verify-full',
  applicationSuperuserForbidden: true,
  migrationRoleSeparated: true,
  backupEncryptionRequired: true,
  auditSensitiveOperations: true,
  inlinePasswordForbidden: true,
});

export function assertApplicationRole(roleName: string): SecurityResult<true> {
  const normalized = roleName.toLowerCase();
  if (
    normalized === 'postgres' ||
    normalized === 'rds_superuser' ||
    normalized.includes('superuser') ||
    normalized === 'solstice_bootstrap'
  ) {
    return securityErr(
      'SUPERUSER_FORBIDDEN',
      'no application should connect as the database superuser or bootstrap role in production design',
    );
  }
  return securityOk(true);
}

export function assertDatabaseTls(tlsEnabled: boolean): SecurityResult<true> {
  if (!tlsEnabled) {
    return securityErr('POLICY_REJECTED', 'production database connections require TLS');
  }
  return securityOk(true);
}

export function assertMigratorCannotServeTraffic(role: DatabaseRole, servingTraffic: boolean): SecurityResult<true> {
  if (role === 'MIGRATOR' && servingTraffic) {
    return securityErr('POLICY_REJECTED', 'migrator role cannot serve application traffic');
  }
  return securityOk(true);
}
