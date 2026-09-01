import type { UtcInstant } from '../../../../domain/src/time.ts';
import type { FinancialProposal as GrowFinancialProposal } from '../types.ts';
import type { ExecutionCapability } from './taxonomy.ts';
import type { FinancialRiskProfile } from './risk-model.ts';
import { riskFromOpportunityLevel } from './risk-model.ts';
import type { OpportunityRiskLevel } from '../../growth/opportunity/taxonomy.ts';

/**
 * Canonical financial proposal view for the Grow lifecycle.
 * Separates proposal from execution instruction (GrowExecutionCommand).
 */
export type CanonicalFinancialProposal = {
  readonly proposalId: string;
  readonly version: number;
  readonly agentId: string;
  readonly proposalType: string;
  readonly summary: string;
  readonly recommendedAction: string;
  readonly amount: GrowFinancialProposal['amount'];
  readonly currency: string;
  readonly allocation: readonly { readonly label: string; readonly weightBps: number }[];
  readonly evidence: readonly string[];
  readonly risks: FinancialRiskProfile;
  readonly assumptions: readonly string[];
  readonly fees: readonly string[];
  readonly expectedImpact: GrowFinancialProposal['scenario'];
  readonly confidence: number | null;
  readonly expiresAt: UtcInstant;
  readonly requiredApprovals: readonly string[];
  readonly executionCapability: ExecutionCapability;
  readonly provider: string | null;
  readonly serverOwned: true;
  readonly isExecutionInstruction: false;
  readonly projectedNotRealized: true;
};

export function canonicalFinancialProposalFrom(
  proposal: GrowFinancialProposal,
  agentId = 'grow_orchestrator',
): CanonicalFinancialProposal {
  const riskClass = proposalRiskClass(proposal);
  return Object.freeze({
    proposalId: proposal.proposalId,
    version: proposal.version,
    agentId,
    proposalType: proposal.proposalType,
    summary: proposal.explainability.whyThis,
    recommendedAction: proposal.intendedAction,
    amount: proposal.amount,
    currency: proposal.amount.currency,
    allocation: Object.freeze(
      proposal.instrumentId
        ? [{ label: proposal.instrumentId, weightBps: 10_000 }]
        : [{ label: proposal.sourceAccountId, weightBps: 10_000 }],
    ),
    evidence: Object.freeze([...proposal.explainability.supportingFacts, ...proposal.opportunityIds]),
    risks: riskFromOpportunityLevel(riskClass),
    assumptions: Object.freeze([...proposal.assumptions]),
    fees: Object.freeze([]),
    expectedImpact: proposal.scenario,
    confidence: proposal.explainability.resultKind === 'PROJECTION' ? null : null,
    expiresAt: proposal.expiresAt,
    requiredApprovals: Object.freeze([
      proposal.requiredAuthAssurance,
      proposal.suitability === 'SUITABLE' ? 'SUITABILITY_CLEAR' : `SUITABILITY_${proposal.suitability}`,
      'KERNEL_POLICY',
    ]),
    executionCapability: executionCapabilityForProposal(proposal),
    provider: proposal.instrumentId ? 'SIMULATION_SANDBOX' : null,
    serverOwned: true,
    isExecutionInstruction: false,
    projectedNotRealized: true,
  });
}

function proposalRiskClass(proposal: GrowFinancialProposal): OpportunityRiskLevel {
  if (proposal.proposalType === 'INVESTMENT_BUY' || proposal.proposalType === 'INVESTMENT_SELL') {
    return 'UNCERTAIN_MARKET';
  }
  return 'LOW';
}

function executionCapabilityForProposal(proposal: GrowFinancialProposal): ExecutionCapability {
  if (proposal.suitability !== 'SUITABLE') {
    return 'UNAVAILABLE';
  }
  if (proposal.proposalType === 'INVESTMENT_BUY' || proposal.proposalType === 'INVESTMENT_SELL') {
    return 'PROVIDER_REQUIRED';
  }
  return 'USER_CONFIRMATION_REQUIRED';
}

export function materialProposalTermsChanged(
  before: GrowFinancialProposal,
  after: GrowFinancialProposal,
): boolean {
  return (
    before.contentHash !== after.contentHash ||
    before.amount.minorUnits !== after.amount.minorUnits ||
    before.sourceAccountId !== after.sourceAccountId ||
    before.destinationAccountId !== after.destinationAccountId ||
    before.instrumentId !== after.instrumentId ||
    before.version !== after.version
  );
}
