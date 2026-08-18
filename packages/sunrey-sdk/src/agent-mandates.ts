/**
 * Chunk 98 SDK adapter. These helpers call the canonical
 * packages/sunrey-agent engine. They do not create a second authority
 * system or let developer credentials sign user funds.
 */
export {
  approveAgentProposal,
  createAgentMandate,
  getAgentActivity,
  getAgentMandate,
  getAgentProposal,
  revokeAgentMandate,
  UserAgentMandateEngine,
} from '../../sunrey-agent/src/index.ts';
export type {
  AgentActivityReport,
  AgentTransactionProposal,
  UserAgentMandate,
} from '../../sunrey-agent/src/index.ts';
