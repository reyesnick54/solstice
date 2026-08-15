/**
 * Agent package isolation boundary.
 *
 * This package may import domain Result/time/brand, money, identity types,
 * and config clock. It must not import platform, kernel, ledger, or
 * Execution Authority.
 *
 * An AgentProposal is not an ActionIntent.
 */
export const AGENT_ISOLATION = {
  mayImport: [
    'packages/domain',
    'packages/money',
    'packages/identity',
    'packages/config',
  ] as const,
  mayNotImport: [
    'packages/platform',
    'packages/kernel',
    'packages/ledger',
    'packages/payments',
    'packages/cards',
    'ExecutionAuthority',
    'AuthorityIssuer',
    'postJournal',
    'ComplianceKernel',
    'ActionIntent',
    'RailAdapter',
  ] as const,
} as const;
