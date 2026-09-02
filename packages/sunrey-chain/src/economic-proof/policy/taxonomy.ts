/**
 * Wave 3 — explicit economic policy categories.
 *
 * Policies are not collapsed into one configuration object. Each category has
 * distinct governance, activation, and methodology binding rules.
 */

export const POLICY_SCHEMA_VERSION = 1 as const;
export const POLICY_COMMITMENT_DOMAIN = 'SUNREY_ECONOMIC_POLICY_COMMITMENT_V1' as const;
export const POLICY_ROOT_DOMAIN = 'SUNREY_ECONOMIC_POLICY_ROOT_V1' as const;

export const POLICY_TYPES = [
  'VERIFICATION_POLICY',
  'HUMAN_CONTRIBUTION_POLICY',
  'PRODUCTIVE_CONTRIBUTION_POLICY',
  'VALUATION_METHODOLOGY',
  'MONETARY_ISSUANCE_POLICY',
  'GOVERNANCE_POLICY',
  'NETWORK_ECONOMIC_POLICY',
] as const;
export type PolicyType = (typeof POLICY_TYPES)[number];

/** Economies that policy packs may govern. Cross-economy binding is forbidden. */
export const POLICY_ECONOMIES = ['SUNREY', 'MOONREY', 'PROTOCOL'] as const;
export type PolicyEconomy = (typeof POLICY_ECONOMIES)[number];

export const POLICY_DEFINITION_STATUSES = [
  'DRAFT',
  'REGISTERED',
  'SUPERSEDED',
  'REVOKED',
] as const;
export type PolicyDefinitionStatus = (typeof POLICY_DEFINITION_STATUSES)[number];

export const POLICY_ACTIVATION_STATUSES = [
  'INACTIVE',
  'AUTHORIZED',
  'ACTIVE',
  'EXPIRED',
] as const;
export type PolicyActivationStatus = (typeof POLICY_ACTIVATION_STATUSES)[number];

export const POLICY_ACTIVATION_ACTOR_KINDS = [
  'PROTOCOL_GOVERNANCE',
  'HUMAN_GOVERNANCE',
  'VALIDATOR_GOVERNANCE',
  'AI_PROPOSAL',
  'ORACLE',
  'EXCHANGE',
  'AUTOMATION',
] as const;
export type PolicyActivationActorKind = (typeof POLICY_ACTIVATION_ACTOR_KINDS)[number];

export const MONETARY_POLICY_ACTIVATION_ACTOR_KINDS = [
  'PROTOCOL_GOVERNANCE',
  'HUMAN_GOVERNANCE',
] as const;
export type MonetaryPolicyActivationActorKind = (typeof MONETARY_POLICY_ACTIVATION_ACTOR_KINDS)[number];

export const POLICY_REJECTION_CODES = [
  'POLICY_NOT_FOUND',
  'POLICY_NOT_REGISTERED',
  'POLICY_NOT_ACTIVE',
  'POLICY_NOT_AUTHORIZED_FOR_MONETARY_USE',
  'POLICY_VERSION_MISMATCH',
  'POLICY_CONTENT_HASH_MISMATCH',
  'POLICY_REPLAY',
  'POLICY_NOT_YET_EFFECTIVE',
  'POLICY_EXPIRED',
  'GOVERNANCE_REFERENCE_REQUIRED',
  'GOVERNANCE_REFERENCE_INVALID',
  'AI_CANNOT_ACTIVATE_MONETARY_POLICY',
  'ORACLE_CANNOT_ACTIVATE_POLICY',
  'EXCHANGE_CANNOT_ACTIVATE_POLICY',
  'VALIDATOR_CANNOT_ACTIVATE_WITHOUT_PROTOCOL_GOVERNANCE',
  'CROSS_ECONOMY_METHODOLOGY_BINDING',
  'SUNREY_POLICY_CANNOT_AUTHORIZE_MOONREY_METHODOLOGY',
  'MOONREY_POLICY_CANNOT_AUTHORIZE_SUNREY_METHODOLOGY',
  'METHODOLOGY_REFERENCE_MISSING',
  'METHODOLOGY_VERSION_MISMATCH',
  'HISTORICAL_POLICY_REQUIRED',
  'LATEST_POLICY_LOOKUP_FORBIDDEN_IN_REPLAY',
] as const;
export type PolicyRejectionCode = (typeof POLICY_REJECTION_CODES)[number];

export const MONETARY_POLICY_TYPES: readonly PolicyType[] = [
  'VALUATION_METHODOLOGY',
  'MONETARY_ISSUANCE_POLICY',
] as const;

export function isMonetaryPolicyType(policyType: PolicyType): boolean {
  return (MONETARY_POLICY_TYPES as readonly string[]).includes(policyType);
}

export function policyEconomyForType(policyType: PolicyType): PolicyEconomy {
  switch (policyType) {
    case 'HUMAN_CONTRIBUTION_POLICY':
    case 'VALUATION_METHODOLOGY':
      return 'SUNREY';
    case 'PRODUCTIVE_CONTRIBUTION_POLICY':
      return 'MOONREY';
    case 'MONETARY_ISSUANCE_POLICY':
      return 'PROTOCOL';
    case 'VERIFICATION_POLICY':
    case 'GOVERNANCE_POLICY':
    case 'NETWORK_ECONOMIC_POLICY':
      return 'PROTOCOL';
    default: {
      const _exhaustive: never = policyType;
      throw new TypeError(`unknown policy type: ${String(_exhaustive)}`);
    }
  }
}
