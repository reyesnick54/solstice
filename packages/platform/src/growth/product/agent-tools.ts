/**
 * Structured tool access for SunRey Agent.
 * The agent consumes canonical plans/proposals. It cannot invent ids or execute.
 */

import type { ProductGrowthService } from './service.ts';
import type { FinancialProposal, GrowProductFailure, GrowthProductActor, ProductGrowthPlan } from './types.ts';

export type GrowthAgentToolName =
  | 'getGrowthPlan'
  | 'getProposal'
  | 'explainProposal'
  | 'requestProposalModification'
  | 'compareAlternatives';

export function getGrowthPlan(
  service: ProductGrowthService,
  actor: GrowthProductActor,
  planId: string,
): { readonly ok: true; readonly value: ProductGrowthPlan } | { readonly ok: false; readonly error: GrowProductFailure } {
  return service.getPlan(asAgent(actor), planId);
}

export function getProposal(
  service: ProductGrowthService,
  actor: GrowthProductActor,
  proposalId: string,
): { readonly ok: true; readonly value: FinancialProposal } | { readonly ok: false; readonly error: GrowProductFailure } {
  return service.getProposal(asAgent(actor), proposalId);
}

export function explainProposal(
  service: ProductGrowthService,
  actor: GrowthProductActor,
  proposalId: string,
):
  | { readonly ok: true; readonly value: FinancialProposal['explanation'] }
  | { readonly ok: false; readonly error: GrowProductFailure } {
  const proposal = service.getProposal(asAgent(actor), proposalId);
  if (!proposal.ok) return proposal;
  return { ok: true, value: proposal.value.explanation };
}

export function requestProposalModification(
  service: ProductGrowthService,
  actor: GrowthProductActor,
  proposalId: string,
  patch: { readonly amountMinorUnits?: string; readonly riskProfile?: FinancialProposal['risk'] },
): { readonly ok: true; readonly value: FinancialProposal } | { readonly ok: false; readonly error: GrowProductFailure } {
  return service.modifyProposal(asAgent(actor), proposalId, patch);
}

export function compareAlternatives(
  service: ProductGrowthService,
  actor: GrowthProductActor,
  proposalId: string,
):
  | { readonly ok: true; readonly value: FinancialProposal['alternatives'] }
  | { readonly ok: false; readonly error: GrowProductFailure } {
  const proposal = service.getProposal(asAgent(actor), proposalId);
  if (!proposal.ok) return proposal;
  return { ok: true, value: proposal.value.alternatives };
}

function asAgent(actor: GrowthProductActor): GrowthProductActor {
  return { ...actor, principalKind: 'AGENT' };
}
