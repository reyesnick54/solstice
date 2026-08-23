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
      snapshot.mandates.map((row) => {
        const { maxProposalAmount, dailyProposalAggregate, ...budgetRest } = row.budget;
        const { economicMandateRef, ...mandateRest } = row;
        return Object.freeze({
          ...mandateRest,
          ...(economicMandateRef !== undefined ? { economicMandateRef } : {}),
          budget: Object.freeze({
            ...budgetRest,
            perTransaction: budgetRest.perTransaction.toString(),
            perPeriod: budgetRest.perPeriod.toString(),
            ...(maxProposalAmount !== undefined ? { maxProposalAmount: maxProposalAmount.toString() } : {}),
            ...(dailyProposalAggregate !== undefined
              ? { dailyProposalAggregate: dailyProposalAggregate.toString() }
              : {}),
          }),
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
      raw.mandates.map((row) => {
        const { maxProposalAmount, dailyProposalAggregate, ...budgetRest } = row.budget;
        const { economicMandateRef, ...mandateRest } = row;
        return Object.freeze({
          ...mandateRest,
          ...(economicMandateRef !== undefined ? { economicMandateRef } : {}),
          budget: Object.freeze({
            ...budgetRest,
            perTransaction: BigInt(budgetRest.perTransaction),
            perPeriod: BigInt(budgetRest.perPeriod),
            ...(maxProposalAmount !== undefined ? { maxProposalAmount: BigInt(maxProposalAmount) } : {}),
            ...(dailyProposalAggregate !== undefined
              ? { dailyProposalAggregate: BigInt(dailyProposalAggregate) }
              : {}),
          }),
        });
      }),
    ),
  });
}
