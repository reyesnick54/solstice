import type { Clock } from '../clock.ts';
import { assertSimulationOnly } from '../flags/live.ts';
import type { EvidenceVault } from '../evidence/EvidenceVault.ts';
import type { DomainEventLog } from '../events/DomainEventLog.ts';
import type { GrowthAttributionLedger } from '../growth/GrowthAttributionLedger.ts';
import type { SimulatedLedger } from '../ledger/SimulatedLedger.ts';
import type { AuthorityIssuer } from '../authority/ExecutionAuthority.ts';
import {
  ActionType,
  type ActionIntent,
  type AgentProposalPayload,
  type SetMandatePayload,
} from './ActionIntent.ts';
import type { AgentProposal } from '../../../contracts/src/proposal.ts';
import type { CompiledMandate } from '../../../contracts/src/mandate-types.ts';
import type { FinancialContextSnapshot } from '../../../contracts/src/financial-context.ts';

export type KernelDecision =
  | {
      readonly outcome: 'ALLOWED';
      readonly reason: string;
      readonly evidenceId: string;
      readonly proposalId?: string;
      readonly mandateId?: string;
    }
  | {
      readonly outcome: 'REFUSED';
      readonly reason: string;
      readonly evidenceId: string;
      readonly proposalId?: string;
    };

/**
 * Compliance Kernel — the only entry for intents.
 *
 * Agent-originated intents:
 *   - NEVER receive an ExecutionAuthority
 *   - NEVER call the ledger
 *   - ALLOW means the proposal is compliant for a human to consider
 *   - REFUSE is the correct outcome when a deposit-to-investment
 *     agreement is absent, or when the action is an external mutation
 *
 * Human/system POST_DEPOSIT is out of scope here (see Phase 0 PR); this
 * kernel still refuses unknown execution types rather than posting.
 */
export class ComplianceKernel {
  private readonly mandates = new Map<string, CompiledMandate[]>();
  readonly #ledger: SimulatedLedger;
  readonly #authorityIssuer: AuthorityIssuer;
  readonly #evidence: EvidenceVault;
  readonly #events: DomainEventLog;
  readonly #growth: GrowthAttributionLedger;
  readonly #clock: Clock;

  constructor(
    ledger: SimulatedLedger,
    authorityIssuer: AuthorityIssuer,
    evidence: EvidenceVault,
    events: DomainEventLog,
    growth: GrowthAttributionLedger,
    clock: Clock,
  ) {
    this.#ledger = ledger;
    this.#authorityIssuer = authorityIssuer;
    this.#evidence = evidence;
    this.#events = events;
    this.#growth = growth;
    this.#clock = clock;
  }

  submit(intent: ActionIntent): KernelDecision {
    assertSimulationOnly();
    this.#events.append('kernel.intent.submitted', this.#clock.now(), {
      actionType: intent.actionType,
      origin: intent.origin,
      idempotencyKey: intent.idempotencyKey,
    });

    if (intent.actionType === ActionType.SET_MANDATE) {
      return this.setMandate(intent as ActionIntent<SetMandatePayload>);
    }
    if (intent.actionType === ActionType.AGENT_PROPOSAL) {
      return this.handleAgentProposal(intent as ActionIntent<AgentProposalPayload>);
    }

    const evidence = this.#evidence.seal('INTENT_REFUSED', {
      actionType: intent.actionType,
      reason: 'unknown or unexecutable actionType on the agent path',
    });
    this.#events.append('kernel.intent.refused', this.#clock.now(), {
      actionType: intent.actionType,
    });
    return {
      outcome: 'REFUSED',
      reason: `unknown actionType: ${intent.actionType}`,
      evidenceId: evidence.evidenceId,
    };
  }

  listMandates(customerId: string): readonly CompiledMandate[] {
    return this.mandates.get(customerId) ?? [];
  }

  journalCount(): number {
    return this.#ledger.count();
  }

  authorityIssuedCount(): number {
    return this.#authorityIssuer.issuedCount();
  }

  private setMandate(intent: ActionIntent<SetMandatePayload>): KernelDecision {
    const mandate = intent.payload.mandate;
    const existing = this.mandates.get(mandate.customerId) ?? [];
    this.mandates.set(mandate.customerId, [...existing, mandate]);
    const evidence = this.#evidence.seal('MANDATE_SET', {
      mandateId: mandate.id,
      version: mandate.version,
      kind: mandate.constraint.kind,
    });
    this.#events.append('mandate.set', this.#clock.now(), {
      mandateId: mandate.id,
      version: mandate.version,
    });
    return {
      outcome: 'ALLOWED',
      reason: `mandate ${mandate.id} version ${mandate.version} recorded`,
      evidenceId: evidence.evidenceId,
      mandateId: mandate.id,
    };
  }

  private handleAgentProposal(intent: ActionIntent<AgentProposalPayload>): KernelDecision {
    if (intent.origin !== 'AGENT') {
      const evidence = this.#evidence.seal('INTENT_REFUSED', {
        reason: 'AGENT_PROPOSAL origin must be AGENT',
      });
      return {
        outcome: 'REFUSED',
        reason: 'AGENT_PROPOSAL origin must be AGENT',
        evidenceId: evidence.evidenceId,
        proposalId: intent.payload.proposal.proposalId,
      };
    }

    const proposal = intent.payload.proposal;
    const refusal = this.refuseAgentProposal(proposal);
    if (refusal) {
      const evidence = this.#evidence.seal('AGENT_PROPOSAL_REFUSED', {
        proposalId: proposal.proposalId,
        actionType: proposal.actionType,
        reason: refusal,
      });
      this.#events.append('agent.proposal.refused', this.#clock.now(), {
        proposalId: proposal.proposalId,
        reason: refusal,
      });
      return {
        outcome: 'REFUSED',
        reason: refusal,
        evidenceId: evidence.evidenceId,
        proposalId: proposal.proposalId,
      };
    }

    // ALLOW is a decision. No ExecutionAuthority. No journal.
    const evidence = this.#evidence.seal('AGENT_PROPOSAL_ALLOWED', {
      proposalId: proposal.proposalId,
      actionType: proposal.actionType,
      amount: proposal.amount.toJSON(),
      executionAuthorityIssued: false,
      journalPosted: false,
    });
    this.#events.append('agent.proposal.allowed', this.#clock.now(), {
      proposalId: proposal.proposalId,
      actionType: proposal.actionType,
    });
    return {
      outcome: 'ALLOWED',
      reason: 'proposal is within policy for human consideration; agent cannot execute',
      evidenceId: evidence.evidenceId,
      proposalId: proposal.proposalId,
    };
  }

  private refuseAgentProposal(proposal: AgentProposal): string | null {
    if (proposal.actionType === 'CANCEL_SUBSCRIPTION') {
      return 'EXTERNAL_SUBSCRIPTION_MUTATION_FORBIDDEN: subscription agent cannot modify a real service';
    }
    if (proposal.requiresDepositInvestmentAgreement) {
      // Agreement check is performed with the snapshot carried on the proposal
      // factors (agreement_present) plus source account. The Kernel refuses
      // when the proposal itself declares the agreement is required and the
      // recorded factor says it is absent.
      const agreement = proposal.recordedFactors.find((f) => f.key === 'agreement_present');
      if (!agreement || !('present' in agreement) || agreement.present !== true) {
        return 'MISSING_DEPOSIT_INVESTMENT_AGREEMENT: protected deposits cannot move into investment products without an explicit account agreement';
      }
    }
    return null;
  }
}

export type ContextForAgreement = FinancialContextSnapshot;
