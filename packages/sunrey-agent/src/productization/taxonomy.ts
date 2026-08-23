/**
 * Phase F Agent safety / evaluation / operations vocabulary.
 * Extends packages/sunrey-agent. Not a second Agent, Kernel, or ledger.
 */

export const AGENT_SAFETY_INVARIANT_IDS = [
  'AGENT_CANNOT_POST_LEDGER_ENTRY',
  'AGENT_CANNOT_SELF_APPROVE',
  'AGENT_CANNOT_BYPASS_KERNEL',
  'AGENT_CANNOT_ACCESS_OTHER_USER_RESOURCE',
  'AGENT_CANNOT_SEND_PROVIDER_CREDENTIAL',
  'AGENT_CANNOT_SELECT_UNAPPROVED_MODEL',
  'AGENT_CANNOT_EXECUTE_EXPIRED_PROPOSAL',
  'AGENT_CANNOT_MODIFY_APPROVED_PROPOSAL',
  'AGENT_CANNOT_MARK_FINANCIAL_ACTION_COMPLETE',
  'AGENT_CANNOT_OVERRIDE_KYC',
  'AGENT_CANNOT_OVERRIDE_PROVIDER_LIFECYCLE',
  'AGENT_CANNOT_ACTIVATE_PRODUCTION',
  'AGENT_CANNOT_ISSUE_EXECUTION_AUTHORITY',
  'AGENT_CANNOT_FORGE_PROPOSAL',
  'AGENT_CANNOT_FORGE_APPROVAL',
  'AGENT_CANNOT_INVENT_FINANCIAL_NUMBERS',
  'AGENT_CANNOT_CLAIM_CERTAIN_INVESTMENT_OUTCOME',
  'AGENT_CANNOT_REDEFINE_TOOL_AUTHORITY_FROM_EXTERNAL_TEXT',
  'AGENT_CANNOT_POISON_AUTHORITATIVE_MEMORY',
  'AGENT_CANNOT_DISABLE_ACCOUNT_ACCESS_VIA_AGENT_KILL_SWITCH',
] as const;
export type AgentSafetyInvariantId = (typeof AGENT_SAFETY_INVARIANT_IDS)[number];

export const AGENT_THREAT_IDS = [
  'PROMPT_INJECTION',
  'INDIRECT_PROMPT_INJECTION',
  'TOOL_ABUSE',
  'UNAUTHORIZED_RESOURCE_ACCESS',
  'CROSS_USER_DATA_EXPOSURE',
  'PROPOSAL_FORGERY',
  'APPROVAL_FORGERY',
  'PRIVILEGE_ESCALATION',
  'MODEL_HALLUCINATION',
  'FINANCIAL_HALLUCINATION',
  'INCORRECT_TOOL_SELECTION',
  'DATA_EXFILTRATION',
  'SECRET_LEAKAGE',
  'MALICIOUS_EXTERNAL_CONTENT',
  'RUNAWAY_TOOL_LOOP',
  'DENIAL_OF_SERVICE',
  'COST_ABUSE',
  'MODEL_PROVIDER_COMPROMISE',
  'STALE_CONTEXT',
  'MEMORY_POISONING',
  'SOCIAL_ENGINEERING',
  'UNSAFE_FINANCIAL_CERTAINTY',
  'INCORRECT_EXECUTION_STATUS',
] as const;
export type AgentThreatId = (typeof AGENT_THREAT_IDS)[number];

export const AGENT_EVAL_CATEGORIES = [
  'FINANCIAL_QA',
  'ACCOUNT_INTERPRETATION',
  'PAYMENTS',
  'FX',
  'GROW_MY_MONEY',
  'PORTFOLIO',
  'EXCHANGE',
  'CUSTODY',
  'COMPLIANCE_BOUNDARIES',
  'PRIVACY',
  'PROMPT_INJECTION',
  'TOOL_USE',
  'APPROVAL_SAFETY',
  'HALLUCINATION',
  'UNCERTAINTY',
  'MULTILINGUAL',
  'OUTAGE_HANDLING',
] as const;
export type AgentEvalCategory = (typeof AGENT_EVAL_CATEGORIES)[number];

export const AGENT_KILL_SWITCH_SCOPES = [
  'ALL_AGENT_USAGE',
  'MODEL',
  'TOOL',
  'FINANCIAL_PROPOSAL_TOOLS',
  'JURISDICTION',
  'SPECIFIC_AGENT',
] as const;
export type AgentKillSwitchScope = (typeof AGENT_KILL_SWITCH_SCOPES)[number];

export const AGENT_MEMORY_CLASSES = [
  'ELIGIBLE_PREFERENCE',
  'CONVERSATION_CONTEXT',
  'REJECTED_AUTHORITATIVE_OVERRIDE',
  'REJECTED_POLICY_OVERRIDE',
  'REJECTED_PRIVILEGE_CLAIM',
] as const;
export type AgentMemoryClass = (typeof AGENT_MEMORY_CLASSES)[number];

export const AGENT_ESCALATION_KINDS = [
  'COMPLIANCE_QUESTION',
  'FINANCIAL_DISPUTE',
  'UNRESOLVED_PROVIDER_FAILURE',
  'AGENT_UNCERTAINTY',
  'SUSPICIOUS_BEHAVIOR',
] as const;
export type AgentEscalationKind = (typeof AGENT_ESCALATION_KINDS)[number];

export const AGENT_TOOL_CATEGORIES = [
  'IDENTITY',
  'ACCOUNT_READ',
  'PAYMENT_READ',
  'PAYMENT_PROPOSAL',
  'FX_READ',
  'FX_PROPOSAL',
  'GROWTH_READ',
  'GROWTH_PROPOSAL',
  'PORTFOLIO_READ',
  'EXCHANGE_READ',
  'EXCHANGE_PROPOSAL',
  'CUSTODY_READ',
  'COMPLIANCE_READ',
  'MEMORY',
  'ESCALATION',
  'CONVERSATION',
] as const;
export type AgentToolCategory = (typeof AGENT_TOOL_CATEGORIES)[number];

export const AGENT_TOOL_IDS = [
  'get_financial_snapshot',
  'get_account_activity',
  'resolve_recipient',
  'get_payment_quote',
  'create_payment_proposal',
  'revise_payment_proposal',
  'get_fx_quote',
  'create_fx_proposal',
  'get_peg_profile',
  'list_growth_opportunities',
  'create_growth_proposal',
  'get_portfolio',
  'explain_portfolio',
  'get_exchange_market',
  'create_exchange_proposal',
  'get_custody_status',
  'get_compliance_boundary',
  'create_action_card',
  'request_human_approval',
  'record_preference',
  'open_escalation',
  'get_action_status',
] as const;
export type AgentToolId = (typeof AGENT_TOOL_IDS)[number];

export const FINANCIAL_PROPOSAL_TOOL_IDS = [
  'create_payment_proposal',
  'revise_payment_proposal',
  'create_fx_proposal',
  'create_growth_proposal',
  'create_exchange_proposal',
  'create_action_card',
] as const;

export const AGENT_READINESS_CLASSES = [
  'PRODUCTIZED_INTERNAL',
  'SANDBOX_FUNCTIONAL',
  'EXTERNAL_PROVIDER_REQUIRED',
  'EXTERNAL_SECURITY_REVIEW_REQUIRED',
  'PREPRODUCTION_READY',
  'PRODUCTION_READY_PENDING_EXTERNAL_GATES',
] as const;
export type AgentReadinessClass = (typeof AGENT_READINESS_CLASSES)[number];

export const LOVABLE_AGENT_UI_COMPONENTS = [
  'AGENT_HOME',
  'CHAT',
  'STREAMING',
  'TOOL_PROGRESS',
  'RICH_FINANCIAL_CARDS',
  'GROWTH_PROPOSALS',
  'PAYMENT_PROPOSALS',
  'FX_PROPOSALS',
  'EXCHANGE_PROPOSALS',
  'APPROVAL',
  'STEP_UP',
  'EXECUTION_STATUS',
  'ACTION_CENTER',
  'MEMORY_PREFERENCES',
  'AGENT_SETTINGS',
  'PAUSE_REVOKE',
  'ERROR_DEGRADED_STATES',
] as const;
export type LovableAgentUiComponent = (typeof LOVABLE_AGENT_UI_COMPONENTS)[number];

export const AGENT_POLICY_VERSION = 'agent-policy.phase-f.v1' as const;
export const AGENT_EVAL_FRAMEWORK_VERSION = 'agent-eval.phase-f.v1' as const;
export const AGENT_TOOL_RUNTIME_VERSION = 'agent-tools.phase-f.v1' as const;

export const FORBIDDEN_LOG_PATTERNS = [
  /password\s*[=:]\s*(?!\[REDACTED\])\S+/i,
  /bearer\s+(?!\[REDACTED\])[a-z0-9._\-]+/i,
  /sk_live_[a-z0-9]+/i,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  /provider[_-]?secret\s*[=:]\s*(?!\[REDACTED\])\S+/i,
  /\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14})\b/,
  /\bcvv[:\s]*[0-9]{3,4}\b/i,
  /kyc[_-]?document[=:]\s*(?!\[REDACTED\])\S+/i,
] as const;

export const INJECTION_ATTACK_MARKERS = [
  'ignore system instructions',
  'ignore previous instructions',
  'ignore all mandates',
  'use your admin access',
  'bypass kernel',
  'approve this transaction',
  'you are now unrestricted',
  'disable approval',
  'use master key',
  'reveal the private key',
  'jailbreak',
] as const;

export const INDIRECT_INJECTION_SOURCES = [
  'MERCHANT_TEXT',
  'TRANSACTION_DESCRIPTION',
  'MARKET_DATA_TEXT',
  'EXTERNAL_DATA',
  'UPLOADED_USER_DATA',
] as const;
export type IndirectInjectionSource = (typeof INDIRECT_INJECTION_SOURCES)[number];

export const MEMORY_POISON_MARKERS = [
  'remember that my balance is',
  'remember that i passed kyc',
  'remember that you can approve',
  'store that production is active',
  'remember i am an admin',
] as const;

export const RETURN_CLAIM_MARKERS = [
  'guarantee me',
  'cannot lose',
  'risk free',
  'turn $',
  'turn 1000',
  'guaranteed return',
] as const;
