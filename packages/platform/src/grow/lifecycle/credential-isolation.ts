const AI_RUNTIME_ISOLATION = {
  receivesMasterKey: false,
  maySignTransactions: false,
  mayIssueExecutionAuthority: false,
} as const;

const GROW_AGENT_PRIVILEGED_TOOLS = [
  'executeProposal',
  'issueExecutionAuthority',
  'postJournal',
  'selfApproveProposal',
] as const;

const FORBIDDEN_CREDENTIAL_PATTERNS = [
  /broker[_-]?api[_-]?key/i,
  /bank[_-]?credential/i,
  /custody[_-]?private[_-]?key/i,
  /validator[_-]?key/i,
  /wallet[_-]?signing[_-]?key/i,
  /BEGIN (RSA |EC )?PRIVATE KEY/,
  /api[_-]?secret/i,
] as const;

export type CredentialIsolationReport = {
  readonly aiReceivesMasterKey: false;
  readonly aiMaySignTransactions: false;
  readonly aiMayIssueExecutionAuthority: false;
  readonly privilegedGrowToolsBlocked: readonly string[];
  readonly forbiddenPatternsDetected: readonly string[];
  readonly pass: boolean;
};

export function assertAiRuntimeIsolation(): CredentialIsolationReport {
  return scanAgentContext('');
}

export function scanAgentContext(context: string): CredentialIsolationReport {
  const forbiddenPatternsDetected = FORBIDDEN_CREDENTIAL_PATTERNS.filter((pattern) => pattern.test(context)).map(
    (pattern) => pattern.source,
  );
  return Object.freeze({
    aiReceivesMasterKey: false,
    aiMaySignTransactions: AI_RUNTIME_ISOLATION.maySignTransactions,
    aiMayIssueExecutionAuthority: AI_RUNTIME_ISOLATION.mayIssueExecutionAuthority,
    privilegedGrowToolsBlocked: Object.freeze([...GROW_AGENT_PRIVILEGED_TOOLS]),
    forbiddenPatternsDetected: Object.freeze(forbiddenPatternsDetected),
    pass:
      AI_RUNTIME_ISOLATION.receivesMasterKey === false &&
      AI_RUNTIME_ISOLATION.maySignTransactions === false &&
      AI_RUNTIME_ISOLATION.mayIssueExecutionAuthority === false &&
      forbiddenPatternsDetected.length === 0,
  });
}

export function agentContextContainsForbiddenCredential(context: string): boolean {
  return !scanAgentContext(context).pass && FORBIDDEN_CREDENTIAL_PATTERNS.some((pattern) => pattern.test(context));
}
