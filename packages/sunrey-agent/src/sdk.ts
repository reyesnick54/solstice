import type { UserAgentMandateEngine } from './engine.ts';
import type { AgentActivityReport, AgentTransactionProposal, UserAgentMandate } from './types.ts';

export function createAgentMandate(engine: UserAgentMandateEngine, input: Parameters<UserAgentMandateEngine['createMandate']>[0]) {
  return engine.createMandate(input);
}

export function getAgentMandate(engine: UserAgentMandateEngine, mandateId: string): UserAgentMandate | undefined {
  return engine.getMandate(mandateId);
}

export function revokeAgentMandate(engine: UserAgentMandateEngine, mandateId: string, actorId: string) {
  return engine.revokeMandate({ mandateId, actorId });
}

export function getAgentProposal(engine: UserAgentMandateEngine, proposalId: string): AgentTransactionProposal | undefined {
  return engine.getProposal(proposalId);
}

export function approveAgentProposal(
  engine: UserAgentMandateEngine,
  input: Parameters<UserAgentMandateEngine['approveProposal']>[0],
) {
  return engine.approveProposal(input);
}

export function getAgentActivity(engine: UserAgentMandateEngine, walletId: string): AgentActivityReport {
  return engine.activity(walletId);
}
