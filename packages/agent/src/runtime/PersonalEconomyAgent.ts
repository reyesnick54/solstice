import type { AgentProposal } from '../../../contracts/src/proposal.ts';
import type { CompiledMandate } from '../../../contracts/src/mandate-types.ts';
import type { FinancialContextSnapshot } from '../../../contracts/src/financial-context.ts';
import { asProposalId } from '../../../contracts/src/ids.ts';
import type { UtcInstant } from '../../../contracts/src/time.ts';
import { Money } from '../../../contracts/src/money.ts';
import { runCompounder } from '../compounder/waterfall.ts';
import { compileMandate } from '../mandates/compile.ts';
import { explainProposal } from '../explain/explain.ts';
import {
  proposeMerchantSelection,
  proposeOpportunities,
  proposeRewardRoute,
  proposeSubscriptionCancellations,
  type CuratedOpportunity,
  type RewardComparison,
  type SimulatedMerchantBid,
} from '../growth-os/services.ts';
import { assertReadOnlyContext, type AgentRuntimePorts } from './ports.ts';

export type AgentEmitResult = {
  readonly proposals: readonly AgentProposal[];
  readonly explanations: readonly string[];
};

/**
 * Personal Economy Agent.
 *
 * Constructor ports are the complete surface the agent can reach:
 * a frozen read-only financial snapshot, public token claims, and
 * compiled mandates. There is no ledger field, no execution path, and
 * no AuthorityIssuer. TypeScript will not compile an agent that is
 * handed those handles because they are absent from AgentRuntimePorts.
 */
export class PersonalEconomyAgent {
  readonly #ports: AgentRuntimePorts;

  constructor(ports: AgentRuntimePorts) {
    assertReadOnlyContext(ports.context);
    this.#ports = {
      context: ports.context,
      claims: ports.claims,
      mandates: ports.mandates,
    };
    Object.freeze(this.#ports);
    Object.freeze(this);
  }

  /**
   * Compile a customer mandate. Uncompilable text is rejected with an
   * explanation — never approximated.
   */
  compileCustomerMandate(sourceText: string, now: UtcInstant, version: number) {
    return compileMandate({
      customerId: this.#ports.claims.customerId,
      sourceText,
      claims: this.#ports.claims,
      currency: this.#ports.context.currency,
      compiledAt: now,
      version,
    });
  }

  /**
   * Run the Compounder waterfall against a new dollar amount.
   */
  proposeForNewMoney(newMoney: Money, now: UtcInstant, proposalIdPrefix: string): AgentEmitResult {
    const proposals = runCompounder({
      newMoney,
      context: this.#ports.context,
      claims: this.#ports.claims,
      mandates: this.#ports.mandates,
      now,
      proposalIdPrefix,
    });
    return {
      proposals,
      explanations: proposals.map(explainProposal),
    };
  }

  /**
   * Explicit investment-sweep proposal against a named deposit account.
   * Used so the demo can show one sweep the Kernel allows (agreement
   * present) and one it refuses (agreement absent). Still a proposal.
   */
  proposeInvestmentSweep(input: {
    readonly sourceAccountId: string;
    readonly targetAccountId: string;
    readonly amount: Money;
    readonly now: UtcInstant;
    readonly proposalId: string;
  }): AgentProposal {
    const source = this.#ports.context.accounts.find((a) => a.id === input.sourceAccountId);
    const invest = this.#ports.mandates.find((m) => m.constraint.kind === 'INVEST_SURPLUS');
    const agreementPresent = source?.depositInvestmentAgreement?.present === true;
    return Object.freeze({
      proposalId: asProposalId(input.proposalId),
      agentId: this.#ports.claims.agentId,
      customerId: this.#ports.claims.customerId,
      actionType: 'INVESTMENT_SWEEP',
      amount: input.amount,
      targetAccountClass: 'investments',
      reasonCode: agreementPresent ? 'SURPLUS_CASH_INVESTABLE' : 'PROTECTED_DEPOSIT_SWEEP_REQUESTED',
      mandateClauseId: invest?.clauseId ?? ('clause_none' as CompiledMandate['clauseId']),
      recordedFactors: Object.freeze([
        { key: 'surplus' as const, amount: input.amount },
        { key: 'agreement_present' as const, present: agreementPresent },
        { key: 'waterfall_step' as const, step: 'INVESTMENT_MANDATE' },
        {
          key: 'mandate_clause' as const,
          clauseId: invest?.clauseId ?? 'clause_none',
          sourceText: invest?.sourceText ?? 'invest surplus cash',
        },
        {
          key: 'reason_code' as const,
          code: agreementPresent ? 'SURPLUS_CASH_INVESTABLE' : 'PROTECTED_DEPOSIT_SWEEP_REQUESTED',
        },
      ]),
      sourceAccountId: input.sourceAccountId,
      targetAccountId: input.targetAccountId,
      requiresDepositInvestmentAgreement: true,
      emittedAt: input.now,
    });
  }

  proposeSubscriptions(now: UtcInstant): AgentEmitResult {
    const clause = this.#ports.mandates[0]?.clauseId ?? ('clause_none' as CompiledMandate['clauseId']);
    const proposals = proposeSubscriptionCancellations({
      context: this.#ports.context,
      claims: this.#ports.claims,
      mandateClauseId: clause,
      now,
    });
    return { proposals, explanations: proposals.map(explainProposal) };
  }

  proposeMerchantBid(selected: SimulatedMerchantBid, now: UtcInstant): AgentEmitResult {
    const clause = this.#ports.mandates[0]?.clauseId ?? ('clause_none' as CompiledMandate['clauseId']);
    const proposal = proposeMerchantSelection({
      claims: this.#ports.claims,
      mandateClauseId: clause,
      now,
      selected,
    });
    return { proposals: [proposal], explanations: [explainProposal(proposal)] };
  }

  proposeResearch(catalog: readonly CuratedOpportunity[], now: UtcInstant): AgentEmitResult {
    const proposals = proposeOpportunities({
      claims: this.#ports.claims,
      mandates: this.#ports.mandates,
      now,
      catalog,
    });
    return { proposals, explanations: proposals.map(explainProposal) };
  }

  proposeReward(methods: readonly RewardComparison[], now: UtcInstant): AgentEmitResult {
    const clause = this.#ports.mandates[0]?.clauseId ?? ('clause_none' as CompiledMandate['clauseId']);
    const proposal = proposeRewardRoute({
      claims: this.#ports.claims,
      mandateClauseId: clause,
      now,
      methods,
    });
    return { proposals: [proposal], explanations: [explainProposal(proposal)] };
  }

  context(): FinancialContextSnapshot {
    return this.#ports.context;
  }
}
