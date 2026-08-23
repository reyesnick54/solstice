import type { ActionCardStatus } from './taxonomy.ts';
import { languageForStatus } from './explain.ts';

const COMPLETION_CLAIMS = [
  'your payment is complete',
  'the payment is complete',
  'transfer complete',
  'it is done',
  'money has been sent',
  'trade filled',
  'order completed',
];

export function agentMayClaimCompletion(status: ActionCardStatus): boolean {
  return status === 'COMPLETED';
}

export function sanitizeAgentLanguage(text: string, status: ActionCardStatus): string {
  if (agentMayClaimCompletion(status)) {
    return text;
  }
  const lower = text.toLowerCase();
  if (COMPLETION_CLAIMS.some((claim) => lower.includes(claim))) {
    return languageForStatus(status);
  }
  return text;
}

export function statusVerb(status: ActionCardStatus): string {
  return languageForStatus(status);
}
