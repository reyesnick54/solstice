import type { UtcInstant } from '../../../domain/src/time.ts';
import type { CaseType } from '../compliance/types.ts';

export const OPERATIONS_CAPABILITY = 'sunrey-operations-control-plane' as const;
export const OPERATIONS_SCHEMA = 'sunrey.operations.control-plane.v1' as const;

export const OPERATIONAL_CASE_DOMAINS = [
  'KYC',
  'KYB',
  'AML',
  'SANCTIONS',
  'FRAUD',
  'PAYMENT',
  'TREASURY',
  'RECONCILIATION',
  'EXCHANGE_SURVEILLANCE',
  'CUSTODY',
  'TRAVEL_RULE',
  'AGENT',
  'SECURITY',
  'DATA_RIGHTS',
  'PROVIDER',
  'CUSTOMER_SUPPORT',
] as const;
export type OperationalCaseDomain = (typeof OPERATIONAL_CASE_DOMAINS)[number];

export const OPERATIONAL_CASE_STATES = [
  'OPEN',
  'QUEUED',
  'IN_REVIEW',
  'ACTION_REQUIRED',
  'AWAITING_CUSTOMER',
  'AWAITING_PROVIDER',
  'AWAITING_COMPLIANCE',
  'ESCALATED',
  'RESOLVED',
  'CLOSED',
] as const;
export type OperationalCaseState = (typeof OPERATIONAL_CASE_STATES)[number];

export const OPERATIONAL_SEVERITIES = ['INFO', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;
export type OperationalSeverity = (typeof OPERATIONAL_SEVERITIES)[number];

export const OPERATIONAL_SOURCES = [
  'SYSTEM',
  'PROVIDER',
  'OPERATOR',
  'CUSTOMER',
  'AGENT',
  'SURVEILLANCE',
  'RECONCILIATION',
  'SECURITY',
] as const;
export type OperationalSource = (typeof OPERATIONAL_SOURCES)[number];

export type OperationalSla = {
  readonly policyId: string | null;
  readonly dueAt: UtcInstant | null;
  readonly breached: boolean;
};

export type OperationalFinding = {
  readonly findingId: string;
  readonly kind: string;
  readonly summary: string;
  readonly providerId: string | null;
  readonly providerRef: string | null;
  readonly provenance: string;
  readonly evidenceRefs: readonly string[];
  readonly isKernelDecision: false;
  readonly observedAt: UtcInstant;
};

export type OperationalReference = {
  readonly kind:
    | 'customer'
    | 'account'
    | 'payment'
    | 'transaction'
    | 'order'
    | 'wallet'
    | 'provider'
    | 'correlation'
    | 'compliance_case'
    | 'ledger'
    | 'exchange'
    | 'agent'
    | 'security';
  readonly id: string;
};

export type OperationalApproval = {
  readonly approvalId: string;
  readonly action: string;
  readonly requesterId: string;
  readonly approverId: string | null;
  readonly status: 'PENDING' | 'APPROVED' | 'REJECTED';
  readonly reason: string;
  readonly createdAt: UtcInstant;
  readonly decidedAt: UtcInstant | null;
};

export type OperationalResolution = {
  readonly outcome: string;
  readonly summary: string;
  readonly decidedBy: string;
  readonly decidedAt: UtcInstant;
  readonly evidenceRefs: readonly string[];
};

export type OperationalNote = {
  readonly noteId: string;
  readonly authorId: string;
  readonly body: string;
  readonly createdAt: UtcInstant;
  readonly redacted: false;
};

export type OperationalCase = {
  readonly schema: typeof OPERATIONS_SCHEMA;
  readonly caseId: string;
  readonly domain: OperationalCaseDomain;
  readonly type: string;
  readonly subject: string;
  readonly severity: OperationalSeverity;
  readonly status: OperationalCaseState;
  readonly source: OperationalSource;
  readonly findings: readonly OperationalFinding[];
  readonly references: readonly OperationalReference[];
  readonly owner: string | null;
  readonly queue: string;
  readonly createdAt: UtcInstant;
  readonly updatedAt: UtcInstant;
  readonly sla: OperationalSla;
  readonly evidenceRefs: readonly string[];
  readonly resolution: OperationalResolution | null;
  readonly approvals: readonly OperationalApproval[];
  readonly notes: readonly OperationalNote[];
  readonly specializedCaseId: string | null;
  readonly specializedCaseType: CaseType | null;
  readonly investigatorId: string | null;
};

export type OperatorActionRecord = {
  readonly actionId: string;
  readonly operatorId: string;
  readonly roles: readonly string[];
  readonly action: string;
  readonly reason: string;
  readonly caseId: string | null;
  readonly subjectRef: string | null;
  readonly stepUpSatisfied: boolean;
  readonly dualControlSatisfied: boolean;
  readonly secondApproverId: string | null;
  readonly evidenceId: string;
  readonly eventType: string;
  readonly createdAt: UtcInstant;
  readonly outcome: 'APPLIED' | 'PENDING_APPROVAL' | 'DENIED';
  readonly denialCode: string | null;
};

export type SupportViewSession = {
  readonly sessionId: string;
  readonly operatorId: string;
  readonly customerId: string;
  readonly readLimited: true;
  readonly audited: true;
  readonly canApproveFinancialActions: false;
  readonly expiresAt: UtcInstant;
  readonly openedAt: UtcInstant;
  readonly evidenceId: string;
};

export type OperationsSearchQuery = {
  readonly caseId?: string;
  readonly customerId?: string;
  readonly paymentId?: string;
  readonly transactionId?: string;
  readonly orderId?: string;
  readonly walletId?: string;
  readonly providerReference?: string;
  readonly correlationId?: string;
};

export type TimelineEntry = {
  readonly at: UtcInstant;
  readonly kind:
    | 'request'
    | 'case'
    | 'policy'
    | 'operator'
    | 'provider'
    | 'ledger'
    | 'exchange'
    | 'agent'
    | 'security'
    | 'resolution';
  readonly ref: string;
  readonly summary: string;
  readonly evidenceId: string | null;
};

export function isOperationalCaseDomain(value: unknown): value is OperationalCaseDomain {
  return typeof value === 'string' && (OPERATIONAL_CASE_DOMAINS as readonly string[]).includes(value);
}

export function isOperationalCaseState(value: unknown): value is OperationalCaseState {
  return typeof value === 'string' && (OPERATIONAL_CASE_STATES as readonly string[]).includes(value);
}

export function domainToSpecializedCaseType(domain: OperationalCaseDomain): CaseType | null {
  switch (domain) {
    case 'SANCTIONS':
      return 'SANCTIONS_REVIEW';
    case 'AML':
      return 'AML_ALERT';
    case 'FRAUD':
      return 'FRAUD_ALERT';
    case 'KYC':
    case 'KYB':
    case 'TRAVEL_RULE':
      return 'TRANSACTION_MONITORING_ALERT';
    default:
      return null;
  }
}

export function specializedStateToOperational(
  status: string,
): OperationalCaseState {
  switch (status) {
    case 'OPEN':
      return 'OPEN';
    case 'ASSIGNED':
      return 'QUEUED';
    case 'IN_REVIEW':
      return 'IN_REVIEW';
    case 'ESCALATED':
      return 'ESCALATED';
    case 'CLEARED':
      return 'RESOLVED';
    case 'BLOCKED':
      return 'CLOSED';
    case 'CLOSED':
      return 'CLOSED';
    default:
      return 'OPEN';
  }
}
