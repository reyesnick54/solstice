import { asUserAgentMandateId } from './ids.ts';
import type { AgentRuntimeSnapshot } from './types.ts';

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
  readonly mandates: readonly (Omit<AgentRuntimeSnapshot['mandates'][number], 'budget'> & {
    readonly budget: Omit<AgentRuntimeSnapshot['mandates'][number]['budget'], 'perTransaction' | 'perPeriod' | 'maxProposalAmount' | 'dailyProposalAggregate'> & {
      readonly perTransaction: string;
      readonly perPeriod: string;
      readonly maxProposalAmount?: string;
      readonly dailyProposalAggregate?: string;
    };
  })[];
};

function omitBudgetAmounts<T extends { readonly perTransaction: unknown; readonly perPeriod: unknown }>(
  budget: T,
): Omit<T, 'perTransaction' | 'perPeriod' | 'maxProposalAmount' | 'dailyProposalAggregate'> {
  const { perTransaction: _perTransaction, perPeriod: _perPeriod, ...rest } = budget as T & {
    readonly maxProposalAmount?: unknown;
    readonly dailyProposalAggregate?: unknown;
  };
  const { maxProposalAmount: _max, dailyProposalAggregate: _daily, ...kept } = rest;
  return kept as Omit<T, 'perTransaction' | 'perPeriod' | 'maxProposalAmount' | 'dailyProposalAggregate'>;
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
      snapshot.proposals.map((row) =>
        Object.freeze({
          ...row,
          quantity: row.quantity.toString(),
          fees: row.fees.toString(),
        }),
      ),
    ),
    usage: Object.freeze(
      snapshot.usage.map((row) =>
        Object.freeze({
          ...row,
          spentThisPeriod: row.spentThisPeriod.toString(),
          spentTotal: row.spentTotal.toString(),
        }),
      ),
    ),
    mandates: Object.freeze(
      snapshot.mandates.map((row) =>
        Object.freeze({
          ...row,
          budget: Object.freeze({
            ...omitBudgetAmounts(row.budget),
            perTransaction: row.budget.perTransaction.toString(),
            perPeriod: row.budget.perPeriod.toString(),
            ...(row.budget.maxProposalAmount !== undefined
              ? { maxProposalAmount: row.budget.maxProposalAmount.toString() }
              : {}),
            ...(row.budget.dailyProposalAggregate !== undefined
              ? { dailyProposalAggregate: row.budget.dailyProposalAggregate.toString() }
              : {}),
          }),
        }),
      ),
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
      raw.proposals.map((row) =>
        Object.freeze({
          ...row,
          quantity: BigInt(row.quantity),
          fees: BigInt(row.fees),
        }),
      ),
    ),
    usage: Object.freeze(
      raw.usage.map((row) =>
        Object.freeze({
          ...row,
          mandateId: asUserAgentMandateId(String(row.mandateId)),
          spentThisPeriod: BigInt(row.spentThisPeriod),
          spentTotal: BigInt(row.spentTotal),
        }),
      ),
    ),
    mandates: Object.freeze(
      raw.mandates.map((row) =>
        Object.freeze({
          ...row,
          budget: Object.freeze({
            ...omitBudgetAmounts(row.budget),
            perTransaction: BigInt(row.budget.perTransaction),
            perPeriod: BigInt(row.budget.perPeriod),
            ...(row.budget.maxProposalAmount !== undefined
              ? { maxProposalAmount: BigInt(row.budget.maxProposalAmount) }
              : {}),
            ...(row.budget.dailyProposalAggregate !== undefined
              ? { dailyProposalAggregate: BigInt(row.budget.dailyProposalAggregate) }
              : {}),
          }),
        }),
      ),
    ),
  });
}
