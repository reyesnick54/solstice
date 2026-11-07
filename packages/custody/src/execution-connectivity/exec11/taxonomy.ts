/**
 * EXEC11 — custody movement authority taxonomy.
 * Investment execution (TRADE / SETTLE) is isolated from asset withdrawal (WITHDRAW).
 */

export const HELIOS_EXEC11_SCHEMA = 'sunrey.custody.execution-connectivity.exec11.v1' as const;

export const CUSTODY_MOVEMENT_AUTHORITIES = ['TRADE', 'SETTLE', 'TRANSFER', 'WITHDRAW'] as const;
export type CustodyMovementAuthority = (typeof CUSTODY_MOVEMENT_AUTHORITIES)[number];

/** Authorities that may place or manage executable orders without moving assets off-platform. */
export const GROW_EXECUTION_AUTHORITIES = ['TRADE', 'SETTLE'] as const satisfies readonly CustodyMovementAuthority[];

/** Authorities that move customer assets to external destinations — never implied by TRADE. */
export const CUSTODY_OUTBOUND_AUTHORITIES = ['TRANSFER', 'WITHDRAW'] as const satisfies readonly CustodyMovementAuthority[];

export const CUSTODY_RAIL_KINDS = ['DIGITAL_ASSET', 'SECURITIES'] as const;
export type CustodyRailKind = (typeof CUSTODY_RAIL_KINDS)[number];

export const AGENT_ALLOWED_WITHDRAWAL_ACTIONS = ['PREPARE_WITHDRAWAL_PROPOSAL', 'EXPLAIN_WITHDRAWAL_STATUS'] as const;
export type AgentAllowedWithdrawalAction = (typeof AGENT_ALLOWED_WITHDRAWAL_ACTIONS)[number];

export const AGENT_FORBIDDEN_WITHDRAWAL_ACTIONS = [
  'CREATE_DESTINATION',
  'CHANGE_BENEFICIARY',
  'BYPASS_STEP_UP',
  'OVERRIDE_COMPLIANCE',
  'OVERRIDE_TRAVEL_RULE',
  'APPROVE_OWN_WITHDRAWAL',
] as const;
export type AgentForbiddenWithdrawalAction = (typeof AGENT_FORBIDDEN_WITHDRAWAL_ACTIONS)[number];

export const WITHDRAWAL_REQUIREMENT_IDS = [
  'CUSTOMER_MANDATE',
  'DESTINATION_VALIDATION',
  'KERNEL_AUTHORIZATION',
  'STEP_UP_AUTHENTICATION',
  'COMPLIANCE_SCREENING',
  'TRAVEL_RULE_WORKFLOW',
  'CUSTODY_PROVIDER_ACCEPTANCE',
] as const;
export type WithdrawalRequirementId = (typeof WITHDRAWAL_REQUIREMENT_IDS)[number];

export const CUSTODY_MOVEMENT_DECISIONS = ['PERMITTED', 'DENIED', 'AGENT_MAY_PREPARE_ONLY'] as const;
export type CustodyMovementDecision = (typeof CUSTODY_MOVEMENT_DECISIONS)[number];

export const HELIOS_EXEC11_CUSTODY_ISOLATION_QUALIFIED = 'HELIOS_EXEC11_CUSTODY_ISOLATION_QUALIFIED' as const;
export const HELIOS_EXEC11_CUSTODY_ISOLATION_BLOCKED = 'HELIOS_EXEC11_CUSTODY_ISOLATION_BLOCKED' as const;
