import type {
  AgentActivityEntry,
  AgentExecutionReceipt,
  AgentMandateRevocation,
  AgentMandateUsage,
  AgentSafetyEvent,
  AgentTransactionProposal,
  UserAgent,
  UserAgentMandate,
} from './types.ts';

export class InMemoryAgentMandateStore {
  readonly agents = new Map<string, UserAgent>();
  readonly mandates = new Map<string, UserAgentMandate>();
  readonly proposals = new Map<string, AgentTransactionProposal>();
  readonly usage = new Map<string, AgentMandateUsage>();
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

  mandatesForWallet(walletId: string): UserAgentMandate[] {
    return [...this.mandates.values()].filter((item) => item.owner.walletId === walletId);
  }
}
