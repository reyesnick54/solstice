/**
 * Sandbox persona identifiers. Isolated from fixture world construction
 * so read-only Consumer BFF routes do not load Grow adapters.
 */

export const SANDBOX_LABEL = 'SANDBOX_FIXTURE_NON_PRODUCTION' as const;

export const SANDBOX_PERSONA_IDS = [
  'basic_verified',
  'kyc_pending',
  'multi_currency',
  'investment',
  'agent_enabled',
  'exchange',
  'restricted',
  'provider_down',
  'pending_activity',
  'zero_balance',
  'grow',
  'grow_new_user',
  'grow_healthy_saver',
  'grow_high_idle_cash',
  'grow_high_spender',
  'grow_investor',
  'grow_multi_currency',
  'grow_goal_oriented',
  'grow_liquidity_constrained',
  'grow_high_concentration',
  'vault_ready',
  'hin_ready',
  'data_licensee',
  'vault_minimal',
  'vault_financial',
  'vault_employment',
  'vault_multi_source',
  'vault_derived',
  'vault_disputed',
  'vault_revoked',
  'vault_restricted_agent',
] as const;
export type SandboxPersonaId = (typeof SANDBOX_PERSONA_IDS)[number];

export function sandboxToken(persona: SandboxPersonaId): string {
  return `sandbox.${persona}`;
}

export function listSandboxPersonas(): readonly {
  readonly id: SandboxPersonaId;
  readonly token: string;
  readonly label: typeof SANDBOX_LABEL;
}[] {
  return SANDBOX_PERSONA_IDS.map((id) =>
    Object.freeze({
      id,
      token: sandboxToken(id),
      label: SANDBOX_LABEL,
    }),
  );
}
