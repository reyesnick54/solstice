/**
 * Agent package isolation boundary.
 *
 * This package may import `@solstice/contracts` (relative path to
 * packages/contracts) and nothing else in the Solstice tree.
 *
 * FORBIDDEN in this directory (enforced by tests/agent-isolation.test.ts):
 * - packages/platform
 * - ExecutionAuthority, AuthorityIssuer
 * - Ledger, postJournal, SimulatedLedger
 * - ComplianceKernel
 * - constructing ActionIntent
 *
 * The Personal Economy Agent emits AgentProposal values only. It has no
 * write path, no ledger handle, and no ability to construct an
 * ExecutionAuthority — because those types are not in scope.
 */
export const AGENT_ISOLATION = {
  mayImport: ['@solstice/contracts', 'packages/contracts'] as const,
  mayNotImport: [
    'packages/platform',
    'ExecutionAuthority',
    'AuthorityIssuer',
    'postJournal',
    'ComplianceKernel',
    'SimulatedLedger',
    'ActionIntent',
  ] as const,
} as const;
