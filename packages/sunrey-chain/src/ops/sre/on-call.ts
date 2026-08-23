import { ON_CALL_ROLES, type OnCallRole, type SeverityLevel } from './types.ts';

export type OnCallRoleRequirement = {
  readonly role: OnCallRole;
  readonly humanRequired: true;
  readonly aiMayAssist: boolean;
  readonly aiSatisfiesAccountability: false;
  readonly namedStaffInRepository: false;
  readonly coverageGap: string;
};

export type EscalationStep = {
  readonly severity: SeverityLevel;
  readonly primary: OnCallRole;
  readonly escalateTo: readonly OnCallRole[];
  readonly page: boolean;
};

const REQUIREMENTS: readonly OnCallRoleRequirement[] = Object.freeze(
  ON_CALL_ROLES.map((role) =>
    Object.freeze({
      role,
      humanRequired: true,
      aiMayAssist: role !== 'INCIDENT_COMMANDER' && role !== 'SECURITY_AUTHORITY' && role !== 'COMPLIANCE_OPERATIONS',
      aiSatisfiesAccountability: false,
      namedStaffInRepository: false,
      coverageGap: 'No named human assignment exists in this repository. Role is required before production.',
    }),
  ),
);

const ESCALATION: readonly EscalationStep[] = Object.freeze([
  {
    severity: 'SEV1',
    primary: 'INCIDENT_COMMANDER',
    escalateTo: Object.freeze([
      'OPERATIONS_AUTHORITY',
      'SECURITY_AUTHORITY',
      'TREASURY',
      'PROTOCOL_AUTHORITY',
    ] as const),
    page: true,
  },
  {
    severity: 'SEV2',
    primary: 'OPERATIONS_AUTHORITY',
    escalateTo: Object.freeze(['INCIDENT_COMMANDER', 'EXCHANGE', 'CUSTODY', 'VALIDATOR_OPERATIONS'] as const),
    page: true,
  },
  {
    severity: 'SEV3',
    primary: 'OPERATIONS_AUTHORITY',
    escalateTo: Object.freeze(['DATABASE', 'INFRASTRUCTURE', 'TREASURY'] as const),
    page: false,
  },
  {
    severity: 'SEV4',
    primary: 'OPERATIONS_AUTHORITY',
    escalateTo: Object.freeze([] as const),
    page: false,
  },
]);

export function onCallRoleRequirements(): readonly OnCallRoleRequirement[] {
  return REQUIREMENTS;
}

export function escalationMatrix(): readonly EscalationStep[] {
  return ESCALATION;
}

export function staffingGaps(): readonly string[] {
  return Object.freeze([
    'No named incident commander is assigned in the repository.',
    'No 24/7 primary/secondary on-call roster exists.',
    'Security, compliance, treasury, exchange, custody, and validator roles are specified but unstaffed.',
    'AI must not satisfy accountability for any on-call role.',
    'Production must not start until humans fill the required roles.',
  ]);
}

export function namedStaffInvented(): false {
  return false;
}
