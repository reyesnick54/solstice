export const AI_PROVIDER_KINDS = ['S3M', 'XAI_GROK', 'LOCAL_TEST', 'HTTPS_GENERIC'] as const;
export type AiProviderKind = (typeof AI_PROVIDER_KINDS)[number];

export const AI_RUNTIME_MODES = [
  'S3M_PRIMARY',
  'S3M_ONLY',
  'GROK_BETA_PRIMARY',
  'GROK_DEMO_ONLY',
  'DUAL_SHADOW_COMPARE',
] as const;
export type AiRuntimeMode = (typeof AI_RUNTIME_MODES)[number];

export const AI_TASK_CLASSES = [
  'GENERAL_ASSISTANT',
  'FINANCIAL_EXPLANATION',
  'GROWTH_PLANNING',
  'PORTFOLIO_REASONING',
  'PAYMENT_PREPARATION',
  'EXCHANGE_ORDER_PREPARATION',
  'ECONOMIC_ANALYSIS',
  'SUNREY_INFORMATION_REASONING',
  'MOONREY_PRODUCTIVE_ANALYSIS',
  'MARKET_OPPORTUNITY_RESEARCH',
  'REGULATORY_EXPLANATION',
  'USER_SUPPORT',
] as const;
export type AiTaskClass = (typeof AI_TASK_CLASSES)[number];

export const AI_DATA_CLASSES = [
  'PUBLIC',
  'SYNTHETIC',
  'INTERNAL',
  'USER_APPROVED_CONTEXT',
  'FINANCIAL_PRIVATE',
  'PERSONAL_SENSITIVE',
  'REGULATORY_SENSITIVE',
  'AUTHENTICATION_SECRET',
  'PRIVATE_KEY_MATERIAL',
] as const;
export type AiDataClass = (typeof AI_DATA_CLASSES)[number];

export const AI_PRIVACY_CLASSES = [
  'PUBLIC',
  'INTERNAL',
  'PERSONAL',
  'FINANCIAL_SENSITIVE',
  'REGULATED_IDENTITY',
  'SECRET',
] as const;
export type AiPrivacyClass = (typeof AI_PRIVACY_CLASSES)[number];

export const NEVER_RELEASE_DATA_CLASSES = new Set<AiDataClass>([
  'AUTHENTICATION_SECRET',
  'PRIVATE_KEY_MATERIAL',
]);

export const NEVER_RELEASE_PRIVACY_CLASSES = new Set<AiPrivacyClass>([
  'REGULATED_IDENTITY',
  'SECRET',
]);

export const AI_APPROVED_PURPOSES = [
  'FINANCIAL_EXPLANATION',
  'STRUCTURED_PROPOSAL_NARRATION',
  'SIMPLE_CLASSIFICATION',
  'GROWTH_PLANNING',
  'PORTFOLIO_REASONING',
  'PAYMENT_PREPARATION',
  'EXCHANGE_ORDER_PREPARATION',
  'USER_SUPPORT',
  'REGULATORY_EXPLANATION',
  'GENERAL_ASSISTANT',
  'MARKET_OPPORTUNITY_RESEARCH',
] as const;
export type AiApprovedPurpose = (typeof AI_APPROVED_PURPOSES)[number];

export const PRIVILEGED_AI_PURPOSES = new Set<AiApprovedPurpose>([
  'FINANCIAL_EXPLANATION',
  'STRUCTURED_PROPOSAL_NARRATION',
  'PAYMENT_PREPARATION',
  'EXCHANGE_ORDER_PREPARATION',
  'GROWTH_PLANNING',
  'PORTFOLIO_REASONING',
  'REGULATORY_EXPLANATION',
]);

export const EXTERNAL_ELIGIBLE_DATA_CLASSES = new Set<AiDataClass>(['PUBLIC', 'SYNTHETIC']);

export const LOCAL_FALLBACK_DATA_CLASSES = new Set<AiDataClass>(['PUBLIC', 'SYNTHETIC', 'INTERNAL']);

export const AI_TOOL_INTENTS = [
  'READ_FINANCIAL_STATE',
  'READ_PERSONAL_ECONOMIC_GRAPH',
  'READ_GROWTH_PLAN',
  'READ_EXCHANGE_MARKET',
  'READ_PAYMENT_STATUS',
  'READ_SUNREY_INFORMATION_OPPORTUNITIES',
  'READ_MOONREY_PRODUCTIVE_DATA',
  'PREPARE_PAYMENT',
  'PREPARE_EXCHANGE_ORDER',
  'PREPARE_REBALANCE',
  'REQUEST_HUMAN_APPROVAL',
] as const;
export type AiToolIntentName = (typeof AI_TOOL_INTENTS)[number];

export const FORBIDDEN_AI_TOOLS = [
  'EXECUTE_PAYMENT',
  'EXECUTE_TRADE',
  'SIGN_TRANSACTION',
  'MINT',
  'BURN',
  'CHANGE_MANDATE',
  'ADD_WITHDRAWAL_DESTINATION',
  'ROTATE_KEY',
  'RECOVER_WALLET',
] as const;
export type ForbiddenAiToolName = (typeof FORBIDDEN_AI_TOOLS)[number];

export const AI_STRUCTURED_KINDS = [
  'EXPLANATION',
  'FINANCIAL_PROPOSAL',
  'GROWTH_AGENT_PROPOSAL',
  'MARKET_OPPORTUNITY_RESEARCH',
] as const;
export type AiStructuredKind = (typeof AI_STRUCTURED_KINDS)[number];

export const AI_FAILURE_CODES = [
  'PROVIDER_UNAVAILABLE',
  'PROVIDER_TIMEOUT',
  'PROVIDER_UNHEALTHY',
  'EXTERNAL_NETWORK_DISABLED',
  'GROK_NOT_IMPLEMENTED',
  'S3M_UNAVAILABLE_NO_EXTERNAL_FALLBACK',
  'ROUTING_REFUSED',
  'DATA_CLASS_BLOCKS_EXTERNAL',
  'CONTEXT_RELEASE_DENIED',
  'NEVER_RELEASE_DATA_CLASS',
  'MODEL_REF_UNRESOLVED',
  'MODEL_NOT_APPROVED_FOR_SIMULATION',
  'INVALID_STRUCTURED_OUTPUT',
  'FORBIDDEN_TOOL_REQUESTED',
  'FLOATING_POINT_MONEY_FORBIDDEN',
  'PROMPT_INJECTION',
  'AUTHORIZATION_REQUIRED',
  'JURISDICTION_REQUIRED',
  'TASK_CLASS_IS_NOT_AUTHORITY',
  'SECRET_IN_PAYLOAD',
  'PROVIDER_CANNOT_SELF_SELECT',
  'POLICY_IMMUTABLE',
  'MODEL_UNAVAILABLE',
  'MODEL_NOT_AVAILABLE',
  'MODEL_TIMEOUT',
  'MODEL_RATE_LIMITED',
  'AUTHENTICATION_FAILURE',
  'BILLING_DISABLED',
  'INSUFFICIENT_QUOTA',
  'MODEL_OUTPUT_INVALID',
  'MODEL_CONTEXT_TOO_LARGE',
  'MODEL_POLICY_BLOCKED',
  'MODEL_PROVIDER_ERROR',
  'MODEL_CANCELLED',
  'PRODUCTION_APPROVAL_UNREACHABLE',
  'CACHE_POLICY_DENIED',
] as const;
export type AiFailureCode = (typeof AI_FAILURE_CODES)[number];

export const LOCAL_TEST_FIXTURES = [
  'normal',
  'structured_financial_proposal',
  'malformed',
  'malicious_tool',
  'prompt_injection',
  'timeout',
  'unavailable',
  'rate_limited',
  'context_too_large',
  'cancelled',
  'repairable',
] as const;
export type LocalTestFixture = (typeof LOCAL_TEST_FIXTURES)[number];

export function isAiProviderKind(value: unknown): value is AiProviderKind {
  return typeof value === 'string' && (AI_PROVIDER_KINDS as readonly string[]).includes(value);
}

export function isAiToolIntentName(value: unknown): value is AiToolIntentName {
  return typeof value === 'string' && (AI_TOOL_INTENTS as readonly string[]).includes(value);
}

export function isForbiddenAiTool(value: unknown): value is ForbiddenAiToolName {
  return typeof value === 'string' && (FORBIDDEN_AI_TOOLS as readonly string[]).includes(value);
}

export function isExternalProvider(kind: AiProviderKind): boolean {
  return kind === 'XAI_GROK' || kind === 'HTTPS_GENERIC';
}

export function privacyClassToDataClass(privacy: AiPrivacyClass): AiDataClass {
  switch (privacy) {
    case 'PUBLIC':
      return 'PUBLIC';
    case 'INTERNAL':
      return 'INTERNAL';
    case 'PERSONAL':
      return 'PERSONAL_SENSITIVE';
    case 'FINANCIAL_SENSITIVE':
      return 'FINANCIAL_PRIVATE';
    case 'REGULATED_IDENTITY':
      return 'REGULATORY_SENSITIVE';
    case 'SECRET':
      return 'AUTHENTICATION_SECRET';
    default: {
      const _exhaustive: never = privacy;
      return _exhaustive;
    }
  }
}

export function dataClassToPrivacyClass(dataClass: AiDataClass): AiPrivacyClass {
  switch (dataClass) {
    case 'PUBLIC':
    case 'SYNTHETIC':
      return 'PUBLIC';
    case 'INTERNAL':
    case 'USER_APPROVED_CONTEXT':
      return 'INTERNAL';
    case 'PERSONAL_SENSITIVE':
      return 'PERSONAL';
    case 'FINANCIAL_PRIVATE':
      return 'FINANCIAL_SENSITIVE';
    case 'REGULATORY_SENSITIVE':
      return 'REGULATED_IDENTITY';
    case 'AUTHENTICATION_SECRET':
    case 'PRIVATE_KEY_MATERIAL':
      return 'SECRET';
    default: {
      const _exhaustive: never = dataClass;
      return _exhaustive;
    }
  }
}

export function taskClassGrantsExecutionAuthority(_taskClass: AiTaskClass): false {
  return false;
}
