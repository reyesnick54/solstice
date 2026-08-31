/**
 * ACCESS Wave 5 — Compliance Kernel integration gate.
 *
 * Access provider data must not independently make compliance decisions.
 * External provider → evidence/transaction context → Compliance Kernel → decision.
 */

import type { AccessComplianceGateResult } from './types.ts';

export type ComplianceKernelSubmitPort = {
  readonly evaluate: (input: {
    readonly actionType: string;
    readonly actorId: string;
    readonly accessTransactionId: string;
    readonly providerId: string;
    readonly amountMinorUnits: bigint;
    readonly currency: string;
    readonly evidenceReference: string;
  }) => Promise<{
    readonly decision: 'ALLOW' | 'HOLD' | 'BLOCK' | 'DEFER' | 'REQUIRE_MANUAL_REVIEW';
    readonly evidenceId: string;
    readonly executionAuthorityIssued: false;
  }>;
};

export class AccessComplianceGate {
  private readonly kernel: ComplianceKernelSubmitPort;

  constructor(kernel: ComplianceKernelSubmitPort) {
    this.kernel = kernel;
  }

  async evaluateFinancialOperation(input: {
    readonly actionType: string;
    readonly actorId: string;
    readonly accessTransactionId: string;
    readonly providerId: string;
    readonly amountMinorUnits: bigint;
    readonly currency: string;
    readonly evidenceReference: string;
  }): Promise<AccessComplianceGateResult> {
    const decision = await this.kernel.evaluate(input);
    if (decision.executionAuthorityIssued !== false) {
      throw new Error('Access compliance gate must not issue Execution Authority');
    }
    const allowed = decision.decision === 'ALLOW';
    return Object.freeze({
      allowed,
      kernelDecisionRef: decision.evidenceId,
      reason: `Kernel decision: ${decision.decision}`,
      requiresManualReview: decision.decision === 'REQUIRE_MANUAL_REVIEW',
    });
  }
}

export function createSimulationComplianceKernel(): ComplianceKernelSubmitPort {
  return Object.freeze({
    evaluate: async (input) =>
      Object.freeze({
        decision: 'ALLOW' as const,
        evidenceId: `kernel_ev_${input.accessTransactionId}`,
        executionAuthorityIssued: false as const,
      }),
  });
}

export function assertProviderDataDoesNotDecideCompliance(
  providerDecision: string | null,
  kernelResult: AccessComplianceGateResult,
): void {
  if (providerDecision !== null && !kernelResult.kernelDecisionRef) {
    throw new Error('provider data must not independently make compliance decisions');
  }
}
