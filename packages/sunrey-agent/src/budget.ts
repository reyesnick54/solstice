import type { AgentBudget, AgentMandateUsage, AgentTransactionProposal } from './types.ts';

export function emptyUsage(mandateId: AgentMandateUsage['mandateId'], at: AgentMandateUsage['periodStartedAt']): AgentMandateUsage {
  return Object.freeze({
    mandateId,
    spentThisPeriod: 0n,
    spentTotal: 0n,
    transactionsThisPeriod: 0,
    periodStartedAt: at,
    byAsset: Object.freeze({}),
    byMarket: Object.freeze({}),
    byActionClass: Object.freeze({}),
  });
}

export function rolloverUsage(usage: AgentMandateUsage, at: AgentMandateUsage['periodStartedAt'], periodHours: number): AgentMandateUsage {
  const elapsedMs = Date.parse(at) - Date.parse(usage.periodStartedAt);
  if (elapsedMs >= periodHours * 60 * 60 * 1000) {
    return emptyUsage(usage.mandateId, at);
  }
  return usage;
}

export function evaluateBudget(input: {
  readonly budget: AgentBudget;
  readonly usage: AgentMandateUsage;
  readonly proposal: Pick<AgentTransactionProposal, 'quantity' | 'fees' | 'assetId' | 'destinationOrMarket' | 'intent'>;
}): { readonly ok: true } | { readonly ok: false; readonly reason: string } {
  const cost = input.proposal.quantity + input.proposal.fees;
  if (cost > input.budget.perTransaction) {
    return { ok: false, reason: 'per-transaction budget exceeded' };
  }
  if (input.usage.spentThisPeriod + cost > input.budget.perPeriod) {
    return { ok: false, reason: 'period budget exceeded' };
  }
  const assetCap = input.budget.perAsset[input.proposal.assetId];
  if (assetCap !== undefined) {
    const used = BigInt(input.usage.byAsset[input.proposal.assetId] ?? '0');
    if (used + cost > BigInt(assetCap)) {
      return { ok: false, reason: `asset budget exceeded for ${input.proposal.assetId}` };
    }
  }
  const marketCap = input.budget.perMarket[input.proposal.destinationOrMarket];
  if (marketCap !== undefined) {
    const used = BigInt(input.usage.byMarket[input.proposal.destinationOrMarket] ?? '0');
    if (used + cost > BigInt(marketCap)) {
      return { ok: false, reason: `market budget exceeded for ${input.proposal.destinationOrMarket}` };
    }
  }
  const actionCap = input.budget.perActionClass[input.proposal.intent];
  if (actionCap !== undefined) {
    const used = BigInt(input.usage.byActionClass[input.proposal.intent] ?? '0');
    if (used + cost > BigInt(actionCap)) {
      return { ok: false, reason: `action-class budget exceeded for ${input.proposal.intent}` };
    }
  }
  return { ok: true };
}

export function recordUsage(
  usage: AgentMandateUsage,
  proposal: Pick<AgentTransactionProposal, 'quantity' | 'fees' | 'assetId' | 'destinationOrMarket' | 'intent'>,
): AgentMandateUsage {
  const cost = proposal.quantity + proposal.fees;
  const nextAsset = { ...usage.byAsset };
  nextAsset[proposal.assetId] = (BigInt(nextAsset[proposal.assetId] ?? '0') + cost).toString();
  const nextMarket = { ...usage.byMarket };
  nextMarket[proposal.destinationOrMarket] = (BigInt(nextMarket[proposal.destinationOrMarket] ?? '0') + cost).toString();
  const nextAction = { ...usage.byActionClass };
  nextAction[proposal.intent] = (BigInt(nextAction[proposal.intent] ?? '0') + cost).toString();
  return Object.freeze({
    ...usage,
    spentThisPeriod: usage.spentThisPeriod + cost,
    spentTotal: usage.spentTotal + cost,
    transactionsThisPeriod: usage.transactionsThisPeriod + 1,
    byAsset: Object.freeze(nextAsset),
    byMarket: Object.freeze(nextMarket),
    byActionClass: Object.freeze(nextAction),
  });
}
