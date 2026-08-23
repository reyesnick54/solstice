import type { AuthenticationAssurance } from '../assurance.ts';
import type { IdentityCapability } from '../capability.ts';
import {
  capabilitiesForStaffRoles,
  staffRolesFromCapabilities,
  type StaffRole,
} from '../admin-roles.ts';

export type StaffOperator = {
  readonly operatorId: string;
  readonly identityId: string;
  readonly roles: readonly StaffRole[];
  readonly capabilities: readonly IdentityCapability[];
  readonly assurance: AuthenticationAssurance;
  readonly stepUpSatisfied: boolean;
  readonly sessionId: string;
  readonly principalKind: 'STAFF';
};

export function staffOperatorFromGrants(input: {
  readonly operatorId: string;
  readonly identityId: string;
  readonly capabilities: readonly IdentityCapability[];
  readonly assurance: AuthenticationAssurance;
  readonly stepUpSatisfied: boolean;
  readonly sessionId: string;
}): StaffOperator {
  return Object.freeze({
    operatorId: input.operatorId,
    identityId: input.identityId,
    roles: staffRolesFromCapabilities(input.capabilities),
    capabilities: Object.freeze([...input.capabilities]),
    assurance: input.assurance,
    stepUpSatisfied: input.stepUpSatisfied,
    sessionId: input.sessionId,
    principalKind: 'STAFF',
  });
}

export function staffOperatorFromRoles(input: {
  readonly operatorId: string;
  readonly identityId: string;
  readonly roles: readonly StaffRole[];
  readonly extraCapabilities?: readonly IdentityCapability[];
  readonly assurance: AuthenticationAssurance;
  readonly stepUpSatisfied: boolean;
  readonly sessionId: string;
}): StaffOperator {
  const capabilities = [
    ...capabilitiesForStaffRoles(input.roles),
    ...(input.extraCapabilities ?? []),
  ];
  return Object.freeze({
    operatorId: input.operatorId,
    identityId: input.identityId,
    roles: Object.freeze([...input.roles]),
    capabilities: Object.freeze(capabilities),
    assurance: input.assurance,
    stepUpSatisfied: input.stepUpSatisfied,
    sessionId: input.sessionId,
    principalKind: 'STAFF',
  });
}
