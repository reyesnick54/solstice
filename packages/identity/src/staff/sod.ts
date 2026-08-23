import type { IdentityCapability } from '../capability.ts';
import { STAFF_ROLE_CAPABILITIES, type StaffRole } from '../admin-roles.ts';

/**
 * Privileged staff actions. These are not Kernel ActionTypes and never
 * map onto Ledger.postJournal or AuthorityIssuer.issue.
 */
export const PRIVILEGED_STAFF_ACTIONS = [
  'CASE_CREATE',
  'CASE_ASSIGN',
  'CASE_TRANSITION',
  'CASE_NOTE',
  'CASE_ESCALATE',
  'CASE_RESOLVE',
  'CASE_CLOSE',
  'CASE_APPROVE',
  'ACCOUNT_RESTRICT',
  'ACCOUNT_RELEASE',
  'PROVIDER_DISABLE',
  'MARKET_HALT',
  'AGENT_PAUSE',
  'BREAK_RECLASSIFY',
  'SUPPORT_VIEW_OPEN',
  'SUPPORT_SENSITIVE_VIEW',
  'PROVIDER_CONFIGURE',
] as const;

export type PrivilegedStaffAction = (typeof PRIVILEGED_STAFF_ACTIONS)[number];

export const DUAL_CONTROL_ACTIONS: readonly PrivilegedStaffAction[] = [
  'CASE_APPROVE',
  'ACCOUNT_RESTRICT',
  'ACCOUNT_RELEASE',
  'PROVIDER_DISABLE',
  'MARKET_HALT',
  'AGENT_PAUSE',
];

export const STEP_UP_ACTIONS: readonly PrivilegedStaffAction[] = [
  'CASE_APPROVE',
  'CASE_RESOLVE',
  'ACCOUNT_RESTRICT',
  'ACCOUNT_RELEASE',
  'PROVIDER_DISABLE',
  'MARKET_HALT',
  'AGENT_PAUSE',
  'SUPPORT_SENSITIVE_VIEW',
  'BREAK_RECLASSIFY',
];

export const ACTION_CAPABILITY: Readonly<Record<PrivilegedStaffAction, readonly IdentityCapability[]>> = {
  CASE_CREATE: [
    'ADMIN_COMPLIANCE',
    'ADMIN_COMPLIANCE_APPROVE',
    'ADMIN_FRAUD',
    'ADMIN_PAYMENTS',
    'ADMIN_TREASURY',
    'ADMIN_RECONCILIATION',
    'ADMIN_EXCHANGE_SURVEILLANCE',
    'ADMIN_CUSTODY',
    'ADMIN_SECURITY',
    'ADMIN_SRE',
    'ADMIN_AGENT',
    'ADMIN_SUPPORT',
  ],
  CASE_ASSIGN: [
    'ADMIN_COMPLIANCE',
    'ADMIN_COMPLIANCE_APPROVE',
    'ADMIN_FRAUD',
    'ADMIN_PAYMENTS',
    'ADMIN_TREASURY',
    'ADMIN_RECONCILIATION',
    'ADMIN_EXCHANGE_SURVEILLANCE',
    'ADMIN_CUSTODY',
    'ADMIN_SECURITY',
    'ADMIN_SRE',
    'ADMIN_AGENT',
    'ADMIN_SUPPORT',
  ],
  CASE_TRANSITION: [
    'ADMIN_COMPLIANCE',
    'ADMIN_COMPLIANCE_APPROVE',
    'ADMIN_FRAUD',
    'ADMIN_PAYMENTS',
    'ADMIN_TREASURY',
    'ADMIN_RECONCILIATION',
    'ADMIN_EXCHANGE_SURVEILLANCE',
    'ADMIN_CUSTODY',
    'ADMIN_SECURITY',
    'ADMIN_SRE',
    'ADMIN_AGENT',
    'ADMIN_SUPPORT',
  ],
  CASE_NOTE: [
    'ADMIN_COMPLIANCE',
    'ADMIN_COMPLIANCE_APPROVE',
    'ADMIN_FRAUD',
    'ADMIN_PAYMENTS',
    'ADMIN_TREASURY',
    'ADMIN_RECONCILIATION',
    'ADMIN_EXCHANGE_SURVEILLANCE',
    'ADMIN_CUSTODY',
    'ADMIN_SECURITY',
    'ADMIN_SRE',
    'ADMIN_AGENT',
    'ADMIN_SUPPORT',
    'ADMIN_AUDIT',
  ],
  CASE_ESCALATE: [
    'ADMIN_COMPLIANCE',
    'ADMIN_FRAUD',
    'ADMIN_PAYMENTS',
    'ADMIN_TREASURY',
    'ADMIN_RECONCILIATION',
    'ADMIN_EXCHANGE_SURVEILLANCE',
    'ADMIN_CUSTODY',
    'ADMIN_SECURITY',
    'ADMIN_SRE',
    'ADMIN_AGENT',
    'ADMIN_SUPPORT',
  ],
  CASE_RESOLVE: [
    'ADMIN_COMPLIANCE',
    'ADMIN_COMPLIANCE_APPROVE',
    'ADMIN_FRAUD',
    'ADMIN_PAYMENTS',
    'ADMIN_TREASURY',
    'ADMIN_RECONCILIATION',
    'ADMIN_EXCHANGE_SURVEILLANCE',
    'ADMIN_CUSTODY',
    'ADMIN_SECURITY',
    'ADMIN_SRE',
    'ADMIN_AGENT',
  ],
  CASE_CLOSE: ['ADMIN_COMPLIANCE_APPROVE', 'ADMIN_SECURITY', 'ADMIN_AUDIT'],
  CASE_APPROVE: ['ADMIN_COMPLIANCE_APPROVE'],
  ACCOUNT_RESTRICT: ['ADMIN_COMPLIANCE_APPROVE', 'ADMIN_FRAUD', 'ADMIN_SECURITY'],
  ACCOUNT_RELEASE: ['ADMIN_COMPLIANCE_APPROVE', 'ADMIN_SECURITY'],
  PROVIDER_DISABLE: ['ADMIN_SRE', 'ADMIN_SECURITY'],
  MARKET_HALT: ['ADMIN_EXCHANGE_SURVEILLANCE', 'ADMIN_SECURITY'],
  AGENT_PAUSE: ['ADMIN_AGENT', 'ADMIN_SECURITY'],
  BREAK_RECLASSIFY: ['ADMIN_RECONCILIATION', 'ADMIN_TREASURY'],
  SUPPORT_VIEW_OPEN: ['ADMIN_SUPPORT', 'ADMIN_AUDIT'],
  SUPPORT_SENSITIVE_VIEW: ['ADMIN_SUPPORT_SENSITIVE', 'ADMIN_COMPLIANCE', 'ADMIN_COMPLIANCE_APPROVE'],
  PROVIDER_CONFIGURE: ['ADMIN_SRE', 'ADMIN_PLATFORM'],
};

export const ROLE_FORBIDDEN_ACTIONS: Readonly<Partial<Record<StaffRole, readonly PrivilegedStaffAction[]>>> = {
  CUSTOMER_SUPPORT: [
    'CASE_APPROVE',
    'ACCOUNT_RESTRICT',
    'ACCOUNT_RELEASE',
    'PROVIDER_DISABLE',
    'MARKET_HALT',
    'AGENT_PAUSE',
    'BREAK_RECLASSIFY',
  ],
  AUDITOR: [
    'CASE_CREATE',
    'CASE_ASSIGN',
    'CASE_TRANSITION',
    'CASE_ESCALATE',
    'CASE_RESOLVE',
    'CASE_APPROVE',
    'ACCOUNT_RESTRICT',
    'ACCOUNT_RELEASE',
    'PROVIDER_DISABLE',
    'MARKET_HALT',
    'AGENT_PAUSE',
    'BREAK_RECLASSIFY',
    'PROVIDER_CONFIGURE',
  ],
  PLATFORM_ADMIN: [
    'CASE_APPROVE',
    'ACCOUNT_RESTRICT',
    'ACCOUNT_RELEASE',
    'MARKET_HALT',
    'AGENT_PAUSE',
  ],
};

export type SodDenialCode =
  | 'ROLE_DENIED'
  | 'CAPABILITY_DENIED'
  | 'SELF_APPROVAL_FORBIDDEN'
  | 'DUAL_CONTROL_REQUIRED'
  | 'PRODUCTION_ACTIVATION_FORBIDDEN'
  | 'LEDGER_MUTATION_FORBIDDEN'
  | 'CUSTODY_KEY_FORBIDDEN'
  | 'SUPPORT_CANNOT_SIGN'
  | 'AGENT_CANNOT_MUTATE_LEDGER';

export type SodDecision =
  | { readonly ok: true }
  | { readonly ok: false; readonly code: SodDenialCode; readonly message: string };

const FINANCIAL_MUTATORS: readonly IdentityCapability[] = [
  'ACCOUNT_OPEN_REQUEST',
  'TRANSFER_REQUEST',
  'POST_DEPOSIT_REQUEST',
  'POST_WITHDRAWAL_REQUEST',
  'PAYMENT_REQUEST',
  'TREASURY_OPERATE_REQUEST',
  'CUSTODY_OPERATE_REQUEST',
  'EXCHANGE_OPERATE_REQUEST',
  'SUNREY_COIN_OPERATE_REQUEST',
];

export function roleMayPerform(role: StaffRole, action: PrivilegedStaffAction): boolean {
  if (ROLE_FORBIDDEN_ACTIONS[role]?.includes(action)) {
    return false;
  }
  const required = ACTION_CAPABILITY[action];
  return STAFF_ROLE_CAPABILITIES[role].some((capability) => required.includes(capability));
}

export function evaluateSegregationOfDuties(input: {
  readonly roles: readonly StaffRole[];
  readonly capabilities: readonly IdentityCapability[];
  readonly action: PrivilegedStaffAction;
  readonly actorId: string;
  readonly priorActorId?: string | null;
  readonly secondApproverId?: string | null;
  readonly dualControlSatisfied?: boolean;
  readonly productionActivation?: boolean;
}): SodDecision {
  if (input.productionActivation) {
    return {
      ok: false,
      code: 'PRODUCTION_ACTIVATION_FORBIDDEN',
      message: 'staff operations cannot authorize production activation',
    };
  }
  if (input.capabilities.some((capability) => FINANCIAL_MUTATORS.includes(capability))) {
    if (input.roles.includes('CUSTOMER_SUPPORT') || input.roles.includes('AUDITOR')) {
      return {
        ok: false,
        code: 'LEDGER_MUTATION_FORBIDDEN',
        message: 'this staff role cannot hold ledger mutation capability',
      };
    }
  }
  if (input.roles.includes('CUSTOMER_SUPPORT') && input.capabilities.includes('CUSTODY_OPERATE_REQUEST')) {
    return {
      ok: false,
      code: 'SUPPORT_CANNOT_SIGN',
      message: 'customer support cannot hold custody signing authority',
    };
  }
  if (input.roles.includes('CUSTOMER_SUPPORT') && input.action === 'ACCOUNT_RESTRICT') {
    return {
      ok: false,
      code: 'ROLE_DENIED',
      message: 'customer support cannot restrict accounts',
    };
  }
  if (
    (input.capabilities.includes('ADMIN_AGENT') || input.roles.includes('PLATFORM_ADMIN')) &&
    input.capabilities.some((capability) => FINANCIAL_MUTATORS.includes(capability))
  ) {
    return {
      ok: false,
      code: 'AGENT_CANNOT_MUTATE_LEDGER',
      message: 'agent or platform operators cannot hold ledger mutation capability',
    };
  }
  if (input.roles.includes('SRE_OPERATOR') && input.productionActivation) {
    return {
      ok: false,
      code: 'PRODUCTION_ACTIVATION_FORBIDDEN',
      message: 'provider operators cannot authorize production activation',
    };
  }

  const permittedByRole = input.roles.some((role) => roleMayPerform(role, input.action));
  if (!permittedByRole) {
    return { ok: false, code: 'ROLE_DENIED', message: 'role is not permitted for this action' };
  }
  const required = ACTION_CAPABILITY[input.action];
  if (!required.some((capability) => input.capabilities.includes(capability))) {
    return {
      ok: false,
      code: 'CAPABILITY_DENIED',
      message: 'capability is not granted for this action',
    };
  }
  if (
    (input.action === 'CASE_APPROVE' || input.action === 'CASE_RESOLVE') &&
    input.priorActorId &&
    input.priorActorId === input.actorId
  ) {
    return {
      ok: false,
      code: 'SELF_APPROVAL_FORBIDDEN',
      message: 'investigator cannot approve or resolve their own escalated decision',
    };
  }
  if (DUAL_CONTROL_ACTIONS.includes(input.action) && !input.dualControlSatisfied) {
    if (input.secondApproverId && input.secondApproverId === input.actorId) {
      return {
        ok: false,
        code: 'SELF_APPROVAL_FORBIDDEN',
        message: 'second approval cannot be the same operator',
      };
    }
    if (!input.secondApproverId) {
      return {
        ok: false,
        code: 'DUAL_CONTROL_REQUIRED',
        message: 'this action requires a second authorized approver',
      };
    }
  }
  return { ok: true };
}

export function staffHoldsLedgerMutator(capabilities: readonly IdentityCapability[]): boolean {
  return capabilities.some((capability) => FINANCIAL_MUTATORS.includes(capability));
}

export function staffHoldsCustodySigning(capabilities: readonly IdentityCapability[]): boolean {
  return capabilities.includes('CUSTODY_OPERATE_REQUEST');
}

export const OPS_READ_SURFACES = [
  'payments',
  'treasury',
  'reconciliation',
  'surveillance',
  'custody',
  'providers',
  'agents',
  'security',
  'cases',
] as const;

export type OpsReadSurface = (typeof OPS_READ_SURFACES)[number];

export const OPS_READ_CAPABILITIES: Readonly<Record<OpsReadSurface, readonly IdentityCapability[]>> = {
  payments: ['ADMIN_PAYMENTS', 'ADMIN_RECONCILIATION', 'ADMIN_TREASURY', 'ADMIN_COMPLIANCE', 'ADMIN_COMPLIANCE_APPROVE', 'ADMIN_FRAUD', 'ADMIN_AUDIT'],
  treasury: ['ADMIN_TREASURY', 'ADMIN_RECONCILIATION', 'ADMIN_AUDIT'],
  reconciliation: ['ADMIN_RECONCILIATION', 'ADMIN_TREASURY', 'ADMIN_AUDIT'],
  surveillance: ['ADMIN_EXCHANGE_SURVEILLANCE', 'ADMIN_SECURITY', 'ADMIN_COMPLIANCE_APPROVE', 'ADMIN_AUDIT'],
  custody: ['ADMIN_CUSTODY', 'ADMIN_COMPLIANCE', 'ADMIN_COMPLIANCE_APPROVE', 'ADMIN_AUDIT'],
  providers: ['ADMIN_SRE', 'ADMIN_SECURITY', 'ADMIN_PLATFORM', 'ADMIN_AUDIT'],
  agents: ['ADMIN_AGENT', 'ADMIN_SECURITY', 'ADMIN_SUPPORT', 'ADMIN_AUDIT'],
  security: ['ADMIN_SECURITY', 'ADMIN_AUDIT'],
  cases: [
    'ADMIN_COMPLIANCE',
    'ADMIN_COMPLIANCE_APPROVE',
    'ADMIN_FRAUD',
    'ADMIN_PAYMENTS',
    'ADMIN_TREASURY',
    'ADMIN_RECONCILIATION',
    'ADMIN_EXCHANGE_SURVEILLANCE',
    'ADMIN_CUSTODY',
    'ADMIN_SECURITY',
    'ADMIN_SRE',
    'ADMIN_AGENT',
    'ADMIN_SUPPORT',
    'ADMIN_AUDIT',
  ],
};

export const DOMAIN_WRITE_CAPABILITIES: Readonly<Record<string, readonly IdentityCapability[]>> = {
  KYC: ['ADMIN_COMPLIANCE', 'ADMIN_COMPLIANCE_APPROVE'],
  KYB: ['ADMIN_COMPLIANCE', 'ADMIN_COMPLIANCE_APPROVE'],
  AML: ['ADMIN_COMPLIANCE', 'ADMIN_COMPLIANCE_APPROVE'],
  SANCTIONS: ['ADMIN_COMPLIANCE', 'ADMIN_COMPLIANCE_APPROVE'],
  TRAVEL_RULE: ['ADMIN_COMPLIANCE', 'ADMIN_COMPLIANCE_APPROVE', 'ADMIN_CUSTODY'],
  DATA_RIGHTS: ['ADMIN_COMPLIANCE', 'ADMIN_COMPLIANCE_APPROVE', 'ADMIN_SUPPORT'],
  FRAUD: ['ADMIN_FRAUD', 'ADMIN_COMPLIANCE', 'ADMIN_COMPLIANCE_APPROVE', 'ADMIN_SECURITY'],
  PAYMENT: ['ADMIN_PAYMENTS', 'ADMIN_RECONCILIATION', 'ADMIN_COMPLIANCE'],
  TREASURY: ['ADMIN_TREASURY', 'ADMIN_RECONCILIATION'],
  RECONCILIATION: ['ADMIN_RECONCILIATION', 'ADMIN_TREASURY'],
  EXCHANGE_SURVEILLANCE: ['ADMIN_EXCHANGE_SURVEILLANCE', 'ADMIN_SECURITY'],
  CUSTODY: ['ADMIN_CUSTODY', 'ADMIN_COMPLIANCE'],
  AGENT: ['ADMIN_AGENT', 'ADMIN_SECURITY', 'ADMIN_SUPPORT'],
  SECURITY: ['ADMIN_SECURITY'],
  PROVIDER: ['ADMIN_SRE', 'ADMIN_SECURITY', 'ADMIN_PLATFORM'],
  CUSTOMER_SUPPORT: ['ADMIN_SUPPORT', 'ADMIN_COMPLIANCE', 'ADMIN_COMPLIANCE_APPROVE'],
};

export function operatorMayReadSurface(
  capabilities: readonly IdentityCapability[],
  surface: OpsReadSurface,
): boolean {
  return OPS_READ_CAPABILITIES[surface].some((capability) => capabilities.includes(capability));
}

export function operatorMayAccessDomain(
  capabilities: readonly IdentityCapability[],
  domain: string,
  mode: 'read' | 'write',
): boolean {
  if (capabilities.includes('ADMIN_AUDIT') && mode === 'read') {
    return true;
  }
  const required = DOMAIN_WRITE_CAPABILITIES[domain];
  if (!required) {
    return false;
  }
  return required.some((capability) => capabilities.includes(capability));
}
