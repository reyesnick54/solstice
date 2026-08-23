/**
 * User-controlled agent mandate isolation.
 *
 * This package is the ProposalGate / mandate layer. It is not a second
 * Personal Economy Agent, Execution Authority issuer, wallet, Exchange,
 * risk engine, or ledger.
 */
export const SUNREY_AGENT_ISOLATION = {
  mayImport: [
    'packages/domain',
    'packages/money',
    'packages/identity',
    'packages/config',
    'packages/events',
    'packages/evidence',
    'packages/agent',
    'packages/permissions',
    'packages/kernel',
    'packages/security',
    'packages/risk',
    'packages/model-registry',
    'packages/sunrey-chain',
    'packages/sunrey-exchange',
    'packages/custody',
    'packages/ai-runtime',
  ] as const,
  mayNotCall: [
    'postJournal',
    'openAccount',
    'AuthorityIssuer',
    'issue(',
  ] as const,
  forbiddenCompetingPackages: [
    'packages/ai-authority',
    'packages/agent-authority',
    'packages/user-agent-v2',
    'packages/agent-execution',
    'packages/financial-automation',
    'packages/mandate-v2',
    'packages/conversation',
    'packages/action-center',
    'packages/agent-chat',
  ] as const,
  personalEconomyAgentRemainsProposalOnly: true,
  aiIdentityCannotSign: true,
  riskCannotBecomeWalletAuthority: true,
} as const;
