import { Money } from '../../../contracts/src/money.ts';
import type { FinancialContextSnapshot } from '../../../contracts/src/financial-context.ts';
import type { CompiledMandate } from '../../../contracts/src/mandate-types.ts';
import type { AgentProposal } from '../../../contracts/src/proposal.ts';
import type { CapabilityTokenClaims } from '../../../contracts/src/capability-claims.ts';
import type { RecordedFactor } from '../../../contracts/src/recorded-factor.ts';
import type { ReasonCode } from '../../../contracts/src/proposal-types.ts';
import type { MandateClauseId, ProposalId } from '../../../contracts/src/ids.ts';
import { asProposalId } from '../../../contracts/src/ids.ts';
import type { UtcInstant } from '../../../contracts/src/time.ts';
import type { ProductAccountClass } from '../../../contracts/src/account-class.ts';

/**
 * Fixed Compounder order. Each new dollar is evaluated in this sequence.
 * The agent emits proposals only — it never moves money.
 */
export const COMPOUNDER_WATERFALL = [
  'EMERGENCY_RESERVE_TARGET',
  'NEAR_TERM_OBLIGATIONS',
  'HIGH_COST_DEBT',
  'REQUIRED_LIQUIDITY',
  'INVESTMENT_MANDATE',
  'USER_GOALS',
  'PERMITTED_ALLOCATION',
] as const;

export type CompounderStep = (typeof COMPOUNDER_WATERFALL)[number];

export type CompounderInput = {
  readonly newMoney: Money;
  readonly context: FinancialContextSnapshot;
  readonly claims: CapabilityTokenClaims;
  readonly mandates: readonly CompiledMandate[];
  readonly now: UtcInstant;
  readonly proposalIdPrefix: string;
};

type Draft = {
  readonly actionType: AgentProposal['actionType'];
  readonly amount: Money;
  readonly targetAccountClass: ProductAccountClass;
  readonly reasonCode: ReasonCode;
  readonly mandateClauseId: MandateClauseId;
  readonly recordedFactors: readonly RecordedFactor[];
  readonly sourceAccountId: string | null;
  readonly targetAccountId: string | null;
  readonly requiresDepositInvestmentAgreement: boolean;
  readonly step: CompounderStep;
};

function depositsBalance(context: FinancialContextSnapshot): Money {
  return context.balancesByClass.deposits;
}

function reserveTarget(context: FinancialContextSnapshot, mandates: readonly CompiledMandate[]): Money | null {
  const reserve = mandates.find((m) => m.constraint.kind === 'RESERVE_MONTHS');
  if (reserve && reserve.constraint.kind === 'RESERVE_MONTHS') {
    return Money.fromMinorUnits(
      context.monthlyEssentialSpending.minorUnits * reserve.constraint.months,
      context.currency,
    );
  }
  return null;
}

function liquidFloor(mandates: readonly CompiledMandate[]): Money | null {
  const keep = mandates.find((m) => m.constraint.kind === 'KEEP_LIQUID');
  if (keep && keep.constraint.kind === 'KEEP_LIQUID') {
    return keep.constraint.amount;
  }
  return null;
}

function clauseOf(mandates: readonly CompiledMandate[], kind: CompiledMandate['constraint']['kind']): MandateClauseId | null {
  const found = mandates.find((m) => m.constraint.kind === kind);
  return found ? found.clauseId : null;
}

function fallbackClause(mandates: readonly CompiledMandate[]): MandateClauseId {
  const first = mandates[0];
  if (first) {
    return first.clauseId;
  }
  return 'clause_none' as MandateClauseId;
}

/**
 * Allocate `newMoney` down the waterfall. Remainder after a step continues.
 * Never executes. Protected-deposit sweeps are still proposed when the
 * investment mandate applies; the Kernel refuses them without an agreement.
 */
export function runCompounder(input: CompounderInput): readonly AgentProposal[] {
  const drafts: Draft[] = [];
  let remaining = input.newMoney;
  const { context, mandates } = input;

  const apply = (step: CompounderStep, take: Money, draft: Omit<Draft, 'amount' | 'step'>): void => {
    if (!take.isPositive() || remaining.isZero()) {
      return;
    }
    const used = take.min(remaining);
    remaining = remaining.minus(used);
    drafts.push({ ...draft, amount: used, step });
  };

  // 1. Emergency reserve target
  const target = reserveTarget(context, mandates);
  const reserveClause = clauseOf(mandates, 'RESERVE_MONTHS') ?? fallbackClause(mandates);
  if (target) {
    const gap = target.minus(depositsBalance(context));
    if (gap.isPositive()) {
      apply('EMERGENCY_RESERVE_TARGET', gap, {
        actionType: 'ALLOCATE_TO_RESERVE',
        targetAccountClass: 'deposits',
        reasonCode: 'RESERVE_BELOW_TARGET',
        mandateClauseId: reserveClause,
        recordedFactors: [
          { key: 'waterfall_step', step: 'EMERGENCY_RESERVE_TARGET' },
          { key: 'savings_balance', amount: depositsBalance(context) },
          { key: 'monthly_essential_spending', amount: context.monthlyEssentialSpending },
          { key: 'reserve_months', months: (mandates.find((m) => m.constraint.kind === 'RESERVE_MONTHS')?.constraint as { months: bigint }).months },
          { key: 'reason_code', code: 'RESERVE_BELOW_TARGET' },
        ],
        sourceAccountId: null,
        targetAccountId: context.accounts.find((a) => a.accountClass === 'deposits')?.id ?? null,
        requiresDepositInvestmentAgreement: false,
      });
    }
  }

  // 2. Near-term obligations
  const obligation = context.nearTermObligations[0];
  if (obligation && remaining.isPositive()) {
    apply('NEAR_TERM_OBLIGATIONS', obligation.amount, {
      actionType: 'HOLD_LIQUIDITY',
      targetAccountClass: 'deposits',
      reasonCode: 'NEAR_TERM_OBLIGATION',
      mandateClauseId: fallbackClause(mandates),
      recordedFactors: [
        { key: 'waterfall_step', step: 'NEAR_TERM_OBLIGATIONS' },
        { key: 'obligation_name', name: obligation.name },
        { key: 'obligation_amount', amount: obligation.amount },
        { key: 'reason_code', code: 'NEAR_TERM_OBLIGATION' },
      ],
      sourceAccountId: null,
      targetAccountId: null,
      requiresDepositInvestmentAgreement: false,
    });
  }

  // 3. High-cost debt
  const debt = context.highCostDebt[0];
  if (debt && remaining.isPositive()) {
    apply('HIGH_COST_DEBT', debt.balance, {
      actionType: 'PAY_HIGH_COST_DEBT',
      targetAccountClass: 'deposits',
      reasonCode: 'HIGH_COST_DEBT_OUTSTANDING',
      mandateClauseId: fallbackClause(mandates),
      recordedFactors: [
        { key: 'waterfall_step', step: 'HIGH_COST_DEBT' },
        { key: 'high_cost_debt_name', name: debt.name },
        { key: 'high_cost_debt_balance', amount: debt.balance },
        { key: 'reason_code', code: 'HIGH_COST_DEBT_OUTSTANDING' },
      ],
      sourceAccountId: null,
      targetAccountId: null,
      requiresDepositInvestmentAgreement: false,
    });
  }

  // 4. Required liquidity
  const floor = liquidFloor(mandates);
  const liquidClause = clauseOf(mandates, 'KEEP_LIQUID') ?? fallbackClause(mandates);
  if (floor && remaining.isPositive()) {
    const projectedDeposits = depositsBalance(context).plus(
      drafts
        .filter((d) => d.targetAccountClass === 'deposits')
        .reduce((acc, d) => acc.plus(d.amount), Money.zero(context.currency)),
    );
    const liquidityGap = floor.minus(projectedDeposits);
    if (liquidityGap.isPositive()) {
      apply('REQUIRED_LIQUIDITY', liquidityGap, {
        actionType: 'HOLD_LIQUIDITY',
        targetAccountClass: 'deposits',
        reasonCode: 'LIQUIDITY_BELOW_MANDATE',
        mandateClauseId: liquidClause,
        recordedFactors: [
          { key: 'waterfall_step', step: 'REQUIRED_LIQUIDITY' },
          { key: 'liquid_floor', amount: floor },
          { key: 'savings_balance', amount: depositsBalance(context) },
          { key: 'reason_code', code: 'LIQUIDITY_BELOW_MANDATE' },
        ],
        sourceAccountId: null,
        targetAccountId: context.accounts.find((a) => a.accountClass === 'deposits')?.id ?? null,
        requiresDepositInvestmentAgreement: false,
      });
    }
  }

  // 5. Investment mandate — propose even without agreement; Kernel refuses
  const invest = mandates.find((m) => m.constraint.kind === 'INVEST_SURPLUS');
  if (invest && remaining.isPositive()) {
    const depositAccount = context.accounts.find((a) => a.accountClass === 'deposits');
    const investmentAccount = context.accounts.find((a) => a.accountClass === 'investments');
    const agreementPresent = depositAccount?.depositInvestmentAgreement?.present === true;
    apply('INVESTMENT_MANDATE', remaining, {
      actionType: 'INVESTMENT_SWEEP',
      targetAccountClass: 'investments',
      reasonCode: agreementPresent ? 'SURPLUS_CASH_INVESTABLE' : 'PROTECTED_DEPOSIT_SWEEP_REQUESTED',
      mandateClauseId: invest.clauseId,
      recordedFactors: [
        { key: 'waterfall_step', step: 'INVESTMENT_MANDATE' },
        { key: 'surplus', amount: remaining },
        { key: 'mandate_clause', clauseId: invest.clauseId, sourceText: invest.sourceText },
        { key: 'agreement_present', present: agreementPresent },
        { key: 'reason_code', code: agreementPresent ? 'SURPLUS_CASH_INVESTABLE' : 'PROTECTED_DEPOSIT_SWEEP_REQUESTED' },
      ],
      sourceAccountId: depositAccount?.id ?? null,
      targetAccountId: investmentAccount?.id ?? null,
      requiresDepositInvestmentAgreement: true,
    });
  }

  // 6. User goals
  const goal = context.userGoals[0];
  if (goal && remaining.isPositive()) {
    apply('USER_GOALS', goal.remaining, {
      actionType: 'ALLOCATE_TO_GOAL',
      targetAccountClass: 'deposits',
      reasonCode: 'USER_GOAL_FUNDING',
      mandateClauseId: fallbackClause(mandates),
      recordedFactors: [
        { key: 'waterfall_step', step: 'USER_GOALS' },
        { key: 'goal_name', name: goal.name },
        { key: 'reason_code', code: 'USER_GOAL_FUNDING' },
      ],
      sourceAccountId: null,
      targetAccountId: null,
      requiresDepositInvestmentAgreement: false,
    });
  }

  // 7. Permitted allocation
  if (remaining.isPositive()) {
    apply('PERMITTED_ALLOCATION', remaining, {
      actionType: 'PERMITTED_ALLOCATION',
      targetAccountClass: 'deposits',
      reasonCode: 'PERMITTED_REST_ALLOCATION',
      mandateClauseId: fallbackClause(mandates),
      recordedFactors: [
        { key: 'waterfall_step', step: 'PERMITTED_ALLOCATION' },
        { key: 'reason_code', code: 'PERMITTED_REST_ALLOCATION' },
      ],
      sourceAccountId: null,
      targetAccountId: null,
      requiresDepositInvestmentAgreement: false,
    });
  }

  return drafts.map((draft, index) =>
    Object.freeze({
      proposalId: asProposalId(`${input.proposalIdPrefix}_${index + 1}`),
      agentId: input.claims.agentId,
      customerId: input.claims.customerId,
      actionType: draft.actionType,
      amount: draft.amount,
      targetAccountClass: draft.targetAccountClass,
      reasonCode: draft.reasonCode,
      mandateClauseId: draft.mandateClauseId,
      recordedFactors: Object.freeze([...draft.recordedFactors]),
      sourceAccountId: draft.sourceAccountId,
      targetAccountId: draft.targetAccountId,
      requiresDepositInvestmentAgreement: draft.requiresDepositInvestmentAgreement,
      emittedAt: input.now,
    }) satisfies AgentProposal,
  );
}

export function waterfallOrder(): readonly CompounderStep[] {
  return COMPOUNDER_WATERFALL;
}
