import { newChainWriteIntentId } from '../ids.ts';
import { ACCESS_FABRIC_INVARIANTS, ACCESS_WORKFLOW_TO_CHAIN_RECORD } from './policy.ts';
import type { AccessWorkflowEvent } from './types.ts';

export type PrivacySafeChainAnchor = {
  readonly intentId: string;
  readonly recordType: (typeof ACCESS_WORKFLOW_TO_CHAIN_RECORD)[AccessWorkflowEvent];
  readonly payloadCommitment: string;
  readonly subjectRef: string;
  readonly sessionRef: string;
  readonly event: AccessWorkflowEvent;
  readonly privateFieldsExcluded: true;
};

export type AccessChainIntentProjection = {
  readonly intentId: string;
  readonly recordType: PrivacySafeChainAnchor['recordType'];
  readonly payloadCommitment: string;
  readonly subjectRef: string;
  readonly sessionRef: string;
  readonly event: AccessWorkflowEvent;
  readonly dataClass: 'ON_CHAIN_SAFE';
  readonly sourceSubsystem: 'evidence';
  readonly economicValueMovement: false;
};

export function createAccessChainAnchor(input: {
  readonly event: AccessWorkflowEvent;
  readonly payloadCommitment: string;
  readonly subjectRef: string;
  readonly sessionId: string;
}): PrivacySafeChainAnchor {
  return Object.freeze({
    intentId: newChainWriteIntentId(),
    recordType: ACCESS_WORKFLOW_TO_CHAIN_RECORD[input.event],
    payloadCommitment: input.payloadCommitment,
    subjectRef: input.subjectRef,
    sessionRef: input.sessionId,
    event: input.event,
    privateFieldsExcluded: true,
  });
}

export function toChainIntentProjection(anchor: PrivacySafeChainAnchor): AccessChainIntentProjection {
  return Object.freeze({
    intentId: anchor.intentId,
    recordType: anchor.recordType,
    payloadCommitment: anchor.payloadCommitment,
    subjectRef: anchor.subjectRef,
    sessionRef: anchor.sessionRef,
    event: anchor.event,
    dataClass: 'ON_CHAIN_SAFE',
    sourceSubsystem: 'evidence',
    economicValueMovement: false,
  });
}

export function publicAnchorFields(anchor: PrivacySafeChainAnchor): Readonly<Record<string, string | boolean>> {
  return Object.freeze({
    intentId: anchor.intentId,
    recordType: anchor.recordType,
    payloadCommitment: anchor.payloadCommitment,
    subjectRef: anchor.subjectRef,
    sessionRef: anchor.sessionRef,
    event: anchor.event,
    privateFieldsExcluded: anchor.privateFieldsExcluded,
    anchorIsCompletionEvidence: ACCESS_FABRIC_INVARIANTS.CHAIN_ANCHOR_IS_COMPLETION_EVIDENCE,
    transfersOwnership: ACCESS_FABRIC_INVARIANTS.CHAIN_ANCHOR_TRANSFERS_OWNERSHIP,
  });
}
