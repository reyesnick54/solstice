import { asUserAgentMandateId } from './ids.ts';
import type { AgentBudget, AgentRuntimeSnapshot, UserAgentMandate } from './types.ts';

type SerializedBudget = Omit<AgentBudget, 'perTransaction' | 'perPeriod' | 'maxProposalAmount' | 'dailyProposalAggregate'> & {
  readonly perTransaction: string;
  readonly perPeriod: string;
  readonly maxProposalAmount?: string;
  readonly dailyProposalAggregate?: string;
};

export type SerializedAgentRuntimeSnapshot = {
  readonly agents: AgentRuntimeSnapshot['agents'];
  readonly conversations: AgentRuntimeSnapshot['conversations'];
  readonly messages: AgentRuntimeSnapshot['messages'];
  readonly toolEvents: AgentRuntimeSnapshot['toolEvents'];
  readonly memories: AgentRuntimeSnapshot['memories'];
  readonly personalization: AgentRuntimeSnapshot['personalization'];
  readonly runtimeEvents: AgentRuntimeSnapshot['runtimeEvents'];
  readonly proposals: readonly (Omit<AgentRuntimeSnapshot['proposals'][number], 'quantity' | 'fees'> & {
    readonly quantity: string;
    readonly fees: string;
  })[];
  readonly usage: readonly (Omit<AgentRuntimeSnapshot['usage'][number], 'spentThisPeriod' | 'spentTotal'> & {
    readonly spentThisPeriod: string;
    readonly spentTotal: string;
  })[];
  readonly mandates: readonly (Omit<UserAgentMandate, 'budget'> & {
    readonly budget: SerializedBudget;
  })[];
};

function serializeBudget(budget: AgentBudget): SerializedBudget {
  const {
    perTransaction: _perTransaction,
    perPeriod: _perPeriod,
    maxProposalAmount: _maxProposalAmount,
    dailyProposalAggregate: _dailyProposalAggregate,
    ...rest
  } = budget;
  return Object.freeze({
    ...rest,
    perTransaction: budget.perTransaction.toString(),
    perPeriod: budget.perPeriod.toString(),
    ...(budget.maxProposalAmount !== undefined ? { maxProposalAmount: budget.maxProposalAmount.toString() } : {}),
    ...(budget.dailyProposalAggregate !== undefined
      ? { dailyProposalAggregate: budget.dailyProposalAggregate.toString() }
      : {}),
  });
}

function deserializeBudget(budget: SerializedBudget): AgentBudget {
  const {
    perTransaction: _perTransaction,
    perPeriod: _perPeriod,
    maxProposalAmount: _maxProposalAmount,
    dailyProposalAggregate: _dailyProposalAggregate,
    ...rest
  } = budget;
  return Object.freeze({
    ...rest,
    perTransaction: BigInt(budget.perTransaction),
    perPeriod: BigInt(budget.perPeriod),
    ...(budget.maxProposalAmount !== undefined ? { maxProposalAmount: BigInt(budget.maxProposalAmount) } : {}),
    ...(budget.dailyProposalAggregate !== undefined
      ? { dailyProposalAggregate: BigInt(budget.dailyProposalAggregate) }
      : {}),
  });
}

export function serializeAgentRuntimeSnapshot(snapshot: AgentRuntimeSnapshot): SerializedAgentRuntimeSnapshot {
  return Object.freeze({
    agents: snapshot.agents,
    conversations: snapshot.conversations,
    messages: snapshot.messages,
    toolEvents: snapshot.toolEvents,
    memories: snapshot.memories,
    personalization: snapshot.personalization,
    runtimeEvents: snapshot.runtimeEvents,
    proposals: Object.freeze(
      snapshot.proposals.map((row) => {
        const { quantity: _quantity, fees: _fees, ...rest } = row;
        return Object.freeze({
          ...rest,
          quantity: row.quantity.toString(),
          fees: row.fees.toString(),
        });
      }),
    ),
    usage: Object.freeze(
      snapshot.usage.map((row) => {
        const { spentThisPeriod: _spentThisPeriod, spentTotal: _spentTotal, ...rest } = row;
        return Object.freeze({
          ...rest,
          spentThisPeriod: row.spentThisPeriod.toString(),
          spentTotal: row.spentTotal.toString(),
        });
      }),
    ),
    mandates: Object.freeze(
      snapshot.mandates.map((row) => {
        const { budget: _budget, ...rest } = row;
        return Object.freeze({
          ...rest,
          budget: serializeBudget(row.budget),
        });
      }),
    ),
  });
}

export function deserializeAgentRuntimeSnapshot(raw: SerializedAgentRuntimeSnapshot): AgentRuntimeSnapshot {
  return Object.freeze({
    agents: raw.agents,
    conversations: raw.conversations,
    messages: raw.messages,
    toolEvents: raw.toolEvents,
    memories: raw.memories,
    personalization: raw.personalization,
    runtimeEvents: raw.runtimeEvents,
    proposals: Object.freeze(
      raw.proposals.map((row) => {
        const { quantity: _quantity, fees: _fees, ...rest } = row;
        return Object.freeze({
          ...rest,
          quantity: BigInt(row.quantity),
          fees: BigInt(row.fees),
        });
      }),
    ),
    usage: Object.freeze(
      raw.usage.map((row) => {
        const { spentThisPeriod: _spentThisPeriod, spentTotal: _spentTotal, ...rest } = row;
        return Object.freeze({
          ...rest,
          mandateId: asUserAgentMandateId(String(row.mandateId)),
          spentThisPeriod: BigInt(row.spentThisPeriod),
          spentTotal: BigInt(row.spentTotal),
        });
      }),
    ),
    mandates: Object.freeze(
      raw.mandates.map((row) => {
        const { budget: _budget, ...rest } = row;
        return Object.freeze({
          ...rest,
          budget: deserializeBudget(row.budget),
        });
      }),
    ),
  });
}
