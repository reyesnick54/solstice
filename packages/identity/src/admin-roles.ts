import type { IdentityCapability } from './capability.ts';

/**
 * Internal staff roles. Privilege is explicit and auditable.
 * Roles are never inferred from a client claim or a session token body.
 * There is no SUPER_ADMIN. PLATFORM_ADMIN is not a union of all roles.
 */
export const STAFF_ROLES = [
  'CUSTOMER_SUPPORT',
  'COMPLIANCE_ANALYST',
  'COMPLIANCE_MANAGER',
  'FRAUD_ANALYST',
  'PAYMENTS_OPERATOR',
  'TREASURY_OPERATOR',
  'RECONCILIATION_OPERATOR',
  'EXCHANGE_SURVEILLANCE',
  'CUSTODY_OPERATOR',
  'SECURITY_OPERATOR',
  'SRE_OPERATOR',
  'AUDITOR',
  'PLATFORM_ADMIN',
] as const;

export type StaffRole = (typeof STAFF_ROLES)[number];

/**
 * Historical names kept for compatibility. They are not additional privilege.
 */
export const STAFF_ROLE_ALIASES = {
  SUPPORT: 'CUSTOMER_SUPPORT',
  COMPLIANCE_REVIEWER: 'COMPLIANCE_ANALYST',
  SECURITY_ADMINISTRATOR: 'SECURITY_OPERATOR',
} as const;

export type LegacyStaffRole = keyof typeof STAFF_ROLE_ALIASES;

/**
 * Unique primary capability for each role. A role is present only when
 * its primary capability is granted. A platform admin therefore does not
 * inherit every operational role.
 */
export const STAFF_ROLE_PRIMARY: Readonly<Record<StaffRole, IdentityCapability>> = {
  CUSTOMER_SUPPORT: 'ADMIN_SUPPORT',
  COMPLIANCE_ANALYST: 'ADMIN_COMPLIANCE',
  COMPLIANCE_MANAGER: 'ADMIN_COMPLIANCE_APPROVE',
  FRAUD_ANALYST: 'ADMIN_FRAUD',
  PAYMENTS_OPERATOR: 'ADMIN_PAYMENTS',
  TREASURY_OPERATOR: 'ADMIN_TREASURY',
  RECONCILIATION_OPERATOR: 'ADMIN_RECONCILIATION',
  EXCHANGE_SURVEILLANCE: 'ADMIN_EXCHANGE_SURVEILLANCE',
  CUSTODY_OPERATOR: 'ADMIN_CUSTODY',
  SECURITY_OPERATOR: 'ADMIN_SECURITY',
  SRE_OPERATOR: 'ADMIN_SRE',
  AUDITOR: 'ADMIN_AUDIT',
  PLATFORM_ADMIN: 'ADMIN_PLATFORM',
};

export const STAFF_ROLE_CAPABILITIES: Readonly<Record<StaffRole, readonly IdentityCapability[]>> = {
  CUSTOMER_SUPPORT: ['ADMIN_SUPPORT', 'VIEW_ACCOUNT'],
  COMPLIANCE_ANALYST: ['ADMIN_COMPLIANCE'],
  COMPLIANCE_MANAGER: ['ADMIN_COMPLIANCE', 'ADMIN_COMPLIANCE_APPROVE'],
  FRAUD_ANALYST: ['ADMIN_FRAUD'],
  PAYMENTS_OPERATOR: ['ADMIN_PAYMENTS'],
  TREASURY_OPERATOR: ['ADMIN_TREASURY'],
  RECONCILIATION_OPERATOR: ['ADMIN_RECONCILIATION'],
  EXCHANGE_SURVEILLANCE: ['ADMIN_EXCHANGE_SURVEILLANCE'],
  CUSTODY_OPERATOR: ['ADMIN_CUSTODY'],
  SECURITY_OPERATOR: ['ADMIN_SECURITY'],
  SRE_OPERATOR: ['ADMIN_SRE'],
  AUDITOR: ['ADMIN_AUDIT'],
  PLATFORM_ADMIN: ['ADMIN_PLATFORM'],
};

export const STAFF_ONLY_CAPABILITIES: readonly IdentityCapability[] = [
  'ADMIN_COMPLIANCE',
  'ADMIN_COMPLIANCE_APPROVE',
  'ADMIN_SUPPORT',
  'ADMIN_SUPPORT_SENSITIVE',
  'ADMIN_TREASURY',
  'ADMIN_PAYMENTS',
  'ADMIN_RECONCILIATION',
  'ADMIN_EXCHANGE_SURVEILLANCE',
  'ADMIN_CUSTODY',
  'ADMIN_SECURITY',
  'ADMIN_FRAUD',
  'ADMIN_SRE',
  'ADMIN_AUDIT',
  'ADMIN_PLATFORM',
  'ADMIN_AGENT',
];

export function canonicalizeStaffRole(value: string): StaffRole | null {
  if ((STAFF_ROLES as readonly string[]).includes(value)) {
    return value as StaffRole;
  }
  if (value in STAFF_ROLE_ALIASES) {
    return STAFF_ROLE_ALIASES[value as LegacyStaffRole];
  }
  return null;
}

export function isStaffRole(value: unknown): value is StaffRole {
  return typeof value === 'string' && canonicalizeStaffRole(value) !== null;
}

export function staffRolesFromCapabilities(
  capabilities: readonly IdentityCapability[],
): readonly StaffRole[] {
  const roles: StaffRole[] = [];
  for (const role of STAFF_ROLES) {
    if (capabilities.includes(STAFF_ROLE_PRIMARY[role])) {
      roles.push(role);
    }
  }
  return Object.freeze(roles);
}

export function capabilitiesForStaffRoles(roles: readonly StaffRole[]): readonly IdentityCapability[] {
  const granted = new Set<IdentityCapability>();
  for (const role of roles) {
    for (const capability of STAFF_ROLE_CAPABILITIES[role]) {
      granted.add(capability);
    }
  }
  return Object.freeze([...granted]);
}

export function isStaffOnlyCapability(capability: IdentityCapability): boolean {
  return STAFF_ONLY_CAPABILITIES.includes(capability);
}
