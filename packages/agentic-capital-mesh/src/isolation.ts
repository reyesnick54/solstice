/**
 * Agentic Capital Mesh isolation boundary.
 *
 * The Mesh proposes and critiques. It reuses Personal Economy Agent runtime
 * concepts and must not become a second generic AI runtime or an execution path.
 */
export const MESH_ISOLATION = {
  mayImport: [
    'packages/domain',
    'packages/money',
    'packages/identity',
    'packages/config',
    'packages/events',
    'packages/evidence',
    'packages/agent',
    'packages/risk',
    'packages/model-registry',
    'packages/investments',
  ] as const,
  mayNotImport: [
    'packages/ledger',
    'packages/kernel',
    'packages/platform',
    'AuthorityIssuer',
    'ExecutionAuthority',
    'postJournal',
    'createPaperOrder',
    'PaperBrokerProvider',
    'BrokerExecutionProvider',
    'ComplianceKernel',
    'LIVE_INVESTMENT_EXECUTION',
    'LIVE_TRADING_ENABLED',
  ] as const,
  forbiddenTools: [
    'postJournal',
    'issueExecutionAuthority',
    'submitOrder',
    'changeRiskLimit',
    'changeMandate',
    'approveModel',
  ] as const,
} as const;
