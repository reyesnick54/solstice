import type { GrowAuditEventKind } from './taxonomy.ts';
import type { GrowEvidenceTrace } from '../types.ts';

export type GrowAuditEvent = {
  readonly kind: GrowAuditEventKind;
  readonly occurredAt: string;
  readonly subjectId?: string;
  readonly proposalId?: string;
  readonly proposalVersion?: number;
  readonly executionId?: string;
  readonly trace: GrowEvidenceTrace;
};

export function growAuditEvent(
  kind: GrowAuditEventKind,
  occurredAt: string,
  trace: GrowEvidenceTrace,
  ids: {
    readonly subjectId?: string;
    readonly proposalId?: string;
    readonly proposalVersion?: number;
    readonly executionId?: string;
  } = {},
): GrowAuditEvent {
  return Object.freeze({
    kind,
    occurredAt,
    ...ids,
    trace,
  });
}

export const GROW_AUDIT_EVENT_TO_EVIDENCE_KIND: Readonly<Partial<Record<GrowAuditEventKind, string>>> = Object.freeze({
  proposal_created: 'GROW_PROPOSAL_GENERATED',
  proposal_authorized: 'GROW_PROPOSAL_APPROVED',
  execution_submitted: 'GROW_EXECUTION_TRANSITION',
  execution_confirmed: 'GROW_EXECUTION_TRANSITION',
  execution_failed: 'GROW_EXECUTION_TRANSITION',
  portfolio_monitored: 'GROW_MONITORING',
  mandate_revoked: 'GROW_MANDATE_REVOKED',
});
