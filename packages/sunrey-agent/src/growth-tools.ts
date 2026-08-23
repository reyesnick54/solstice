/**
 * Agent-facing tool names for product Growth Plans / Financial Proposals.
 * Implementation lives in packages/platform. This package only consumes a
 * structured port and cannot invent executable proposal ids.
 */

export type GrowthToolPort = {
  getPlan(planId: string): unknown | undefined;
  getProposal(proposalId: string): unknown | undefined;
  explainProposal(proposalId: string): unknown | undefined;
  modifyProposal(proposalId: string, patch: Record<string, unknown>): unknown | undefined;
  alternatives(proposalId: string): unknown | undefined;
};

export type GrowthToolFailure = {
  readonly code: 'UNKNOWN_PLAN' | 'FABRICATED_PROPOSAL_ID' | 'AGENT_CANNOT_EXECUTE';
  readonly message: string;
};

export function getGrowthPlan(
  port: GrowthToolPort,
  planId: string,
): { readonly ok: true; readonly value: unknown } | { readonly ok: false; readonly error: GrowthToolFailure } {
  const plan = port.getPlan(planId);
  if (!plan) {
    return { ok: false, error: { code: 'UNKNOWN_PLAN', message: 'growth plan id is unknown' } };
  }
  return { ok: true, value: plan };
}

export function getProposal(
  port: GrowthToolPort,
  proposalId: string,
): { readonly ok: true; readonly value: unknown } | { readonly ok: false; readonly error: GrowthToolFailure } {
  const proposal = port.getProposal(proposalId);
  if (!proposal) {
    return {
      ok: false,
      error: {
        code: 'FABRICATED_PROPOSAL_ID',
        message: 'agents cannot invent executable proposal ids',
      },
    };
  }
  return { ok: true, value: proposal };
}

export function explainProposal(
  port: GrowthToolPort,
  proposalId: string,
): { readonly ok: true; readonly value: unknown } | { readonly ok: false; readonly error: GrowthToolFailure } {
  const loaded = getProposal(port, proposalId);
  if (!loaded.ok) return loaded;
  return { ok: true, value: port.explainProposal(proposalId) ?? loaded.value };
}

export function requestProposalModification(
  port: GrowthToolPort,
  proposalId: string,
  patch: Record<string, unknown>,
): { readonly ok: true; readonly value: unknown } | { readonly ok: false; readonly error: GrowthToolFailure } {
  const loaded = getProposal(port, proposalId);
  if (!loaded.ok) return loaded;
  return { ok: true, value: port.modifyProposal(proposalId, patch) };
}

export function compareAlternatives(
  port: GrowthToolPort,
  proposalId: string,
): { readonly ok: true; readonly value: unknown } | { readonly ok: false; readonly error: GrowthToolFailure } {
  const loaded = getProposal(port, proposalId);
  if (!loaded.ok) return loaded;
  return { ok: true, value: port.alternatives(proposalId) };
}

export function agentCannotExecuteProposal(): GrowthToolFailure {
  return { code: 'AGENT_CANNOT_EXECUTE', message: 'agent tools cannot execute a financial proposal' };
}
