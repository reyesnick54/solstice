import { detectPromptInjection } from '../policy.ts';
import {
  type ConversationIntent,
  type ConversationRefusalCode,
} from './taxonomy.ts';

export type IntentClassification =
  | { readonly ok: true; readonly intent: ConversationIntent; readonly grantsAuthority: false }
  | { readonly ok: false; readonly code: ConversationRefusalCode; readonly message: string };

const PAYMENT_MARKERS = /\b(send|pay|transfer|wire)\b/i;
const FX_MARKERS = /\b(convert|fx|exchange .+ to|to riyals?|to sar|to usd)\b/i;
const GROW_MARKERS = /\b(grow|how should i (invest|grow)|growth plan|opportunit)/i;
const INVEST_MARKERS = /\b(invest|portfolio|rebalance)\b/i;
const EXCHANGE_MARKERS = /\b(buy|sell)\b.+\b(sunrey|moonrey|coin)\b/i;
const WITHDRAW_MARKERS = /\b(withdraw|cash out)\b/i;
const CARD_MARKERS = /\b(freeze|unfreeze|card)\b/i;
const GOAL_MARKERS = /\b(goal|save for)\b/i;
const DATA_MARKERS = /\b(permission|consent|share my data)\b/i;
const SUPPORT_MARKERS = /\b(help|support|issue|problem)\b/i;
const MODIFY_MARKERS = /\b(make it|change (it|the amount)|instead|update (the )?(amount|proposal))\b/i;
const ANALYSIS_MARKERS = /\b(how much|balance|what do i have|analyze|snapshot)\b/i;

export function classifyConversationIntent(text: string): IntentClassification {
  const injection = conversationalInjection(text);
  if (injection) {
    return injection;
  }
  if (MODIFY_MARKERS.test(text)) {
    return { ok: true, intent: 'PROPOSAL_MODIFICATION', grantsAuthority: false };
  }
  if (EXCHANGE_MARKERS.test(text)) {
    return { ok: true, intent: 'EXCHANGE_REQUEST', grantsAuthority: false };
  }
  if (FX_MARKERS.test(text)) {
    return { ok: true, intent: 'FX_REQUEST', grantsAuthority: false };
  }
  if (GROW_MARKERS.test(text)) {
    return { ok: true, intent: 'GROWTH_REQUEST', grantsAuthority: false };
  }
  if (INVEST_MARKERS.test(text)) {
    return { ok: true, intent: 'INVESTMENT_REQUEST', grantsAuthority: false };
  }
  if (WITHDRAW_MARKERS.test(text)) {
    return { ok: true, intent: 'WITHDRAWAL_REQUEST', grantsAuthority: false };
  }
  if (PAYMENT_MARKERS.test(text)) {
    return { ok: true, intent: 'PAYMENT_REQUEST', grantsAuthority: false };
  }
  if (CARD_MARKERS.test(text)) {
    return { ok: true, intent: 'CARD_MANAGEMENT', grantsAuthority: false };
  }
  if (GOAL_MARKERS.test(text)) {
    return { ok: true, intent: 'GOAL_MANAGEMENT', grantsAuthority: false };
  }
  if (DATA_MARKERS.test(text)) {
    return { ok: true, intent: 'DATA_PERMISSION_REQUEST', grantsAuthority: false };
  }
  if (ANALYSIS_MARKERS.test(text)) {
    return { ok: true, intent: 'FINANCIAL_ANALYSIS', grantsAuthority: false };
  }
  if (SUPPORT_MARKERS.test(text)) {
    return { ok: true, intent: 'SUPPORT_REQUEST', grantsAuthority: false };
  }
  return { ok: true, intent: 'INFORMATION_REQUEST', grantsAuthority: false };
}

export function conversationalInjection(
  text: string,
): { readonly ok: false; readonly code: ConversationRefusalCode; readonly message: string } | null {
  const lower = text.toLowerCase();
  if (detectPromptInjection(text) || lower.includes('ignore all rules') || lower.includes('send everything')) {
    return {
      ok: false,
      code: 'PROMPT_INJECTION',
      message: 'That instruction cannot change policy, mandates, or financial authority.',
    };
  }
  if (lower.includes('approve this yourself') || lower.includes('approve it yourself')) {
    return {
      ok: false,
      code: 'AGENT_CANNOT_SELF_APPROVE',
      message: 'The Agent cannot approve its own proposal. A human must approve from the Action Card.',
    };
  }
  if (lower.includes('use my master key') || lower.includes('master key')) {
    return {
      ok: false,
      code: 'MASTER_KEY_FORBIDDEN',
      message: 'The Agent never receives a master key and cannot use one.',
    };
  }
  if (lower.includes('kyc is complete') || lower.includes('tell the system kyc')) {
    return {
      ok: false,
      code: 'KYC_NOT_MUTABLE_BY_AGENT',
      message: 'Identity verification state is owned by SunRey Identity. Conversation cannot mark KYC complete.',
    };
  }
  if (lower.includes('change the exchange rate') || lower.includes('set the rate')) {
    return {
      ok: false,
      code: 'RATE_NOT_CLIENT_MUTABLE',
      message: 'FX rates come from a server-owned quote. Conversation cannot invent or override a rate.',
    };
  }
  if (lower.includes('mark the payment complete') || lower.includes('mark it complete')) {
    return {
      ok: false,
      code: 'STATUS_NOT_CLIENT_MUTABLE',
      message: 'Completion is an execution outcome. Creating or approving a proposal is not completion.',
    };
  }
  return null;
}
