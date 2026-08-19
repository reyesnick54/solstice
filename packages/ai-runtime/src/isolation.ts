/**
 * SunRey AI Runtime isolation.
 *
 * This package is the inference plane. It is not a second Financial Agent,
 * Execution Authority issuer, wallet, Exchange, risk engine, or ledger.
 */
export const AI_RUNTIME_ISOLATION = {
  mayImport: [
    'packages/domain',
    'packages/money',
    'packages/config',
    'packages/security',
    'packages/identity',
    'packages/model-registry',
  ] as const,
  mayNotCall: ['postJournal', 'openAccount', 'AuthorityIssuer', 'issue('] as const,
  forbiddenCompetingPackages: [
    'packages/ai-engine',
    'packages/model-runtime',
    'packages/grok-runtime',
    'packages/s3m',
    'packages/llm',
    'packages/inference-v2',
  ] as const,
  financialAgentRemainsPackagesSunreyAgent: true,
  modelRegistryRemainsCanonical: true,
  secretsReusePackagesSecurity: true,
  grokNetworkingDisabled: true,
  s3mIsAdapterNotATrainingFork: true,
  receivesMasterKey: false,
  maySignTransactions: false,
  mayIssueExecutionAuthority: false,
  mayMint: false,
} as const;
