import type { ServiceCapability, ServiceIdentity } from '../../../security/src/identity.ts';
import { assertServiceCapability } from '../../../security/src/identity.ts';
import type { UtcInstant } from '../../../domain/src/time.ts';

export const SENSITIVE_ADMIN_ACTIONS = [
  'PROVIDER_ENABLE',
  'PROVIDER_DISABLE',
  'POLICY_ACTIVATE',
  'IDENTITY_SUSPEND',
  'MANUAL_CLAIM_REVIEW',
  'DOMAIN_CIRCUIT_BREAKER',
  'VALIDATOR_CONFIGURE',
  'GOVERNANCE_CONFIGURE',
] as const;

export type SensitiveAdminAction = (typeof SENSITIVE_ADMIN_ACTIONS)[number];

/**
 * Required administrator role for each sensitive action.
 * No universal super-admin path exists.
 */
export const ADMIN_ACTION_REQUIREMENTS: Readonly<
  Record<SensitiveAdminAction, readonly string[]>
> = Object.freeze({
  PROVIDER_ENABLE: ['SECURITY_OPERATOR', 'PLATFORM_ADMIN'],
  PROVIDER_DISABLE: ['SECURITY_OPERATOR', 'COMPLIANCE_MANAGER'],
  POLICY_ACTIVATE: ['COMPLIANCE_MANAGER'],
  IDENTITY_SUSPEND: ['COMPLIANCE_MANAGER', 'FRAUD_ANALYST'],
  MANUAL_CLAIM_REVIEW: ['COMPLIANCE_ANALYST', 'COMPLIANCE_MANAGER'],
  DOMAIN_CIRCUIT_BREAKER: ['SECURITY_OPERATOR', 'SRE_OPERATOR'],
  VALIDATOR_CONFIGURE: ['SECURITY_OPERATOR'],
  GOVERNANCE_CONFIGURE: ['COMPLIANCE_MANAGER'],
});

export type AdminAuthorizationCheck = {
  readonly action: SensitiveAdminAction;
  readonly operatorRoles: readonly string[];
  readonly operatorId: string;
  readonly dualControlSatisfied: boolean;
  readonly monetaryBypassAttempted: boolean;
};

export type AdminAuthorizationDecision =
  | { readonly allowed: true }
  | { readonly allowed: false; readonly code: string; readonly reason: string };

const DUAL_CONTROL_ADMIN_ACTIONS: readonly SensitiveAdminAction[] = [
  'PROVIDER_DISABLE',
  'DOMAIN_CIRCUIT_BREAKER',
  'IDENTITY_SUSPEND',
  'POLICY_ACTIVATE',
];

export function evaluateAdminAuthorization(check: AdminAuthorizationCheck): AdminAuthorizationDecision {
  if (check.monetaryBypassAttempted) {
    return {
      allowed: false,
      code: 'MONETARY_BYPASS_FORBIDDEN',
      reason: 'administrative roles cannot bypass protocol monetary controls',
    };
  }

  const required = ADMIN_ACTION_REQUIREMENTS[check.action];
  const hasRole = check.operatorRoles.some((role) => required.includes(role));
  if (!hasRole) {
    return {
      allowed: false,
      code: 'ADMIN_ROLE_REQUIRED',
      reason: `action '${check.action}' requires one of: ${required.join(', ')}`,
    };
  }

  if (DUAL_CONTROL_ADMIN_ACTIONS.includes(check.action) && !check.dualControlSatisfied) {
    return {
      allowed: false,
      code: 'DUAL_CONTROL_REQUIRED',
      reason: `action '${check.action}' requires dual control`,
    };
  }

  return { allowed: true };
}

export function validatorCannotBecomeGovernanceActor(
  validatorRoles: readonly string[],
  governanceRoles: readonly string[],
): boolean {
  return validatorRoles.length > 0 && governanceRoles.length === 0;
}

export function governanceCannotBypassTransactionRules(monetaryBypassAttempted: boolean): boolean {
  return !monetaryBypassAttempted;
}

export type ServiceAuthorizationCheck = {
  readonly caller: ServiceIdentity;
  readonly requiredCapability: ServiceCapability;
  readonly targetServiceId: string;
  readonly now: UtcInstant;
};

export type ServiceAuthorizationDecision =
  | { readonly allowed: true; readonly serviceId: string }
  | { readonly allowed: false; readonly code: string; readonly reason: string };

/**
 * Zero-trust service-to-service authorization.
 * Internal network presence is not trusted.
 */
export function evaluateServiceAuthorization(
  check: ServiceAuthorizationCheck,
): ServiceAuthorizationDecision {
  const capability = assertServiceCapability(check.caller, check.requiredCapability, check.now);
  if (!capability.ok) {
    return {
      allowed: false,
      code: capability.error.code,
      reason: capability.error.message,
    };
  }

  if (check.caller.serviceId !== check.targetServiceId && check.requiredCapability === 'ADMINISTER') {
    return {
      allowed: false,
      code: 'CROSS_SERVICE_DENIED',
      reason: `service '${check.caller.serviceId}' cannot administer '${check.targetServiceId}'`,
    };
  }

  return { allowed: true, serviceId: check.caller.serviceId };
}
