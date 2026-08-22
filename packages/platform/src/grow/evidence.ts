import type { EvidenceVault } from '../../../evidence/src/vault.ts';
import type { GrowEvidenceTrace } from './types.ts';

export function sealGrowEvidence(vault: EvidenceVault | undefined, kind: string, trace: GrowEvidenceTrace): void {
  vault?.seal(kind, {
    pegSnapshotId: trace.pegSnapshotId,
    opportunityIds: trace.opportunityIds,
    planId: trace.planId,
    proposalId: trace.proposalId,
    proposalVersion: trace.proposalVersion,
    suitability: trace.suitability,
    policyDecision: trace.policyDecision,
    approvalId: trace.approvalId,
    stepUpSatisfied: trace.stepUpSatisfied,
    executionAuthorityId: trace.executionAuthorityId,
    providerId: trace.providerId,
    providerResult: trace.providerResult,
    ledgerJournalId: trace.ledgerJournalId,
    custodyRef: trace.custodyRef,
    settlementRef: trace.settlementRef,
    performanceResult: trace.performanceResult,
  });
}

export function emptyTrace(): GrowEvidenceTrace {
  return Object.freeze({
    pegSnapshotId: null,
    opportunityIds: Object.freeze([]),
    planId: null,
    proposalId: null,
    proposalVersion: null,
    suitability: null,
    policyDecision: null,
    approvalId: null,
    stepUpSatisfied: null,
    executionAuthorityId: null,
    providerId: null,
    providerResult: null,
    ledgerJournalId: null,
    custodyRef: null,
    settlementRef: null,
    performanceResult: null,
  });
}
