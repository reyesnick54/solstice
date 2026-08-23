import type {
  AgentActivityEntry,
  AgentConversation,
  AgentExecutionReceipt,
  AgentMandateRevocation,
  AgentMandateUsage,
  AgentMemory,
  AgentMessage,
  AgentPersonalization,
  AgentRuntimeEvent,
  AgentRuntimeSnapshot,
  AgentSafetyEvent,
  AgentToolEvent,
  AgentTransactionProposal,
  UserAgent,
  UserAgentMandate,
} from './types.ts';

export class InMemoryAgentMandateStore {
  readonly agents = new Map<string, UserAgent>();
  readonly mandates = new Map<string, UserAgentMandate>();
  readonly proposals = new Map<string, AgentTransactionProposal>();
  readonly usage = new Map<string, AgentMandateUsage>();
  readonly conversations = new Map<string, AgentConversation>();
  readonly messages = new Map<string, AgentMessage>();
  readonly toolEvents = new Map<string, AgentToolEvent>();
  readonly memories = new Map<string, AgentMemory>();
  readonly personalization = new Map<string, AgentPersonalization>();
  readonly runtimeEvents: AgentRuntimeEvent[] = [];
  readonly revocations: AgentMandateRevocation[] = [];
  readonly receipts: AgentExecutionReceipt[] = [];
  readonly safety: AgentSafetyEvent[] = [];
  readonly activity: AgentActivityEntry[] = [];
  readonly usedApprovalNonces = new Set<string>();

  putAgent(agent: UserAgent): void {
    this.agents.set(agent.agentId, agent);
  }

  putMandate(mandate: UserAgentMandate): void {
    this.mandates.set(mandate.mandateId, mandate);
  }

  putProposal(proposal: AgentTransactionProposal): void {
    this.proposals.set(proposal.proposalId, proposal);
  }

  putUsage(usage: AgentMandateUsage): void {
    this.usage.set(usage.mandateId, usage);
  }

  putConversation(conversation: AgentConversation): void {
    this.conversations.set(conversation.conversationId, conversation);
  }

  putMessage(message: AgentMessage): void {
    this.messages.set(message.messageId, message);
  }

  putToolEvent(event: AgentToolEvent): void {
    this.toolEvents.set(event.toolEventId, event);
  }

  putMemory(memory: AgentMemory): void {
    this.memories.set(memory.memoryId, memory);
  }

  deleteMemory(memoryId: string): void {
    this.memories.delete(memoryId);
  }

  putPersonalization(prefs: AgentPersonalization): void {
    this.personalization.set(`${prefs.ownerId}:${prefs.agentId}`, prefs);
  }

  putRuntimeEvent(event: AgentRuntimeEvent): void {
    this.runtimeEvents.push(event);
  }

  mandatesForWallet(walletId: string): UserAgentMandate[] {
    return [...this.mandates.values()].filter((item) => item.owner.walletId === walletId);
  }

  agentsForOwner(ownerId: string): UserAgent[] {
    return [...this.agents.values()].filter((item) => item.ownerId === ownerId || item.owner.ownerId === ownerId);
  }

  conversationsForAgent(agentId: string, ownerId: string): AgentConversation[] {
    return [...this.conversations.values()].filter(
      (item) => item.agentId === agentId && item.ownerId === ownerId && item.status !== 'DELETED',
    );
  }

  messagesForConversation(conversationId: string): AgentMessage[] {
    return [...this.messages.values()]
      .filter((item) => item.conversationId === conversationId)
      .sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));
  }

  memoriesForAgent(agentId: string, ownerId: string): AgentMemory[] {
    return [...this.memories.values()].filter((item) => item.agentId === agentId && item.ownerId === ownerId);
  }

  snapshot(): AgentRuntimeSnapshot {
    return Object.freeze({
      agents: Object.freeze([...this.agents.values()]),
      mandates: Object.freeze([...this.mandates.values()]),
      proposals: Object.freeze([...this.proposals.values()]),
      usage: Object.freeze([...this.usage.values()]),
      conversations: Object.freeze([...this.conversations.values()]),
      messages: Object.freeze([...this.messages.values()]),
      toolEvents: Object.freeze([...this.toolEvents.values()]),
      memories: Object.freeze([...this.memories.values()]),
      personalization: Object.freeze([...this.personalization.values()]),
      runtimeEvents: Object.freeze([...this.runtimeEvents]),
    });
  }

  hydrate(snapshot: AgentRuntimeSnapshot): void {
    this.agents.clear();
    this.mandates.clear();
    this.proposals.clear();
    this.usage.clear();
    this.conversations.clear();
    this.messages.clear();
    this.toolEvents.clear();
    this.memories.clear();
    this.personalization.clear();
    this.runtimeEvents.length = 0;
    for (const agent of snapshot.agents) {
      this.putAgent(agent);
    }
    for (const mandate of snapshot.mandates) {
      this.putMandate(mandate);
    }
    for (const proposal of snapshot.proposals) {
      this.putProposal(proposal);
    }
    for (const usage of snapshot.usage) {
      this.putUsage(usage);
    }
    for (const conversation of snapshot.conversations) {
      this.putConversation(conversation);
    }
    for (const message of snapshot.messages) {
      this.putMessage(message);
    }
    for (const event of snapshot.toolEvents) {
      this.putToolEvent(event);
    }
    for (const memory of snapshot.memories) {
      this.putMemory(memory);
    }
    for (const prefs of snapshot.personalization) {
      this.putPersonalization(prefs);
    }
    for (const event of snapshot.runtimeEvents) {
      this.putRuntimeEvent(event);
    }
  }
}
