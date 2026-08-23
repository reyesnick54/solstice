import type { UtcInstant } from '../../domain/src/time.ts';
import { evaluateBudget } from './budget.ts';
import type { AgentAssistScope } from './taxonomy.ts';
import type { AgentBudget, AgentMandateUsage, AgentTransactionProposal, MandateRefusal } from './types.ts';

export function evaluateProposalLimits(input: {
  readonly budget: AgentBudget;
  readonly usage: AgentMandateUsage;
  readonly proposal: Pick<AgentTransactionProposal, 'quantity' | 'fees' | 'assetId' | 'destinationOrMarket' | 'intent'>;
  readonly now: UtcInstant;
  readonly currency?: string;
  readonly assetClass?: string;
  readonly toolName?: string;
  readonly jurisdiction?: string | null;
}): { readonly ok: true } | MandateRefusal {
  const base = evaluateBudget({
    budget: input.budget,
    usage: input.usage,
    proposal: input.proposal,
  });
  if (!base.ok) {
    return { ok: false, code: 'BUDGET_EXCEEDED', detail: base.reason };
  }
  const cost = input.proposal.quantity + input.proposal.fees;
  if (input.budget.maxProposalAmount !== undefined && cost > input.budget.maxProposalAmount) {
    return { ok: false, code: 'BUDGET_EXCEEDED', detail: 'maximum proposal amount exceeded' };
  }
  if (
    input.budget.dailyProposalAggregate !== undefined &&
    input.usage.spentThisPeriod + cost > input.budget.dailyProposalAggregate
  ) {
    return { ok: false, code: 'DAILY_AGGREGATE_EXCEEDED', detail: 'daily proposal aggregate exceeded' };
  }
  if (input.currency && input.budget.allowedCurrencies && !input.budget.allowedCurrencies.includes(input.currency)) {
    return { ok: false, code: 'CURRENCY_NOT_PERMITTED', detail: `currency ${input.currency} is not on the agent limit` };
  }
  if (
    input.assetClass &&
    input.budget.allowedAssetClasses &&
    !input.budget.allowedAssetClasses.includes(input.assetClass)
  ) {
    return { ok: false, code: 'ASSET_CLASS_NOT_PERMITTED', detail: `asset class ${input.assetClass} is not permitted` };
  }
  if (input.budget.jurisdiction && input.jurisdiction && input.budget.jurisdiction !== input.jurisdiction) {
    return { ok: false, code: 'JURISDICTION_UNAVAILABLE', detail: 'agent limit jurisdiction does not match' };
  }
  if (input.toolName && input.budget.perToolBudget?.[input.toolName] !== undefined) {
    const cap = BigInt(input.budget.perToolBudget[input.toolName] ?? '0');
    const used = BigInt(input.usage.byActionClass[input.toolName] ?? '0');
    if (used + cost > cap) {
      return { ok: false, code: 'TOOL_BUDGET_EXCEEDED', detail: `per-tool budget exceeded for ${input.toolName}` };
    }
  }
  if (input.budget.timeWindows && input.budget.timeWindows.length > 0) {
    const hour = new Date(input.now).getUTCHours();
    const open = input.budget.timeWindows.some((window) => hour >= window.startHourUtc && hour < window.endHourUtc);
    if (!open) {
      return { ok: false, code: 'TIME_WINDOW_CLOSED', detail: 'proposal is outside the permitted time window' };
    }
  }
  return { ok: true };
}

export function limitsDoNotOverrideCompliance(): true {
  return true;
}

export function assistScopeRequiresProposal(scope: AgentAssistScope): boolean {
  return (
    scope === 'CREATE_PAYMENT_PROPOSAL' ||
    scope === 'CREATE_FX_PROPOSAL' ||
    scope === 'CREATE_GROWTH_PROPOSAL' ||
    scope === 'CREATE_INVESTMENT_PROPOSAL' ||
    scope === 'CREATE_EXCHANGE_PROPOSAL'
  );
}
