/**
 * Conversational financial-action taxonomy.
 * Intent is routing metadata. It does not grant authority.
 */

export const CONVERSATION_INTENTS = [
  'INFORMATION_REQUEST',
  'FINANCIAL_ANALYSIS',
  'PAYMENT_REQUEST',
  'FX_REQUEST',
  'GROWTH_REQUEST',
  'INVESTMENT_REQUEST',
  'EXCHANGE_REQUEST',
  'WITHDRAWAL_REQUEST',
  'CARD_MANAGEMENT',
  'GOAL_MANAGEMENT',
  'DATA_PERMISSION_REQUEST',
  'SUPPORT_REQUEST',
  'PROPOSAL_MODIFICATION',
] as const;
export type ConversationIntent = (typeof CONVERSATION_INTENTS)[number];

export const ACTION_CARD_TYPES = [
  'PAYMENT',
  'FX',
  'GROWTH',
  'INVESTMENT',
  'EXCHANGE',
  'WITHDRAWAL',
  'CARD_CONTROL',
] as const;
export type ActionCardType = (typeof ACTION_CARD_TYPES)[number];

export const ACTION_CARD_STATUSES = [
  'COLLECTING',
  'PROPOSAL_CREATED',
  'AWAITING_APPROVAL',
  'AWAITING_STEP_UP',
  'APPROVED',
  'PROCESSING',
  'SUBMITTED',
  'COMPLETED',
  'FAILED',
  'ACTION_REQUIRED',
  'REQUIRES_REVIEW',
  'REJECTED',
  'CANCELLED',
  'EXPIRED',
  'SUPERSEDED',
] as const;
export type ActionCardStatus = (typeof ACTION_CARD_STATUSES)[number];

export const ACTION_CENTER_VIEWS = [
  'AWAITING_APPROVAL',
  'PROCESSING',
  'COMPLETED',
  'REJECTED',
  'EXPIRED',
  'REQUIRES_ATTENTION',
] as const;
export type ActionCenterView = (typeof ACTION_CENTER_VIEWS)[number];

export const AVAILABLE_ACTION_CONTROLS = [
  'APPROVE',
  'MODIFY',
  'REJECT',
  'CANCEL',
  'ASK_AGENT',
] as const;
export type AvailableActionControl = (typeof AVAILABLE_ACTION_CONTROLS)[number];

export const UNCERTAINTY_CLASSES = ['FACT', 'ESTIMATE', 'PROJECTION', 'UNKNOWN'] as const;
export type UncertaintyClass = (typeof UNCERTAINTY_CLASSES)[number];

export const STATEMENT_SOURCE_KINDS = [
  'LEDGER_BACKED_ACCOUNT_SERVICE',
  'FX_QUOTE_PROVIDER',
  'MARKET_DATA_PROVIDER',
  'GROWTH_SCENARIO_CONFIGURATION',
  'PERSONAL_ECONOMIC_GRAPH',
  'USER_STATED',
  'POLICY',
] as const;
export type StatementSourceKind = (typeof STATEMENT_SOURCE_KINDS)[number];

export const CONVERSATION_REFUSAL_CODES = [
  'PROMPT_INJECTION',
  'AGENT_CANNOT_SELF_APPROVE',
  'MASTER_KEY_FORBIDDEN',
  'KYC_NOT_MUTABLE_BY_AGENT',
  'RATE_NOT_CLIENT_MUTABLE',
  'STATUS_NOT_CLIENT_MUTABLE',
  'ELIGIBILITY_REFUSED',
  'RESOURCE_NOT_OWNED',
  'ENTITY_AMBIGUOUS',
  'SLOT_REQUIRED',
  'FINANCIAL_TERM_NOT_GUESSED',
  'PROPOSAL_ALREADY_APPROVED',
  'APPROVAL_REQUIRES_HUMAN',
  'STEP_UP_REQUIRED',
  'ACKNOWLEDGEMENT_REQUIRED',
  'UNSUPPORTED_NUMERIC_CLAIM',
  'TOOL_NOT_APPROVED',
  'PRODUCTION_DISABLED',
] as const;
export type ConversationRefusalCode = (typeof CONVERSATION_REFUSAL_CODES)[number];

export const FINANCIAL_INTENTS: readonly ConversationIntent[] = [
  'PAYMENT_REQUEST',
  'FX_REQUEST',
  'GROWTH_REQUEST',
  'INVESTMENT_REQUEST',
  'EXCHANGE_REQUEST',
  'WITHDRAWAL_REQUEST',
];

export function isConversationIntent(value: unknown): value is ConversationIntent {
  return typeof value === 'string' && (CONVERSATION_INTENTS as readonly string[]).includes(value);
}

export function isFinancialIntent(intent: ConversationIntent): boolean {
  return (FINANCIAL_INTENTS as readonly string[]).includes(intent);
}

export function cardTypeForIntent(intent: ConversationIntent): ActionCardType | null {
  switch (intent) {
    case 'PAYMENT_REQUEST':
      return 'PAYMENT';
    case 'FX_REQUEST':
      return 'FX';
    case 'GROWTH_REQUEST':
      return 'GROWTH';
    case 'INVESTMENT_REQUEST':
      return 'INVESTMENT';
    case 'EXCHANGE_REQUEST':
      return 'EXCHANGE';
    case 'WITHDRAWAL_REQUEST':
      return 'WITHDRAWAL';
    case 'CARD_MANAGEMENT':
      return 'CARD_CONTROL';
    default:
      return null;
  }
}
