import type { CustomerId } from '../../../../domain/src/customer.ts';
import type {
  RegulatoryAccessContext,
  RegulatoryEvidencePackage,
  ReportingObligation,
  StructuredReportPackage,
} from './types.ts';
import type { RegulatoryAccessRole } from './taxonomy.ts';

const ROLE_HIERARCHY: Record<RegulatoryAccessRole, number> = {
  AUDIT: 1,
  COMPLIANCE: 2,
  LEGAL: 3,
  AUTHORIZED_ADMIN: 4,
};

function hasRole(ctx: RegulatoryAccessContext, role: RegulatoryAccessRole): boolean {
  return ctx.roles.includes(role) || ctx.roles.includes('AUTHORIZED_ADMIN');
}

export function canAccessEvidencePackage(
  ctx: RegulatoryAccessContext,
  pkg: RegulatoryEvidencePackage,
): boolean {
  if (!hasRole(ctx, 'COMPLIANCE') && !hasRole(ctx, 'LEGAL') && !hasRole(ctx, 'AUDIT')) {
    return false;
  }
  if (ctx.customerId !== null && ctx.customerId !== pkg.customerScope.customerId) {
    return false;
  }
  return true;
}

export function canAccessObligation(
  ctx: RegulatoryAccessContext,
  obligation: ReportingObligation,
  customerId: CustomerId,
): boolean {
  if (!hasRole(ctx, 'COMPLIANCE') && !hasRole(ctx, 'LEGAL') && !hasRole(ctx, 'AUDIT')) {
    return false;
  }
  if (ctx.customerId !== null && ctx.customerId !== customerId) {
    return false;
  }
  return true;
}

export function canAuthorizeSubmission(ctx: RegulatoryAccessContext): boolean {
  return hasRole(ctx, 'COMPLIANCE') || hasRole(ctx, 'LEGAL');
}

export function canAccessReportPackage(
  ctx: RegulatoryAccessContext,
  report: StructuredReportPackage,
  customerId: CustomerId,
): boolean {
  if (!hasRole(ctx, 'COMPLIANCE') && !hasRole(ctx, 'LEGAL') && !hasRole(ctx, 'AUDIT')) {
    return false;
  }
  if (ctx.customerId !== null && ctx.customerId !== customerId) {
    return false;
  }
  return true;
}

export function minimumRoleForAction(action: 'read' | 'submit' | 'correct'): RegulatoryAccessRole {
  switch (action) {
    case 'read':
      return 'AUDIT';
    case 'submit':
      return 'COMPLIANCE';
    case 'correct':
      return 'LEGAL';
  }
}

export function roleAtLeast(ctx: RegulatoryAccessContext, minimum: RegulatoryAccessRole): boolean {
  const actorLevel = Math.max(...ctx.roles.map((r) => ROLE_HIERARCHY[r] ?? 0));
  return actorLevel >= ROLE_HIERARCHY[minimum];
}
