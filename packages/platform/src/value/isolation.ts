/**
 * PEVE isolation boundary.
 *
 * PEVE is measurement/intelligence. It sits outside the execution chain:
 * ActionIntent → Kernel → Execution Authority → Domain Service → Ledger.
 *
 * It must not post journals, issue Execution Authority, or become a second PEG.
 */
export const PEVE_ISOLATION = {
  mayNotImport: [
    'packages/ledger/src/journal',
    'packages/kernel/src/kernel',
    'AuthorityIssuer',
    'postJournal',
    'ComplianceKernel',
  ] as const,
  mayNotBecome: [
    'packages/value-engine',
    'packages/peve',
    'packages/economic-score',
    'packages/personal-value',
  ] as const,
  executionAuthorityIssued: false,
  postsJournals: false,
  isSecondPeg: false,
  isHumanWorthScore: false,
  isCreditScore: false,
} as const;
