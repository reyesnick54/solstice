/**
 * Capability resumption is independently authorized.
 * Incident resolution and restriction expiry do not auto-resume.
 * AI may recommend only.
 */

import { reviewEmergencyRestriction } from '../engine.ts';
import type {
  EmergencyActionClass,
  EmergencyActionRecord,
  GovernanceApprovalRecord,
  GovernanceOpsActorKind,
} from '../types.ts';
import type { IndependentCapability } from '../../post-genesis/types.ts';
import type { CapabilityResumptionCandidate, EmergencyRecommendation, ResumptionState } from './types.ts';

export function recommendEmergencyAction(input: {
  readonly recommendationId: string;
  readonly summary: string;
  readonly recommendedClasses: readonly EmergencyActionClass[];
}): EmergencyRecommendation {
  return Object.freeze({
    recommendationId: input.recommendationId,
    actorKind: 'AI',
    summary: input.summary,
    recommendedClasses: Object.freeze([...input.recommendedClasses]),
    mayActivateEmergencyAuthority: false,
    mayResumeCapability: false,
    mayRewriteBalance: false,
    mayMint: false,
    maySignGovernanceAction: false,
  });
}

export function refuseAiEmergencyApproval(actorKind: GovernanceOpsActorKind): {
  readonly accepted: false;
  readonly rejectionReason: 'AI_CANNOT_AUTHORIZE';
} | { readonly accepted: true; readonly rejectionReason: null } {
  if (actorKind !== 'HUMAN') {
    return Object.freeze({ accepted: false, rejectionReason: 'AI_CANNOT_AUTHORIZE' });
  }
  return Object.freeze({ accepted: true, rejectionReason: null });
}

export function assembleResumptionCandidate(input: {
  readonly candidateId: string;
  readonly capability: IndependentCapability;
  readonly incidentId: string;
  readonly restriction: EmergencyActionRecord;
  readonly rootCauseAddressed: boolean;
  readonly reconciliationClean: boolean;
  readonly providerEvidenceCurrent: boolean;
  readonly securityReviewComplete: boolean;
  readonly controlRoomHealthy: boolean;
  readonly humanApproval?: string | null;
  readonly incidentResolved?: boolean;
}): CapabilityResumptionCandidate {
  const gates =
    input.rootCauseAddressed &&
    input.reconciliationClean &&
    input.providerEvidenceCurrent &&
    input.securityReviewComplete &&
    input.controlRoomHealthy;
  const state: ResumptionState = !gates
    ? 'INELIGIBLE'
    : input.humanApproval
      ? 'AUTHORIZED'
      : 'CANDIDATE';
  const authorized = state === 'AUTHORIZED';
  return Object.freeze({
    candidateId: input.candidateId,
    capability: input.capability,
    incidentId: input.incidentId,
    restriction: input.restriction,
    rootCauseAddressed: input.rootCauseAddressed,
    reconciliationClean: input.reconciliationClean,
    providerEvidenceCurrent: input.providerEvidenceCurrent,
    securityReviewComplete: input.securityReviewComplete,
    controlRoomHealthy: input.controlRoomHealthy,
    humanApproval: input.humanApproval ?? null,
    incidentResolved: input.incidentResolved === true,
    state,
    runtimeEnabled: authorized,
    incidentEndAutoResumed: false,
    aiAuthorized: false,
    productionActive: false,
  });
}

export function expireRestrictionWithoutResume(action: EmergencyActionRecord, height: number): EmergencyActionRecord {
  return reviewEmergencyRestriction({
    action,
    height,
    resumeApprovals: [],
    actorKind: 'AI',
  });
}

export function authorizeHumanResumption(input: {
  readonly action: EmergencyActionRecord;
  readonly height: number;
  readonly approvals: readonly GovernanceApprovalRecord[];
}): EmergencyActionRecord {
  return reviewEmergencyRestriction({
    action: input.action,
    height: input.height,
    resumeApprovals: input.approvals,
    actorKind: 'HUMAN',
  });
}
