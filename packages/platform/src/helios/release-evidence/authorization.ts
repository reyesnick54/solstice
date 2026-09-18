/**
 * HELIOS H36 — human live-pilot authorization record (AI cannot sign).
 */

import type { UtcInstant } from '../../../../domain/src/time.ts';
import { livePilotAuthorizationIdFor } from './ids.ts';
import type {
  ExternalEvidenceRef,
  GovernanceApproverRecord,
  LivePilotAuthorization,
  LivePilotScope,
} from './types.ts';
import type { HeliosReleaseId } from './ids.ts';

export function buildLivePilotAuthorization(input: {
  readonly seed: string;
  readonly pilotScope: LivePilotScope;
  readonly releaseId: HeliosReleaseId;
  readonly releaseGitSha: string;
  readonly externalGateStatus: string;
  readonly approvers: readonly GovernanceApproverRecord[];
  readonly approvedAt: UtcInstant;
  readonly effectiveFrom: UtcInstant;
  readonly expiresAt: UtcInstant;
  readonly evidenceRefs: readonly ExternalEvidenceRef[];
  readonly abortConditions: LivePilotAuthorization['abortConditions'];
}): LivePilotAuthorization {
  if (input.approvers.length === 0) {
    throw new TypeError('LivePilotAuthorization requires at least one governance approver');
  }
  for (const approver of input.approvers) {
    if (!approver.approvalRecordRef.startsWith('human-approval:')) {
      throw new TypeError('approver record must reference external human approval evidence');
    }
  }

  return Object.freeze({
    schema: 'sunrey.helios.live-pilot-authorization.v1',
    authorizationId: livePilotAuthorizationIdFor(input.seed),
    pilotScope: input.pilotScope,
    releaseId: input.releaseId,
    releaseGitSha: input.releaseGitSha,
    externalGateStatus: input.externalGateStatus,
    approvers: Object.freeze([...input.approvers]),
    approvedAt: input.approvedAt,
    effectiveFrom: input.effectiveFrom,
    expiresAt: input.expiresAt,
    capitalCeilingMinor: input.pilotScope.maximumCapitalMinor,
    customerScope: Object.freeze([...input.pilotScope.customers]),
    providerScope: Object.freeze([input.pilotScope.provider]),
    jurisdiction: input.pilotScope.jurisdiction,
    allowedStrategyCapsules: Object.freeze([...input.pilotScope.strategyCapsuleIds]),
    abortConditions: Object.freeze([...input.abortConditions]),
    evidenceRefs: Object.freeze([...input.evidenceRefs]),
    aiSigned: false as const,
    activatesLiveConnectivity: false as const,
  });
}

export function refuseAiAuthorization(actorKind: 'AI' | 'HUMAN' | 'SERVICE'): void {
  if (actorKind === 'AI') {
    throw new TypeError('AI cannot sign LivePilotAuthorization');
  }
}
