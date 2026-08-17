import type {
  ActorKind,
  ExternalReviewFinding,
  FindingLifecycleStatus,
  FindingTransition,
  InternalSeverity,
} from './types.ts';
import { FINDING_LIFECYCLE } from './types.ts';

const ALLOWED: Readonly<Record<FindingLifecycleStatus, readonly FindingLifecycleStatus[]>> = {
  RECEIVED: ['TRIAGED'],
  TRIAGED: ['REMEDIATION_IN_PROGRESS', 'ACCEPTED_RISK_WITH_HUMAN_APPROVAL'],
  REMEDIATION_IN_PROGRESS: ['READY_FOR_RETEST', 'ACCEPTED_RISK_WITH_HUMAN_APPROVAL'],
  READY_FOR_RETEST: ['VERIFIED_RESOLVED', 'REMEDIATION_IN_PROGRESS'],
  VERIFIED_RESOLVED: [],
  ACCEPTED_RISK_WITH_HUMAN_APPROVAL: [],
};

export function allowedTransitions(from: FindingLifecycleStatus): readonly FindingLifecycleStatus[] {
  return ALLOWED[from];
}

export function receiveFinding(input: {
  readonly finding_id: string;
  readonly reviewer_reference: string;
  readonly title: string;
  readonly description: string;
  readonly affected_component: string;
  readonly reviewer_severity: string;
}): ExternalReviewFinding {
  return Object.freeze({
    finding_id: input.finding_id,
    reviewer_reference: input.reviewer_reference,
    title: input.title,
    description: input.description,
    affected_component: input.affected_component,
    reviewer_severity: input.reviewer_severity,
    sunrey_triage_status: 'RECEIVED',
    remediation_reference: null,
    verification_evidence: null,
    resolution_status: 'RECEIVED',
    internal_severity: null,
  });
}

export function applyFindingTransition(
  finding: ExternalReviewFinding,
  transition: FindingTransition,
  patch: {
    readonly remediation_reference?: string | null;
    readonly verification_evidence?: string | null;
    readonly internal_severity?: InternalSeverity | null;
  } = {},
): ExternalReviewFinding {
  if (finding.resolution_status !== transition.from) {
    throw new Error(`finding ${finding.finding_id} is ${finding.resolution_status}, not ${transition.from}`);
  }
  if (!ALLOWED[transition.from].includes(transition.to)) {
    throw new Error(`illegal transition ${transition.from} -> ${transition.to}`);
  }
  if (transition.to === 'VERIFIED_RESOLVED' && transition.actor === 'AI') {
    throw new Error('AI cannot mark an independent finding VERIFIED_RESOLVED');
  }
  if (transition.to === 'ACCEPTED_RISK_WITH_HUMAN_APPROVAL' && !transition.humanApprovalReference) {
    throw new Error('ACCEPTED_RISK_WITH_HUMAN_APPROVAL requires a human approval reference');
  }
  if (transition.to === 'VERIFIED_RESOLVED' && transition.actor !== 'HUMAN') {
    throw new Error('VERIFIED_RESOLVED requires a HUMAN actor');
  }
  return Object.freeze({
    ...finding,
    sunrey_triage_status: transition.to,
    resolution_status: transition.to,
    remediation_reference: patch.remediation_reference === undefined
      ? finding.remediation_reference
      : patch.remediation_reference,
    verification_evidence: patch.verification_evidence === undefined
      ? finding.verification_evidence
      : patch.verification_evidence,
    internal_severity: patch.internal_severity === undefined
      ? finding.internal_severity
      : patch.internal_severity,
    reviewer_severity: finding.reviewer_severity,
  });
}

export function reviewerSeverityPreserved(
  before: ExternalReviewFinding,
  after: ExternalReviewFinding,
): boolean {
  return before.reviewer_severity === after.reviewer_severity;
}

export function actorMayResolve(actor: ActorKind): boolean {
  return actor === 'HUMAN';
}

export function lifecycleStates(): readonly FindingLifecycleStatus[] {
  return FINDING_LIFECYCLE;
}
