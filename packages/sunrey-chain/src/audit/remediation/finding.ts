import { recordTransition } from './chain.ts';
import { assertNoSilentDowngrade } from './severity.ts';
import { isAffectedSurface } from './surfaces.ts';
import {
  FINDING_STATES,
  TEST_FIXTURE_NOT_EXTERNAL_AUDIT,
  type ActorKind,
  type DisclosureClass,
  type ExternalSecurityFinding,
  type FindingEvidenceChainRecord,
  type FindingSeverity,
  type FindingState,
} from './types.ts';

const ALLOWED: Readonly<Record<FindingState, readonly FindingState[]>> = {
  RECEIVED: ['TRIAGED', 'SUPERSEDED'],
  TRIAGED: ['REPRODUCED', 'NOT_REPRODUCIBLE_WITH_EVIDENCE', 'REMEDIATION_IN_PROGRESS', 'ACCEPTED_RISK', 'SUPERSEDED'],
  REPRODUCED: ['REMEDIATION_IN_PROGRESS', 'ACCEPTED_RISK', 'SUPERSEDED'],
  REMEDIATION_IN_PROGRESS: ['REMEDIATED_PENDING_RETEST', 'ACCEPTED_RISK', 'SUPERSEDED'],
  REMEDIATED_PENDING_RETEST: ['EXTERNALLY_RETESTED', 'REMEDIATION_IN_PROGRESS', 'SUPERSEDED'],
  EXTERNALLY_RETESTED: ['SUPERSEDED'],
  ACCEPTED_RISK: ['SUPERSEDED', 'REMEDIATION_IN_PROGRESS'],
  NOT_REPRODUCIBLE_WITH_EVIDENCE: ['TRIAGED', 'SUPERSEDED'],
  SUPERSEDED: [],
};

const OPEN_STATES: readonly FindingState[] = [
  'RECEIVED',
  'TRIAGED',
  'REPRODUCED',
  'REMEDIATION_IN_PROGRESS',
  'REMEDIATED_PENDING_RETEST',
];

export function allowedFindingTransitions(from: FindingState): readonly FindingState[] {
  return ALLOWED[from];
}

export function findingStates(): readonly FindingState[] {
  return FINDING_STATES;
}

export function isOpenFinding(status: FindingState): boolean {
  return OPEN_STATES.includes(status);
}

export function receiveExternalFinding(input: {
  readonly findingId: string;
  readonly externalReviewId: string;
  readonly externalSeverity: string;
  readonly title: string;
  readonly affectedComponent: string;
  readonly affectedSurface: string;
  readonly affectedCommit: string;
  readonly affectedVersion?: string | null;
  readonly descriptionReference: string;
  readonly evidenceReference: string;
  readonly disclosureClass?: DisclosureClass;
  readonly providerSurfaceReference?: string | null;
  readonly fixture?: boolean;
}): { readonly finding: ExternalSecurityFinding; readonly chain: FindingEvidenceChainRecord } {
  if (!input.findingId.trim() || !input.externalReviewId.trim() || !input.title.trim()) {
    throw new Error('ExternalSecurityFinding requires finding id, review id, and title');
  }
  if (!input.externalSeverity.trim()) {
    throw new Error('external severity cannot be empty or silently dropped');
  }
  if (!isAffectedSurface(input.affectedSurface)) {
    throw new Error(`unknown affected surface ${input.affectedSurface}`);
  }
  const finding: ExternalSecurityFinding = Object.freeze({
    findingId: input.findingId,
    externalReviewId: input.externalReviewId,
    externalSeverity: input.externalSeverity,
    internalEngineeringSeverity: null,
    title: input.title,
    affectedComponent: input.affectedComponent,
    affectedSurface: input.affectedSurface,
    affectedCommit: input.affectedCommit,
    affectedVersion: input.affectedVersion ?? null,
    descriptionReference: input.descriptionReference,
    evidenceReference: input.evidenceReference,
    status: 'RECEIVED',
    remediationOwner: null,
    disclosureClass: input.disclosureClass ?? 'SECURITY_RESTRICTED',
    providerSurfaceReference: input.providerSurfaceReference ?? null,
    supersededBy: null,
    fixtureLabel: input.fixture ? TEST_FIXTURE_NOT_EXTERNAL_AUDIT : null,
  });
  return {
    finding,
    chain: recordTransition({
      findingId: finding.findingId,
      actor: 'SYSTEM',
      actorReference: 'ingest',
      timestampUtc: '1970-01-01T00:00:00Z',
      sourceState: null,
      destinationState: 'RECEIVED',
      evidenceReference: finding.evidenceReference,
      commitReference: finding.affectedCommit,
      signatureHex: null,
    }),
  };
}

export function applyExternalFindingTransition(
  finding: ExternalSecurityFinding,
  input: {
    readonly from: FindingState;
    readonly to: FindingState;
    readonly actor: ActorKind;
    readonly actorReference: string;
    readonly timestampUtc: string;
    readonly evidenceReference: string;
    readonly commitReference: string;
    readonly signatureHex?: string | null;
    readonly humanApprovalReference?: string | null;
    readonly internalEngineeringSeverity?: FindingSeverity | null;
    readonly remediationOwner?: string | null;
    readonly supersededBy?: string | null;
  },
): { readonly finding: ExternalSecurityFinding; readonly chain: FindingEvidenceChainRecord } {
  if (finding.status !== input.from) {
    throw new Error(`finding ${finding.findingId} is ${finding.status}, not ${input.from}`);
  }
  if (!ALLOWED[input.from].includes(input.to)) {
    throw new Error(`illegal finding transition ${input.from} -> ${input.to}`);
  }
  if (input.to === 'EXTERNALLY_RETESTED' && input.actor === 'AI') {
    throw new Error('AI cannot assign EXTERNALLY_RETESTED');
  }
  if (input.to === 'EXTERNALLY_RETESTED' && input.actor !== 'HUMAN') {
    throw new Error('EXTERNALLY_RETESTED requires a HUMAN actor and human evidence verification');
  }
  if (input.to === 'ACCEPTED_RISK' && input.actor !== 'HUMAN') {
    throw new Error('AI cannot accept security risk');
  }
  if (input.to === 'ACCEPTED_RISK' && !input.humanApprovalReference?.trim()) {
    throw new Error('ACCEPTED_RISK requires a human security authority reference');
  }
  if (input.internalEngineeringSeverity !== undefined) {
    assertNoSilentDowngrade(finding.externalSeverity, input.internalEngineeringSeverity);
  }
  const next: ExternalSecurityFinding = Object.freeze({
    ...finding,
    status: input.to,
    externalSeverity: finding.externalSeverity,
    internalEngineeringSeverity: input.internalEngineeringSeverity === undefined
      ? finding.internalEngineeringSeverity
      : input.internalEngineeringSeverity,
    remediationOwner: input.remediationOwner === undefined
      ? finding.remediationOwner
      : input.remediationOwner,
    supersededBy: input.supersededBy === undefined ? finding.supersededBy : input.supersededBy,
  });
  return {
    finding: next,
    chain: recordTransition({
      findingId: finding.findingId,
      actor: input.actor,
      actorReference: input.actorReference,
      timestampUtc: input.timestampUtc,
      sourceState: input.from,
      destinationState: input.to,
      evidenceReference: input.evidenceReference,
      commitReference: input.commitReference,
      signatureHex: input.signatureHex ?? null,
    }),
  };
}
