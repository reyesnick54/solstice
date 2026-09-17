import type { EvidenceVault } from '@solstice/evidence';
import type { MetaAllocationDecision, MetaAllocationRunResult } from './types.ts';

export function sealMetaAllocatorDecision(
  vault: EvidenceVault | undefined,
  decision: MetaAllocationDecision,
): string | null {
  if (!vault) {
    return null;
  }
  const sealed = vault.seal('HELIOS_META_ALLOCATOR_DECISION', {
    decisionId: decision.decisionId,
    candidateId: decision.candidateId,
    disposition: decision.disposition,
    policyVersion: decision.policyVersion,
    grantsFinancialEffect: false,
    postsReservation: false,
    reasonCodes: decision.reasonCodes,
    budgetStateRef: decision.budgetStateRef,
    accountStateRef: decision.accountStateRef.stateVersion,
  });
  return sealed?.evidenceId ?? null;
}

export function sealMetaAllocatorRun(
  vault: EvidenceVault | undefined,
  run: MetaAllocationRunResult,
): string | null {
  if (!vault) {
    return null;
  }
  const sealed = vault.seal('HELIOS_META_ALLOCATOR_RUN', {
    runId: run.runId,
    workOrderId: run.workOrderId,
    holdCash: run.holdCash,
    unallocatedCashMinor: run.unallocatedCashMinor,
    grantsFinancialEffect: false,
    policyVersion: run.policyVersion,
  });
  return sealed?.evidenceId ?? null;
}
