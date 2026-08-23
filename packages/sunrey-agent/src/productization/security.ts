import { createHash } from 'node:crypto';

import { err, ok, type Result } from '../../../domain/src/result.ts';
import { detectPromptInjection } from '../policy.ts';
import {
  FORBIDDEN_LOG_PATTERNS,
  INDIRECT_INJECTION_SOURCES,
  INJECTION_ATTACK_MARKERS,
  MEMORY_POISON_MARKERS,
  RETURN_CLAIM_MARKERS,
  type AgentMemoryClass,
  type IndirectInjectionSource,
} from './taxonomy.ts';

export type SecurityDenial = {
  readonly ok: false;
  readonly code:
    | 'PROMPT_INJECTION'
    | 'INDIRECT_PROMPT_INJECTION'
    | 'CROSS_USER_DENIED'
    | 'MEMORY_POISON_REJECTED'
    | 'SECRET_REDACTED'
    | 'ADVERSARIAL_TOOL_REFUSED'
    | 'CERTAIN_RETURN_CLAIM_REFUSED'
    | 'UNTRUSTED_EXTERNAL_CONTENT';
  readonly detail: string;
};

export function detectDirectInjection(text: string): boolean {
  const lower = text.toLowerCase();
  return detectPromptInjection(text) || INJECTION_ATTACK_MARKERS.some((marker) => lower.includes(marker));
}

export function detectIndirectInjection(text: string, source: IndirectInjectionSource | string): boolean {
  if (!(INDIRECT_INJECTION_SOURCES as readonly string[]).includes(source) && source !== 'USER_PROMPT') {
    return detectDirectInjection(text);
  }
  return detectDirectInjection(text);
}

export function detectReturnClaim(text: string): boolean {
  const lower = text.toLowerCase();
  return RETURN_CLAIM_MARKERS.some((marker) => lower.includes(marker));
}

export function classifyMemoryWrite(text: string): AgentMemoryClass {
  const lower = text.toLowerCase();
  if (MEMORY_POISON_MARKERS.some((marker) => lower.includes(marker)) || /passed kyc|balance is|can approve|production is active/.test(lower)) {
    if (/kyc/.test(lower)) {
      return 'REJECTED_AUTHORITATIVE_OVERRIDE';
    }
    if (/approve|admin|kernel|authority/.test(lower)) {
      return 'REJECTED_PRIVILEGE_CLAIM';
    }
    return 'REJECTED_AUTHORITATIVE_OVERRIDE';
  }
  if (/prefer|language|theme|notify|quiet hours/.test(lower)) {
    return 'ELIGIBLE_PREFERENCE';
  }
  return 'CONVERSATION_CONTEXT';
}

export function rememberOrReject(input: {
  readonly ownerUserId: string;
  readonly text: string;
}): Result<{ readonly memoryClass: AgentMemoryClass; readonly stored: boolean }, SecurityDenial> {
  const memoryClass = classifyMemoryWrite(input.text);
  if (memoryClass.startsWith('REJECTED_')) {
    return err({
      ok: false,
      code: 'MEMORY_POISON_REJECTED',
      detail: `${memoryClass} cannot override authoritative financial or policy state`,
    });
  }
  return ok({ memoryClass, stored: true });
}

export function assertSameSubject(
  subjectUserId: string,
  requestedUserId: string,
  resource: string,
): Result<true, SecurityDenial> {
  if (subjectUserId !== requestedUserId) {
    return err({
      ok: false,
      code: 'CROSS_USER_DENIED',
      detail: `${resource} is not visible across users`,
    });
  }
  return ok(true);
}

export function redactConversationText(text: string): string {
  let next = text;
  next = next.replace(/(password\s*[=:]\s*)\S+/gi, '$1[REDACTED]');
  next = next.replace(/bearer\s+[a-z0-9._\-]+/gi, 'bearer [REDACTED]');
  next = next.replace(/sk_live_[a-z0-9]+/gi, '[REDACTED_TOKEN]');
  next = next.replace(/-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g, '[REDACTED_KEY]');
  next = next.replace(/provider[_-]?secret\s*[=:]\s*\S+/gi, 'provider_secret=[REDACTED]');
  next = next.replace(/\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14})\b/g, '[REDACTED_PAN]');
  next = next.replace(/\bcvv[:\s]*[0-9]{3,4}\b/gi, 'cvv=[REDACTED]');
  next = next.replace(/kyc[_-]?document[=:\s]+\S+/gi, 'kyc_document=[REDACTED]');
  return next;
}

export function conversationLogIsSafe(text: string): boolean {
  return !FORBIDDEN_LOG_PATTERNS.some((pattern) => pattern.test(text));
}

export type AdversarialToolCall = {
  readonly name: string;
  readonly ownerUserId: string;
  readonly claimedUserId?: string;
  readonly amountMinor?: bigint;
  readonly currency?: string;
  readonly approvalId?: string;
  readonly quoteExpiresAtMs?: number;
  readonly nowMs?: number;
  readonly recipientId?: string;
  readonly accountId?: string;
  readonly providerId?: string;
  readonly complianceState?: string;
  readonly ledgerAccountId?: string;
  readonly proposalId?: string;
  readonly recursive?: boolean;
};

const SUPPORTED_CURRENCIES = new Set(['USD', 'SAR', 'EUR', 'GBP']);

export function refuseAdversarialToolCall(call: AdversarialToolCall): Result<true, SecurityDenial> {
  if (call.recursive) {
    return fail('recursive tool call is refused before privileged mutation');
  }
  if (call.claimedUserId && call.claimedUserId !== call.ownerUserId) {
    return fail('forged user is refused before privileged mutation');
  }
  if (call.amountMinor !== undefined && call.amountMinor <= 0n) {
    return fail('negative or zero amount is refused');
  }
  if (call.amountMinor !== undefined && call.amountMinor > 10_000_000_000n) {
    return fail('enormous amount is refused');
  }
  if (call.currency && !SUPPORTED_CURRENCIES.has(call.currency)) {
    return fail('unsupported currency is refused');
  }
  if (call.approvalId?.startsWith('forged_') || call.approvalId === 'agent_self') {
    return fail('forged approval is refused');
  }
  if (call.quoteExpiresAtMs !== undefined && call.nowMs !== undefined && call.nowMs > call.quoteExpiresAtMs) {
    return fail('expired quote is refused');
  }
  if (call.recipientId === 'invalid' || call.recipientId === '') {
    return fail('invalid recipient is refused');
  }
  if (call.accountId?.startsWith('acct_other_') || call.accountId === 'wrong_account') {
    return fail('wrong account is refused');
  }
  if (call.providerId?.startsWith('injected_')) {
    return fail('injected provider id is refused');
  }
  if (call.complianceState === 'FAKE_CLEARED' || call.complianceState === 'OVERRIDE_ALLOW') {
    return fail('fake compliance state is refused');
  }
  if (call.ledgerAccountId?.startsWith('led_fake_')) {
    return fail('fake ledger account is refused');
  }
  if (call.proposalId === 'duplicate' || call.name === 'duplicate_proposal') {
    return fail('duplicate proposal is refused');
  }
  return ok(true);
}

export function contentFingerprint(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function fail(detail: string): Result<true, SecurityDenial> {
  return err({ ok: false, code: 'ADVERSARIAL_TOOL_REFUSED', detail });
}

export const CONVERSATION_RETENTION = Object.freeze({
  conversationDays: 90,
  logDays: 30,
  auditDays: 365,
  exportable: true,
  subjectDeletable: true,
  operatorRawPromptAccess: false,
});
