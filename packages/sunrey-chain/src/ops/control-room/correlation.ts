import type { SpanRecord } from '../observability.ts';
import { SAFE_CORRELATION_KEYS, type AuthorityLineage, type SafeCorrelationRefs } from './types.ts';

export function safeCorrelationRefs(input: SafeCorrelationRefs): SafeCorrelationRefs {
  const out: Record<string, string> = {};
  for (const key of SAFE_CORRELATION_KEYS) {
    const value = input[key];
    if (typeof value === 'string' && value.length > 0) {
      out[key] = value;
    }
  }
  return Object.freeze(out);
}

export function correlateTrace(span: SpanRecord, refs: SafeCorrelationRefs): SpanRecord {
  const safe = safeCorrelationRefs(refs);
  return Object.freeze({
    ...span,
    attributes: Object.freeze({
      ...span.attributes,
      ...safe,
    }),
  });
}

export function buildAuthorityLineage(input: {
  readonly requestId: string;
  readonly intentId: string;
  readonly kernelDecision: string;
  readonly executionAuthorityRef: string;
  readonly mutationRef: string;
  readonly evidenceId: string;
  readonly eventId: string;
  readonly providerSubmissionRef?: string;
}): AuthorityLineage {
  const lineage: AuthorityLineage = {
    readOnly: true,
    canIssueOrRenewAuthority: false,
    requestId: input.requestId,
    intentId: input.intentId,
    kernelDecision: input.kernelDecision,
    executionAuthorityRef: input.executionAuthorityRef,
    mutationRef: input.mutationRef,
    evidenceId: input.evidenceId,
    eventId: input.eventId,
    ...(input.providerSubmissionRef !== undefined ? { providerSubmissionRef: input.providerSubmissionRef } : {}),
    steps: [
      'REQUEST',
      'ACTION_INTENT',
      'KERNEL_DECISION',
      'EXECUTION_AUTHORITY_REF',
      'LEDGER_OR_DOMAIN_MUTATION',
      'EVIDENCE_VAULT_REF',
      'EVENT',
      ...(input.providerSubmissionRef !== undefined ? (['EXTERNAL_SUBMISSION'] as const) : []),
    ],
  };
  return Object.freeze(lineage);
}
