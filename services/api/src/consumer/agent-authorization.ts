/**
 * Explicit agent action authorization boundaries.
 * AI agents must not mint, elevate permissions, or execute regulated
 * actions while feature-disabled.
 */

export const FORBIDDEN_AGENT_AUTHORITIES = [
  'MINT_SUNREY',
  'MINT_MOONREY',
  'APPROVE_ISSUANCE',
  'CHANGE_CONSENT',
  'ELEVATE_PERMISSIONS',
  'CHANGE_MONETARY_POLICY',
  'WITHDRAW_BEYOND_MANDATE',
  'EXECUTE_WHILE_FEATURE_DISABLED',
  'SELF_APPROVE',
  'BYPASS_KERNEL',
  'ISSUE_EXECUTION_AUTHORITY',
] as const;
export type ForbiddenAgentAuthority = (typeof FORBIDDEN_AGENT_AUTHORITIES)[number];

export const AGENT_CAPABILITY_CLASSES = ['ADVICE', 'ANALYSIS', 'PROPOSAL', 'EXECUTION'] as const;
export type AgentCapabilityClass = (typeof AGENT_CAPABILITY_CLASSES)[number];

export type AgentAuthorizationPolicy = {
  readonly schema: 'sunrey.consumer.agent-authorization.v1';
  readonly agentIsApprover: false;
  readonly agentIsExecutionAuthority: false;
  readonly agentMayMint: false;
  readonly adviceOnlyByDefault: true;
  readonly executionRequiresHumanApproval: true;
  readonly forbiddenAuthorities: readonly ForbiddenAgentAuthority[];
  readonly capabilitySeparation: Readonly<Record<AgentCapabilityClass, { readonly allowed: boolean; readonly note: string }>>;
};

export const AGENT_AUTHORIZATION_POLICY: AgentAuthorizationPolicy = Object.freeze({
  schema: 'sunrey.consumer.agent-authorization.v1',
  agentIsApprover: false,
  agentIsExecutionAuthority: false,
  agentMayMint: false,
  adviceOnlyByDefault: true,
  executionRequiresHumanApproval: true,
  forbiddenAuthorities: FORBIDDEN_AGENT_AUTHORITIES,
  capabilitySeparation: Object.freeze({
    ADVICE: Object.freeze({ allowed: true, note: 'Analysis and recommendations only. No financial mutation.' }),
    ANALYSIS: Object.freeze({ allowed: true, note: 'Read-only financial state and scenario analysis.' }),
    PROPOSAL: Object.freeze({ allowed: true, note: 'Proposals require human approval before any execution path.' }),
    EXECUTION: Object.freeze({
      allowed: false,
      note: 'Agents never hold Execution Authority. Human or Kernel-gated paths only.',
    }),
  }),
});

/**
 * Validate that a requested agent action class is permitted under policy.
 */
export function assertAgentActionPermitted(input: {
  readonly actionClass: string;
  readonly featureEnabled: boolean;
  readonly withinMandate: boolean;
}): { readonly permitted: true } | { readonly permitted: false; readonly reason: string } {
  if (!input.featureEnabled) {
    return { permitted: false, reason: 'Agent feature is disabled for this customer.' };
  }
  if ((FORBIDDEN_AGENT_AUTHORITIES as readonly string[]).includes(input.actionClass)) {
    return { permitted: false, reason: `Agent action ${input.actionClass} is permanently forbidden.` };
  }
  if (input.actionClass === 'EXECUTION') {
    return { permitted: false, reason: 'Agents cannot execute. Proposals require human approval.' };
  }
  if (!input.withinMandate) {
    return { permitted: false, reason: 'Action exceeds active mandate scope.' };
  }
  return { permitted: true };
}
