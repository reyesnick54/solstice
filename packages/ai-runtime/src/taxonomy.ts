export const AI_PROVIDER_KINDS = ['S3M', 'XAI_GROK', 'LOCAL_TEST'] as const;
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
  'REGULATORY_EXPLANATION',
  'USER_SUPPORT',
] as const;
export type AiTaskClass = (typeof AI_TASK_CLASSES)[number];

export const AI_DATA_CLASSES = [
  'PUBLIC',
  'SYNTHETIC',
  'USER_APPROVED_CONTEXT',
  'FINANCIAL_PRIVATE',
  'PERSONAL_SENSITIVE',
  'REGULATORY_SENSITIVE',
  'AUTHENTICATION_SECRET',
  'PRIVATE_KEY_MATERIAL',
] as const;
export type AiDataClass = (typeof AI_DATA_CLASSES)[number];

export const NEVER_RELEASE_DATA_CLASSES = new Set<AiDataClass>([
  'AUTHENTICATION_SECRET',
  'PRIVATE_KEY_MATERIAL',
]);

export const EXTERNAL_ELIGIBLE_DATA_CLASSES = new Set<AiDataClass>(['PUBLIC', 'SYNTHETIC']);

export const LOCAL_FALLBACK_DATA_CLASSES = new Set<AiDataClass>(['PUBLIC', 'SYNTHETIC']);

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

export const AI_STRUCTURED_KINDS = ['EXPLANATION', 'FINANCIAL_PROPOSAL'] as const;
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
  return kind === 'XAI_GROK';
}

export function taskClassGrantsExecutionAuthority(_taskClass: AiTaskClass): false {
  return false;
}
