import type { EvidenceVault } from '../../../../evidence/src/vault.ts';
import type { GrowSandboxAllocation } from './types.ts';

export function sealAllocationEvidence(
  evidence: EvidenceVault,
  event: string,
  allocation: GrowSandboxAllocation,
  extra: Record<string, unknown> = {},
): void {
  evidence.seal(event, {
    allocationId: allocation.allocationId,
    workOrderId: allocation.workOrderId,
    customerId: allocation.customerId,
    accountId: allocation.accountId,
    currency: allocation.currency,
    executionMode: allocation.executionMode,
    environment: allocation.environment,
    requestedAmountMinorUnits: allocation.requestedAmountMinorUnits,
    acceptedAmountMinorUnits: allocation.acceptedAmountMinorUnits,
    reservedAmountMinorUnits: allocation.reservedAmountMinorUnits,
    status: allocation.status,
    mandateId: allocation.mandateRef.mandateId,
    mandateVersion: allocation.mandateRef.mandateVersion,
    riskDecision: allocation.riskDecision,
    complianceDecision: allocation.complianceDecision,
    holdId: allocation.holdId,
    reservationReference: allocation.reservationReference,
    balanceReference: allocation.balanceReference,
    refusalReason: allocation.refusalReason,
    ...extra,
  });
}
