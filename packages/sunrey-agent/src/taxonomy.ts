export const AGENT_IDENTITY_KINDS = ['SUNREY_AGENT'] as const;
export type AgentIdentityKind = (typeof AGENT_IDENTITY_KINDS)[number];

export const AGENT_TYPES = ['PERSONAL_ASSISTANT', 'HOUSEHOLD', 'READ_ONLY', 'PROPOSAL_ONLY'] as const;
export type AgentType = (typeof AGENT_TYPES)[number];

export const AGENT_LIFECYCLE_STATES = [
  'CREATED',
  'ACTIVE',
  'PAUSED',
  'RESTRICTED',
  'REVOKED',
  'ARCHIVED',
] as const;
export type AgentLifecycleState = (typeof AGENT_LIFECYCLE_STATES)[number];

/** What the Agent may assist with. Execution remains separately governed. */
export const AGENT_ASSIST_SCOPES = [
  'READ_ACCOUNTS',
  'ANALYZE_SPENDING',
  'READ_PEG',
  'READ_GOALS',
  'READ_PORTFOLIO',
  'CREATE_PAYMENT_PROPOSAL',
  'CREATE_FX_PROPOSAL',
  'CREATE_GROWTH_PROPOSAL',
  'CREATE_INVESTMENT_PROPOSAL',
  'CREATE_EXCHANGE_PROPOSAL',
  'MANAGE_NON_FINANCIAL_PREFERENCES',
] as const;
export type AgentAssistScope = (typeof AGENT_ASSIST_SCOPES)[number];

export const FORBIDDEN_ASSIST_SCOPES = [
  'DIRECT_LEDGER_WRITE',
  'BYPASS_KERNEL',
  'SELF_APPROVE',
  'MASTER_SIGNING_KEY',
] as const;
export type ForbiddenAssistScope = (typeof FORBIDDEN_ASSIST_SCOPES)[number];

export const AGENT_ACTION_CLASSES = [
  'READ_FINANCIAL_STATE',
  'PREPARE_PAYMENT',
  'EXECUTE_PREAPPROVED_PAYMENT',
  'PREPARE_EXCHANGE_ORDER',
  'EXECUTE_BOUNDED_EXCHANGE_ORDER',
  'PREPARE_REBALANCE',
  'REBALANCE_WITHIN_POLICY',
  'MANAGE_ALLOWED_PRODUCTIVE_SERVICE',
  'REQUEST_HUMAN_APPROVAL',
] as const;

export type AgentActionClass = (typeof AGENT_ACTION_CLASSES)[number];

export const HIGH_RISK_ACTION_CLASSES = [
  'ADD_WITHDRAWAL_DESTINATION',
  'WALLET_RECOVERY',
  'KEY_ROTATION',
  'CHANGE_AGENT_MANDATE',
  'LARGE_TRANSFER_BEYOND_LIMIT',
  'NEW_REGULATED_PRODUCT',
  'LEVERAGE_OR_BORROWING',
] as const;

export type HighRiskActionClass = (typeof HIGH_RISK_ACTION_CLASSES)[number];

export const AGENT_ASSET_IDS = [
  'SUNREY_COIN',
  'MOONREY_COIN',
  'FIAT_ACCOUNT',
  'LISTED_ASSET',
] as const;

export type AgentAssetId = (typeof AGENT_ASSET_IDS)[number];

export const AGENT_APPROVAL_CLASSES = [
  'NO_ADDITIONAL_APPROVAL_WITHIN_MANDATE',
  'MOBILE_CONFIRMATION',
  'SECOND_DEVICE_CONFIRMATION',
  'CUSTODY_APPROVAL',
  'MULTI_PERSON_APPROVAL',
] as const;

export type AgentApprovalClass = (typeof AGENT_APPROVAL_CLASSES)[number];

export const MANDATE_MODES = ['SIMULATION_ONLY', 'PRODUCTION'] as const;
export type MandateMode = (typeof MANDATE_MODES)[number];

export const MANDATE_STATES = ['ACTIVE', 'SUSPENDED', 'EXPIRED', 'REVOKED'] as const;
export type MandateState = (typeof MANDATE_STATES)[number];

export const PROPOSAL_STATES = [
  'DRAFT',
  'PENDING_APPROVAL',
  'APPROVED',
  'INELIGIBLE',
  'EXECUTED',
  'FAILED',
] as const;
export type ProposalState = (typeof PROPOSAL_STATES)[number];

export const REVOCATION_SCOPES = ['MANDATE', 'AGENT', 'DELEGATED_KEY', 'ACTION_CLASS', 'WALLET_KILL'] as const;
export type RevocationScope = (typeof REVOCATION_SCOPES)[number];

export const EXPECTED_OUTCOME_CLASSES = [
  'PAYMENT_PREPARED',
  'PAYMENT_SUBMITTED_FOR_AUTHORIZATION',
  'EXCHANGE_ORDER_PREPARED',
  'EXCHANGE_ORDER_SUBMITTED_FOR_AUTHORIZATION',
  'REBALANCE_PREPARED',
  'HUMAN_APPROVAL_REQUESTED',
  'READ_ONLY',
  'SIMULATION_EVALUATION',
] as const;
export type ExpectedOutcomeClass = (typeof EXPECTED_OUTCOME_CLASSES)[number];

export const SAFETY_EVENT_KINDS = [
  'EXECUTION_FAILURE',
  'PRICE_PROTECTION_REJECTION',
  'MARKET_UNAVAILABLE',
  'COMPLIANCE_REJECTION',
  'MANDATE_LIMIT_REJECTION',
  'NETWORK_FAILURE',
  'SELF_EXPANSION_ATTEMPT',
  'PROMPT_INJECTION_BLOCKED',
  'REVOKED_MANDATE_USED',
  'AI_IDENTITY_SIGN_ATTEMPT',
] as const;
export type SafetyEventKind = (typeof SAFETY_EVENT_KINDS)[number];

export const FORBIDDEN_STRATEGY_CLAIMS = [
  'GUARANTEED_RETURN',
  'GUARANTEED_PROFIT',
  'GUARANTEED_BALANCE_GROWTH',
  'RISK_FREE_TRADING',
] as const;
export type ForbiddenStrategyClaim = (typeof FORBIDDEN_STRATEGY_CLAIMS)[number];

export const CONVERSATION_STATUSES = ['ACTIVE', 'ARCHIVED', 'DELETED', 'REDACTED'] as const;
export type ConversationStatus = (typeof CONVERSATION_STATUSES)[number];

export const MESSAGE_ROLES = ['USER', 'AGENT', 'SYSTEM', 'TOOL'] as const;
export type MessageRole = (typeof MESSAGE_ROLES)[number];

export const MEMORY_CATEGORIES = [
  'USER_PREFERENCE',
  'FINANCIAL_GOAL_REFERENCE',
  'COMMUNICATION_PREFERENCE',
  'DECLARED_CONSTRAINT',
  'CONFIRMED_FACT_REFERENCE',
] as const;
export type MemoryCategory = (typeof MEMORY_CATEGORIES)[number];

export const MEMORY_SOURCES = [
  'USER_DECLARED',
  'USER_CORRECTED',
  'CONFIRMED_SYSTEM_FACT',
  'PEG_REFERENCE',
] as const;
export type MemorySource = (typeof MEMORY_SOURCES)[number];

export const MEMORY_CLASSIFICATIONS = ['PERSONALIZATION', 'OPERATIONAL_AUDIT', 'PUBLIC_SYNTHETIC'] as const;
export type MemoryClassification = (typeof MEMORY_CLASSIFICATIONS)[number];

export const PERSONALIZATION_VERBOSITY = ['BRIEF', 'NORMAL', 'DETAILED'] as const;
export type PersonalizationVerbosity = (typeof PERSONALIZATION_VERBOSITY)[number];

export const EXPLANATION_COMPLEXITY = ['SIMPLE', 'STANDARD', 'TECHNICAL'] as const;
export type ExplanationComplexity = (typeof EXPLANATION_COMPLEXITY)[number];

export const AGENT_RUNTIME_EVENT_KINDS = [
  'agent.created',
  'agent.paused',
  'agent.revoked',
  'conversation.created',
  'message.received',
  'message.completed',
  'memory.created',
  'memory.changed',
  'mandate.changed',
] as const;
export type AgentRuntimeEventKind = (typeof AGENT_RUNTIME_EVENT_KINDS)[number];

export const AGENT_MANDATE_REFUSAL_CODES = [
  'ORPHAN_AGENT',
  'AGENT_NOT_ACTIVE',
  'AGENT_PAUSED',
  'AGENT_RESTRICTED',
  'AGENT_REVOKED',
  'AGENT_ARCHIVED',
  'IDENTITY_COLLISION',
  'FORBIDDEN_ASSIST_SCOPE',
  'ASSIST_SCOPE_NOT_PERMITTED',
  'CONTEXT_UNAUTHORIZED',
  'MEMORY_SPECULATION_FORBIDDEN',
  'MEMORY_NOT_USER_EDITABLE',
  'PERSONALIZATION_DISABLED',
  'CONVERSATION_NOT_OWNED',
  'CONVERSATION_CLOSED',
  'CROSS_USER_DENIED',
  'TIME_WINDOW_CLOSED',
  'CURRENCY_NOT_PERMITTED',
  'ASSET_CLASS_NOT_PERMITTED',
  'TOOL_BUDGET_EXCEEDED',
  'DAILY_AGGREGATE_EXCEEDED',
  'MANDATE_EXPIRED',
  'MANDATE_REVOKED',
  'ACTION_CLASS_NOT_PERMITTED',
  'ASSET_NOT_PERMITTED',
  'MARKET_NOT_PERMITTED',
  'DESTINATION_NOT_PERMITTED',
  'BUDGET_EXCEEDED',
  'FREQUENCY_EXCEEDED',
  'SELF_EXPANSION_FORBIDDEN',
  'HIGH_RISK_REQUIRES_HUMAN',
  'APPROVAL_REQUIRED',
  'APPROVAL_REPLAY',
  'WRONG_WALLET',
  'WRONG_NETWORK',
  'SIMULATION_CANNOT_SUBMIT',
  'PRODUCTION_PRECONDITIONS_UNMET',
  'JURISDICTION_UNAVAILABLE',
  'COMPLIANCE_REFUSED',
  'RISK_RESTRICTED',
  'WALLET_AUTHORIZATION_REFUSED',
  'AI_CANNOT_SIGN',
  'MASTER_KEY_FORBIDDEN',
  'HUMAN_INFORMATION_NOT_PERMITTED',
  'WILDCARD_ASSET_FORBIDDEN',
  'PROFIT_GUARANTEE_FORBIDDEN',
  'PENDING_INELIGIBLE_AFTER_REVOCATION',
  'SCHEDULE_DOES_NOT_AUTHORIZE',
  'PROMPT_INJECTION',
] as const;
export type AgentMandateRefusalCode = (typeof AGENT_MANDATE_REFUSAL_CODES)[number];

export const HUMAN_REQUIRED_ACTIONS = new Set<string>([
  ...HIGH_RISK_ACTION_CLASSES,
  'CHANGE_AGENT_MANDATE',
]);

export const EXECUTABLE_ACTION_CLASSES = new Set<AgentActionClass>([
  'EXECUTE_PREAPPROVED_PAYMENT',
  'EXECUTE_BOUNDED_EXCHANGE_ORDER',
  'REBALANCE_WITHIN_POLICY',
  'MANAGE_ALLOWED_PRODUCTIVE_SERVICE',
]);

export function isAgentActionClass(value: unknown): value is AgentActionClass {
  return typeof value === 'string' && (AGENT_ACTION_CLASSES as readonly string[]).includes(value);
}

export function isHighRiskAction(value: string): boolean {
  return (HIGH_RISK_ACTION_CLASSES as readonly string[]).includes(value);
}

export function isAgentAssistScope(value: unknown): value is AgentAssistScope {
  return typeof value === 'string' && (AGENT_ASSIST_SCOPES as readonly string[]).includes(value);
}

export function isForbiddenAssistScope(value: unknown): value is ForbiddenAssistScope {
  return typeof value === 'string' && (FORBIDDEN_ASSIST_SCOPES as readonly string[]).includes(value);
}

export function isAgentLifecycleState(value: unknown): value is AgentLifecycleState {
  return typeof value === 'string' && (AGENT_LIFECYCLE_STATES as readonly string[]).includes(value);
}

export const ASSIST_SCOPE_TO_ACTION: Readonly<Record<AgentAssistScope, AgentActionClass | null>> = {
  READ_ACCOUNTS: 'READ_FINANCIAL_STATE',
  ANALYZE_SPENDING: 'READ_FINANCIAL_STATE',
  READ_PEG: 'READ_FINANCIAL_STATE',
  READ_GOALS: 'READ_FINANCIAL_STATE',
  READ_PORTFOLIO: 'READ_FINANCIAL_STATE',
  CREATE_PAYMENT_PROPOSAL: 'PREPARE_PAYMENT',
  CREATE_FX_PROPOSAL: 'PREPARE_PAYMENT',
  CREATE_GROWTH_PROPOSAL: 'REBALANCE_WITHIN_POLICY',
  CREATE_INVESTMENT_PROPOSAL: 'REBALANCE_WITHIN_POLICY',
  CREATE_EXCHANGE_PROPOSAL: 'PREPARE_EXCHANGE_ORDER',
  MANAGE_NON_FINANCIAL_PREFERENCES: null,
};

export const READ_ASSIST_SCOPES = new Set<AgentAssistScope>([
  'READ_ACCOUNTS',
  'ANALYZE_SPENDING',
  'READ_PEG',
  'READ_GOALS',
  'READ_PORTFOLIO',
]);

export function defaultAssistScopesForActions(actions: readonly AgentActionClass[]): readonly AgentAssistScope[] {
  const scopes: AgentAssistScope[] = [];
  if (actions.includes('READ_FINANCIAL_STATE')) {
    scopes.push('READ_ACCOUNTS', 'ANALYZE_SPENDING', 'READ_PEG', 'READ_GOALS', 'READ_PORTFOLIO');
  }
  if (actions.includes('PREPARE_PAYMENT')) {
    scopes.push('CREATE_PAYMENT_PROPOSAL', 'CREATE_FX_PROPOSAL');
  }
  if (actions.includes('PREPARE_EXCHANGE_ORDER')) {
    scopes.push('CREATE_EXCHANGE_PROPOSAL');
  }
  if (actions.includes('REBALANCE_WITHIN_POLICY')) {
    scopes.push('CREATE_GROWTH_PROPOSAL', 'CREATE_INVESTMENT_PROPOSAL');
  }
  scopes.push('MANAGE_NON_FINANCIAL_PREFERENCES');
  return Object.freeze([...new Set(scopes)]);
}
