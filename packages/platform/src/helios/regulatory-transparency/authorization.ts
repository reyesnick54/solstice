import type { StaffRole } from '../../../../identity/src/admin-roles.ts';
import { capabilitiesForStaffRoles } from '../../../../identity/src/admin-roles.ts';
import type { ExportMode, SupervisoryRole } from './taxonomy.ts';
import type { ExportAuthorizationResult, SupervisoryActor } from './types.ts';

/** Maps HELIOS supervisory roles to canonical staff roles. */
export const SUPERVISORY_ROLE_TO_STAFF: Readonly<Record<SupervisoryRole, readonly StaffRole[]>> =
  Object.freeze({
    COMPLIANCE: ['COMPLIANCE_ANALYST', 'COMPLIANCE_MANAGER'],
    LEGAL: ['COMPLIANCE_MANAGER'],
    AUDIT: ['AUDITOR'],
    SUPERVISORY_ADMIN: ['COMPLIANCE_MANAGER'],
  });

export function staffRolesForSupervisoryRole(role: SupervisoryRole): readonly StaffRole[] {
  return SUPERVISORY_ROLE_TO_STAFF[role];
}

export function supervisoryCapabilities(role: SupervisoryRole): readonly string[] {
  const staffRoles = staffRolesForSupervisoryRole(role);
  return capabilitiesForStaffRoles(staffRoles);
}

export function evaluateExportAuthorization(
  actor: SupervisoryActor,
  mode: ExportMode,
): ExportAuthorizationResult {
  if (actor.actorKind === 'AI') {
    return Object.freeze({
      permitted: false,
      reason: 'AI actors cannot request supervisory exports',
      requiredApproval: false,
    });
  }

  switch (mode) {
    case 'INTERNAL_REVIEW':
      if (actor.role === 'COMPLIANCE' || actor.role === 'LEGAL' || actor.role === 'SUPERVISORY_ADMIN') {
        return Object.freeze({
          permitted: true,
          reason: `${actor.role} may request internal review exports`,
          requiredApproval: false,
        });
      }
      return Object.freeze({
        permitted: false,
        reason: 'INTERNAL_REVIEW requires COMPLIANCE, LEGAL, or SUPERVISORY_ADMIN role',
        requiredApproval: false,
      });

    case 'REGULATOR_EXPORT':
      if (actor.role === 'SUPERVISORY_ADMIN') {
        return Object.freeze({
          permitted: true,
          reason: 'SUPERVISORY_ADMIN may request regulator exports with approval',
          requiredApproval: true,
        });
      }
      return Object.freeze({
        permitted: false,
        reason: 'REGULATOR_EXPORT requires SUPERVISORY_ADMIN role with dual approval',
        requiredApproval: true,
      });

    case 'AUDIT_EXPORT':
      if (actor.role === 'AUDIT') {
        return Object.freeze({
          permitted: true,
          reason: 'AUDIT role may request audit exports',
          requiredApproval: false,
        });
      }
      return Object.freeze({
        permitted: false,
        reason: 'AUDIT_EXPORT requires AUDIT role',
        requiredApproval: false,
      });

    default:
      return Object.freeze({
        permitted: false,
        reason: 'unknown export mode',
        requiredApproval: false,
      });
  }
}

export function evaluateExportApproval(
  approver: SupervisoryActor,
  mode: ExportMode,
): ExportAuthorizationResult {
  if (approver.actorKind === 'AI') {
    return Object.freeze({
      permitted: false,
      reason: 'AI cannot approve supervisory exports',
      requiredApproval: false,
    });
  }

  if (mode === 'REGULATOR_EXPORT') {
    if (approver.role === 'SUPERVISORY_ADMIN' || approver.role === 'LEGAL') {
      return Object.freeze({
        permitted: true,
        reason: `${approver.role} may approve regulator export`,
        requiredApproval: false,
      });
    }
    return Object.freeze({
      permitted: false,
      reason: 'REGULATOR_EXPORT approval requires SUPERVISORY_ADMIN or LEGAL',
      requiredApproval: false,
    });
  }

  return Object.freeze({
    permitted: true,
    reason: 'no additional approval required for this export mode',
    requiredApproval: false,
  });
}

export function evaluatePolicyActivationApproval(
  approver: SupervisoryActor,
): ExportAuthorizationResult {
  if (approver.actorKind === 'AI') {
    return Object.freeze({
      permitted: false,
      reason: 'AI cannot activate production policy',
      requiredApproval: false,
    });
  }
  if (approver.role === 'COMPLIANCE' || approver.role === 'LEGAL' || approver.role === 'SUPERVISORY_ADMIN') {
    return Object.freeze({
      permitted: true,
      reason: `${approver.role} may authorize policy activation`,
      requiredApproval: true,
    });
  }
  return Object.freeze({
    permitted: false,
    reason: 'policy activation requires COMPLIANCE, LEGAL, or SUPERVISORY_ADMIN human approval',
    requiredApproval: true,
  });
}
