import type { AuthorityIssuer } from "../authority/ExecutionAuthority.ts";
import type { Clock } from "../clock.ts";
import { executePostDeposit, type DepositOutcome } from "../deposit/PostDeposit.ts";
import type { DomainEventLog } from "../events/DomainEvents.ts";
import type { EvidenceVault } from "../evidence/EvidenceVault.ts";
import { assertSimulationOnly } from "../flags/capabilities.ts";
import type { GrowthAttributionLedger } from "../growth/GrowthAttributionLedger.ts";
import type { Ledger } from "../ledger/journal.ts";
import { ActionType, type ActionIntent } from "./ActionIntent.ts";

export type KernelDecision = DepositOutcome;

/**
 * Compliance Kernel — the only entry point for customer-touching actions.
 *
 * Deposits post only through submit(). Callers cannot skip the kernel and
 * still produce a POST_DEPOSIT journal: the ledger still demands a signed
 * Execution Authority, and only this kernel issues one for POST_DEPOSIT.
 */
export class ComplianceKernel {
  constructor(
    private readonly ledger: Ledger,
    private readonly authorityIssuer: AuthorityIssuer,
    private readonly evidence: EvidenceVault,
    private readonly events: DomainEventLog,
    private readonly growth: GrowthAttributionLedger,
    private readonly clock: Clock,
  ) {}

  submit(intent: ActionIntent): KernelDecision {
    assertSimulationOnly();
    if (intent.actionType === ActionType.POST_DEPOSIT) {
      return executePostDeposit({
        intent: intent as import("./ActionIntent.ts").PostDepositIntent,
        ledger: this.ledger,
        authorityIssuer: this.authorityIssuer,
        evidence: this.evidence,
        events: this.events,
        growth: this.growth,
        clock: this.clock,
      });
    }
    const evidence = this.evidence.seal("INTENT_REFUSED", {
      actionType: intent.actionType,
      idempotencyKey: intent.idempotencyKey,
      reason: "unknown actionType",
    });
    return {
      outcome: "REFUSED",
      reason: `unknown actionType: ${intent.actionType}`,
      evidenceId: evidence.evidenceId,
    };
  }
}
