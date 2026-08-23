import { randomUUID } from 'node:crypto';

import type { UtcInstant } from '../../../domain/src/time.ts';
import { openComplianceCase, type ComplianceCase } from '../compliance/cases.ts';
import {
  domainToSpecializedCaseType,
  type OperationalApproval,
  type OperationalCase,
  type OperationalCaseDomain,
  type OperationalCaseState,
  type OperationalFinding,
  type OperationalNote,
  type OperationalReference,
  type OperationalResolution,
  type OperationalSeverity,
  type OperationalSource,
  OPERATIONS_SCHEMA,
} from './types.ts';

const TERMINAL: readonly OperationalCaseState[] = ['RESOLVED', 'CLOSED'];

const ALLOWED_TRANSITIONS: Readonly<Record<OperationalCaseState, readonly OperationalCaseState[]>> = {
  OPEN: ['QUEUED', 'IN_REVIEW', 'ESCALATED', 'CLOSED'],
  QUEUED: ['IN_REVIEW', 'ACTION_REQUIRED', 'AWAITING_CUSTOMER', 'AWAITING_PROVIDER', 'AWAITING_COMPLIANCE', 'ESCALATED'],
  IN_REVIEW: [
    'ACTION_REQUIRED',
    'AWAITING_CUSTOMER',
    'AWAITING_PROVIDER',
    'AWAITING_COMPLIANCE',
    'ESCALATED',
    'RESOLVED',
  ],
  ACTION_REQUIRED: ['IN_REVIEW', 'AWAITING_CUSTOMER', 'AWAITING_PROVIDER', 'AWAITING_COMPLIANCE', 'ESCALATED'],
  AWAITING_CUSTOMER: ['IN_REVIEW', 'ACTION_REQUIRED', 'ESCALATED', 'RESOLVED'],
  AWAITING_PROVIDER: ['IN_REVIEW', 'ACTION_REQUIRED', 'ESCALATED', 'RESOLVED'],
  AWAITING_COMPLIANCE: ['IN_REVIEW', 'ESCALATED', 'RESOLVED'],
  ESCALATED: ['IN_REVIEW', 'RESOLVED', 'CLOSED'],
  RESOLVED: ['CLOSED'],
  CLOSED: [],
};

export type CaseMutationResult =
  | { readonly ok: true; readonly case: OperationalCase }
  | { readonly ok: false; readonly code: string; readonly message: string };

export function openOperationalCase(input: {
  readonly domain: OperationalCaseDomain;
  readonly type: string;
  readonly subject: string;
  readonly severity: OperationalSeverity;
  readonly source: OperationalSource;
  readonly references?: readonly OperationalReference[];
  readonly findings?: readonly OperationalFinding[];
  readonly queue?: string;
  readonly slaDueAt?: UtcInstant | null;
  readonly createdAt: UtcInstant;
  readonly specialized?: ComplianceCase;
}): { readonly operational: OperationalCase; readonly specialized: ComplianceCase | null } {
  const specializedType = domainToSpecializedCaseType(input.domain);
  const specialized =
    input.specialized ??
    (specializedType
      ? openComplianceCase({
          caseType: specializedType,
          reasonCodes: ['OPERATIONS_CONTROL_PLANE'],
          originRefs: [input.subject],
          subjectRef: input.subject,
          jurisdiction: 'GB',
          createdAt: input.createdAt,
        })
      : null);
  const operational: OperationalCase = Object.freeze({
    schema: OPERATIONS_SCHEMA,
    caseId: randomUUID(),
    domain: input.domain,
    type: input.type,
    subject: input.subject,
    severity: input.severity,
    status: 'OPEN',
    source: input.source,
    findings: Object.freeze([...(input.findings ?? [])]),
    references: Object.freeze([
      ...(input.references ?? []),
      ...(specialized
        ? [{ kind: 'compliance_case' as const, id: specialized.caseId }]
        : []),
    ]),
    owner: null,
    queue: input.queue ?? defaultQueue(input.domain),
    createdAt: input.createdAt,
    updatedAt: input.createdAt,
    sla: Object.freeze({
      policyId: input.slaDueAt ? `sla:${input.domain}` : null,
      dueAt: input.slaDueAt ?? null,
      breached: false,
    }),
    evidenceRefs: Object.freeze([]),
    resolution: null,
    approvals: Object.freeze([]),
    notes: Object.freeze([]),
    specializedCaseId: specialized?.caseId ?? null,
    specializedCaseType: specialized?.caseType ?? null,
    investigatorId: null,
  });
  return { operational, specialized };
}

export function defaultQueue(domain: OperationalCaseDomain): string {
  switch (domain) {
    case 'KYC':
    case 'KYB':
    case 'AML':
    case 'SANCTIONS':
    case 'TRAVEL_RULE':
      return 'compliance';
    case 'FRAUD':
      return 'fraud';
    case 'PAYMENT':
      return 'payments';
    case 'TREASURY':
      return 'treasury';
    case 'RECONCILIATION':
      return 'reconciliation';
    case 'EXCHANGE_SURVEILLANCE':
      return 'surveillance';
    case 'CUSTODY':
      return 'custody';
    case 'AGENT':
      return 'agent';
    case 'SECURITY':
      return 'security';
    case 'PROVIDER':
      return 'provider';
    case 'DATA_RIGHTS':
      return 'data-rights';
    case 'CUSTOMER_SUPPORT':
      return 'support';
    default:
      return 'general';
  }
}

export function assignOperationalCase(
  current: OperationalCase,
  owner: string,
  now: UtcInstant,
): CaseMutationResult {
  if (TERMINAL.includes(current.status)) {
    return { ok: false, code: 'CASE_TERMINAL', message: 'terminal cases cannot be assigned' };
  }
  const nextStatus: OperationalCaseState = current.status === 'OPEN' ? 'QUEUED' : current.status;
  return {
    ok: true,
    case: Object.freeze({
      ...current,
      owner,
      investigatorId: current.investigatorId ?? owner,
      status: nextStatus,
      updatedAt: now,
    }),
  };
}

export function transitionOperationalCase(
  current: OperationalCase,
  next: OperationalCaseState,
  now: UtcInstant,
): CaseMutationResult {
  if (current.status === next) {
    return { ok: true, case: current };
  }
  const allowed = ALLOWED_TRANSITIONS[current.status];
  if (!allowed.includes(next)) {
    return {
      ok: false,
      code: 'INVALID_TRANSITION',
      message: `cannot transition ${current.status} to ${next}`,
    };
  }
  return {
    ok: true,
    case: Object.freeze({
      ...current,
      status: next,
      updatedAt: now,
    }),
  };
}

export function addFinding(current: OperationalCase, finding: OperationalFinding, now: UtcInstant): OperationalCase {
  return Object.freeze({
    ...current,
    findings: Object.freeze([...current.findings, finding]),
    updatedAt: now,
  });
}

export function addNote(current: OperationalCase, note: OperationalNote, now: UtcInstant): OperationalCase {
  return Object.freeze({
    ...current,
    notes: Object.freeze([...current.notes, note]),
    updatedAt: now,
  });
}

export function addEvidence(current: OperationalCase, evidenceId: string, now: UtcInstant): OperationalCase {
  return Object.freeze({
    ...current,
    evidenceRefs: Object.freeze([...current.evidenceRefs, evidenceId]),
    updatedAt: now,
  });
}

export function addApproval(current: OperationalCase, approval: OperationalApproval, now: UtcInstant): OperationalCase {
  return Object.freeze({
    ...current,
    approvals: Object.freeze([...current.approvals, approval]),
    updatedAt: now,
  });
}

export function resolveOperationalCase(
  current: OperationalCase,
  resolution: OperationalResolution,
  now: UtcInstant,
): CaseMutationResult {
  if (TERMINAL.includes(current.status) && current.status === 'CLOSED') {
    return { ok: false, code: 'CASE_TERMINAL', message: 'closed cases cannot be resolved' };
  }
  if (current.status !== 'ESCALATED' && current.status !== 'IN_REVIEW' && current.status !== 'AWAITING_COMPLIANCE') {
    const transitioned = transitionOperationalCase(current, 'RESOLVED', now);
    if (!transitioned.ok) {
      return transitioned;
    }
    return {
      ok: true,
      case: Object.freeze({
        ...transitioned.case,
        status: 'RESOLVED',
        resolution,
        updatedAt: now,
      }),
    };
  }
  return {
    ok: true,
    case: Object.freeze({
      ...current,
      status: 'RESOLVED',
      resolution,
      updatedAt: now,
    }),
  };
}
