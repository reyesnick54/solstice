import type { IdentityCapability } from './capability.ts';

/**
 * Internal staff roles. Privilege is explicit and auditable.
 * These are never inferred from a session or a client claim.
 * The full operations console is not implemented here.
 */
export const STAFF_ROLES = [
  'SUPPORT',
  'COMPLIANCE_REVIEWER',
  'TREASURY_OPERATOR',
  'EXCHANGE_SURVEILLANCE',
  'SECURITY_ADMINISTRATOR',
] as const;

export type StaffRole = (typeof STAFF_ROLES)[number];

export const STAFF_ROLE_CAPABILITIES: Readonly<Record<StaffRole, readonly IdentityCapability[]>> = {
  SUPPORT: ['ADMIN_SUPPORT', 'VIEW_ACCOUNT'],
  COMPLIANCE_REVIEWER: ['ADMIN_COMPLIANCE'],
  TREASURY_OPERATOR: ['ADMIN_TREASURY'],
  EXCHANGE_SURVEILLANCE: ['ADMIN_EXCHANGE_SURVEILLANCE'],
  SECURITY_ADMINISTRATOR: ['ADMIN_SECURITY'],
};

export const STAFF_ONLY_CAPABILITIES: readonly IdentityCapability[] = [
  'ADMIN_COMPLIANCE',
  'ADMIN_SUPPORT',
  'ADMIN_TREASURY',
  'ADMIN_EXCHANGE_SURVEILLANCE',
  'ADMIN_SECURITY',
];

export function isStaffRole(value: unknown): value is StaffRole {
  return typeof value === 'string' && (STAFF_ROLES as readonly string[]).includes(value);
}

export function staffRolesFromCapabilities(
  capabilities: readonly IdentityCapability[],
): readonly StaffRole[] {
  const roles: StaffRole[] = [];
  for (const role of STAFF_ROLES) {
    const required = STAFF_ROLE_CAPABILITIES[role];
    if (required.every((capability) => capabilities.includes(capability))) {
      roles.push(role);
    }
  }
  return Object.freeze(roles);
}

export function isStaffOnlyCapability(capability: IdentityCapability): boolean {
  return STAFF_ONLY_CAPABILITIES.includes(capability);
}
