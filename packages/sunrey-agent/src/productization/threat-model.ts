import {
  AGENT_THREAT_IDS,
  type AgentThreatId,
} from './taxonomy.ts';

export type AgentThreatControl = {
  readonly controlId: string;
  readonly owner: 'packages/sunrey-agent' | 'packages/ai-runtime' | 'packages/kernel' | 'packages/identity';
  readonly deterministic: true;
};

export type AgentThreatRecord = {
  readonly threatId: AgentThreatId;
  readonly title: string;
  readonly description: string;
  readonly attacker: string;
  readonly impact: string;
  readonly residualRisk: 'ACCEPTED_SANDBOX' | 'MITIGATED_DETERMINISTIC';
  readonly invariantIds: readonly string[];
  readonly controls: readonly AgentThreatControl[];
};

const CONTROL = (
  controlId: string,
  owner: AgentThreatControl['owner'] = 'packages/sunrey-agent',
): AgentThreatControl =>
  Object.freeze({ controlId, owner, deterministic: true as const });

export const AGENT_THREAT_MODEL: readonly AgentThreatRecord[] = Object.freeze(
  AGENT_THREAT_IDS.map((threatId) => recordFor(threatId)),
);

function recordFor(threatId: AgentThreatId): AgentThreatRecord {
  switch (threatId) {
    case 'PROMPT_INJECTION':
      return row(
        threatId,
        'Direct prompt injection',
        'User or channel text tries to override system, mandate, or Kernel rules.',
        'End user or compromised client',
        'Unauthorized tool use or policy bypass',
        ['AGENT_CANNOT_BYPASS_KERNEL', 'AGENT_CANNOT_REDEFINE_TOOL_AUTHORITY_FROM_EXTERNAL_TEXT'],
        [CONTROL('detectPromptInjection'), CONTROL('mandatePolicyGate')],
      );
    case 'INDIRECT_PROMPT_INJECTION':
      return row(
        threatId,
        'Indirect prompt injection',
        'Merchant text, transaction descriptions, market-data blurbs, or uploaded content try to redefine tool authority.',
        'External content author',
        'Cross-user tool misuse or forged proposals',
        ['AGENT_CANNOT_REDEFINE_TOOL_AUTHORITY_FROM_EXTERNAL_TEXT'],
        [CONTROL('untrustedExternalContentFence')],
      );
    case 'TOOL_ABUSE':
      return row(
        threatId,
        'Tool abuse',
        'Malformed, recursive, or out-of-mandate tool calls attempt privileged mutation.',
        'Model or malicious user',
        'Unauthorized financial proposal or data access',
        ['AGENT_CANNOT_POST_LEDGER_ENTRY', 'AGENT_CANNOT_FORGE_PROPOSAL'],
        [CONTROL('typedToolRuntime'), CONTROL('adversarialToolValidator')],
      );
    case 'UNAUTHORIZED_RESOURCE_ACCESS':
      return row(
        threatId,
        'Unauthorized resource access',
        'Guessed identifiers or confused-deputy calls reach another subject.',
        'Malicious user',
        'Account, PEG, portfolio, or memory disclosure',
        ['AGENT_CANNOT_ACCESS_OTHER_USER_RESOURCE'],
        [CONTROL('subjectScopedResourceGuard')],
      );
    case 'CROSS_USER_DATA_EXPOSURE':
      return row(
        threatId,
        'Cross-user data exposure',
        'User A Agent requests User B account, conversation, PEG, portfolio, proposals, or memory.',
        'Malicious user',
        'Regulated data leak',
        ['AGENT_CANNOT_ACCESS_OTHER_USER_RESOURCE'],
        [CONTROL('ownerEqualityCheck')],
      );
    case 'PROPOSAL_FORGERY':
      return row(
        threatId,
        'Proposal forgery',
        'Client or model supplies a fabricated proposal hash, owner, or amount.',
        'Malicious user or compromised model',
        'Unauthorized payment or growth proposal',
        ['AGENT_CANNOT_FORGE_PROPOSAL'],
        [CONTROL('serverSideProposalStore'), CONTROL('contentHashBinding')],
      );
    case 'APPROVAL_FORGERY':
      return row(
        threatId,
        'Approval forgery',
        'Agent or attacker claims human approval without a consumed nonce from a human principal.',
        'Agent principal or replay attacker',
        'Self-approved financial execution',
        ['AGENT_CANNOT_SELF_APPROVE', 'AGENT_CANNOT_FORGE_APPROVAL'],
        [CONTROL('assertAgentCannotSelfApprove'), CONTROL('approvalNonceLedger')],
      );
    case 'PRIVILEGE_ESCALATION':
      return row(
        threatId,
        'Privilege escalation',
        'Prompt or memory asks the Agent to become admin, expand mandate, or activate production.',
        'Malicious user',
        'Mandate expansion or production activation',
        ['AGENT_CANNOT_ACTIVATE_PRODUCTION', 'AGENT_CANNOT_OVERRIDE_PROVIDER_LIFECYCLE'],
        [CONTROL('selfExpansionForbidden'), CONTROL('productionFlagFreeze')],
      );
    case 'MODEL_HALLUCINATION':
      return row(
        threatId,
        'Model hallucination',
        'Model invents facts, tools, or status not returned by a typed tool.',
        'Model error',
        'User acts on fabricated state',
        ['AGENT_CANNOT_INVENT_FINANCIAL_NUMBERS', 'AGENT_CANNOT_MARK_FINANCIAL_ACTION_COMPLETE'],
        [CONTROL('groundedResponseBuilder'), CONTROL('structuredOutputFence')],
      );
    case 'FINANCIAL_HALLUCINATION':
      return row(
        threatId,
        'Financial hallucination',
        'Model invents balances, prices, FX, fees, portfolio values, status, eligibility, or provider state.',
        'Model error',
        'Unsafe financial decision',
        ['AGENT_CANNOT_INVENT_FINANCIAL_NUMBERS'],
        [CONTROL('toolGroundedMoneyOnly'), CONTROL('unavailableOnToolFailure')],
      );
    case 'INCORRECT_TOOL_SELECTION':
      return row(
        threatId,
        'Incorrect tool selection',
        'Model picks a mutation tool when a read was required, or the reverse.',
        'Model error',
        'Unexpected proposal or missing facts',
        ['AGENT_CANNOT_FORGE_PROPOSAL'],
        [CONTROL('deterministicFinancialPlanner'), CONTROL('toolAllowlist')],
      );
    case 'DATA_EXFILTRATION':
      return row(
        threatId,
        'Data exfiltration',
        'Prompt asks the model to emit another user record or dump context.',
        'Malicious user',
        'Personal or financial data leak',
        ['AGENT_CANNOT_ACCESS_OTHER_USER_RESOURCE'],
        [CONTROL('contextAuthorization'), CONTROL('conversationRedaction')],
      );
    case 'SECRET_LEAKAGE':
      return row(
        threatId,
        'Secret leakage',
        'Logs, metrics, prompts, or replies contain passwords, tokens, keys, PAN/CVV, or provider secrets.',
        'Operator or model',
        'Credential compromise',
        ['AGENT_CANNOT_SEND_PROVIDER_CREDENTIAL'],
        [CONTROL('redactSecrets', 'packages/ai-runtime'), CONTROL('forbiddenLogScan')],
      );
    case 'MALICIOUS_EXTERNAL_CONTENT':
      return row(
        threatId,
        'Malicious external content',
        'Untrusted third-party text is treated as instruction.',
        'External publisher',
        'Indirect injection or social engineering',
        ['AGENT_CANNOT_REDEFINE_TOOL_AUTHORITY_FROM_EXTERNAL_TEXT'],
        [CONTROL('externalContentUntrustedLabel')],
      );
    case 'RUNAWAY_TOOL_LOOP':
      return row(
        threatId,
        'Runaway tool loop',
        'Recursive or repeated tool calls generate unbounded work or cost.',
        'Model or attacker',
        'Denial of service and cost abuse',
        ['AGENT_CANNOT_POST_LEDGER_ENTRY'],
        [CONTROL('maxToolCallsPerTurn'), CONTROL('recursiveCallBlock')],
      );
    case 'DENIAL_OF_SERVICE':
      return row(
        threatId,
        'Denial of service',
        'Flooded turns or huge context exhaust the Agent plane.',
        'Abusive client',
        'Agent unavailability; ordinary APIs must continue',
        ['AGENT_CANNOT_DISABLE_ACCOUNT_ACCESS_VIA_AGENT_KILL_SWITCH'],
        [CONTROL('rateLimits'), CONTROL('degradedMode')],
      );
    case 'COST_ABUSE':
      return row(
        threatId,
        'Cost abuse',
        'Unbounded model or tool calls create uncontrolled provider bills.',
        'Abusive client or loop',
        'Operational cost overrun',
        [],
        [CONTROL('agentBudget'), CONTROL('maxModelCallsPerTurn')],
      );
    case 'MODEL_PROVIDER_COMPROMISE':
      return row(
        threatId,
        'Model-provider compromise',
        'A vendor model starts complying with jailbreaks or emitting secrets.',
        'Compromised provider',
        'Policy bypass if safety depended on vendor refusals',
        ['AGENT_CANNOT_BYPASS_KERNEL', 'AGENT_CANNOT_SELECT_UNAPPROVED_MODEL'],
        [CONTROL('serverSideInvariants'), CONTROL('modelSwapEval')],
      );
    case 'STALE_CONTEXT':
      return row(
        threatId,
        'Stale context',
        'Expired quotes, revoked mandates, or old snapshots are treated as current.',
        'Time / cache',
        'Execution of expired financial state',
        ['AGENT_CANNOT_EXECUTE_EXPIRED_PROPOSAL'],
        [CONTROL('quoteExpiryCheck'), CONTROL('mandateExpiryCheck')],
      );
    case 'MEMORY_POISONING':
      return row(
        threatId,
        'Memory poisoning',
        'User asks the Agent to remember balances, KYC, or approval power.',
        'Malicious or confused user',
        'Authoritative state override',
        ['AGENT_CANNOT_POISON_AUTHORITATIVE_MEMORY', 'AGENT_CANNOT_OVERRIDE_KYC'],
        [CONTROL('memoryClassifier')],
      );
    case 'SOCIAL_ENGINEERING':
      return row(
        threatId,
        'Social engineering',
        'User claims urgency, staff identity, or legal demand to skip controls.',
        'Malicious user',
        'Skipped approval or Kernel',
        ['AGENT_CANNOT_BYPASS_KERNEL', 'AGENT_CANNOT_SELF_APPROVE'],
        [CONTROL('humanEscalationInsteadOfOverride')],
      );
    case 'UNSAFE_FINANCIAL_CERTAINTY':
      return row(
        threatId,
        'Unsafe financial certainty',
        'Agent represents an uncertain investment outcome as certain.',
        'Model or prompt',
        'Misleading investment communication',
        ['AGENT_CANNOT_CLAIM_CERTAIN_INVESTMENT_OUTCOME'],
        [CONTROL('returnClaimFence'), CONTROL('scenarioOnlyGrowthCopy')],
      );
    case 'INCORRECT_EXECUTION_STATUS':
      return row(
        threatId,
        'Incorrect execution status',
        'Agent marks a failed or pending action complete, or invents success.',
        'Model error',
        'User believes money moved when it did not',
        ['AGENT_CANNOT_MARK_FINANCIAL_ACTION_COMPLETE'],
        [CONTROL('domainOutcomeOnlyStatus')],
      );
  }
}

function row(
  threatId: AgentThreatId,
  title: string,
  description: string,
  attacker: string,
  impact: string,
  invariantIds: readonly string[],
  controls: readonly AgentThreatControl[],
): AgentThreatRecord {
  return Object.freeze({
    threatId,
    title,
    description,
    attacker,
    impact,
    residualRisk: 'MITIGATED_DETERMINISTIC',
    invariantIds,
    controls,
  });
}

export function threatById(threatId: AgentThreatId): AgentThreatRecord {
  const found = AGENT_THREAT_MODEL.find((row) => row.threatId === threatId);
  if (!found) {
    throw new Error(`unknown threat ${threatId}`);
  }
  return found;
}
