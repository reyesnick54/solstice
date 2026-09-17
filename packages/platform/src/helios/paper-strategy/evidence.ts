import type { EvidenceVault } from '../../../../evidence/src/vault.ts';
import type { HeliosPaperGrowProposal, HeliosPaperGrowResult, HeliosPaperPosition, HeliosPaperResearchResult } from './types.ts';
import type { HeliosStrategyDecision } from './types.ts';

export function sealPaperStrategyEvidence(
  vault: EvidenceVault | undefined,
  kind: string,
  payload: Record<string, unknown>,
): string | null {
  if (!vault) {
    return null;
  }
  const sealed = vault.seal(kind, payload);
  return sealed?.evidenceId ?? null;
}

export function sealResearchPhase(
  vault: EvidenceVault | undefined,
  research: HeliosPaperResearchResult,
  decision: HeliosStrategyDecision,
): readonly string[] {
  const refs: string[] = [];
  const researchRef = sealPaperStrategyEvidence(vault, 'HELIOS_PAPER_STRATEGY_RESEARCH', {
    researchId: research.researchId,
    strategyId: research.strategyId,
    evidenceRefs: research.evidenceRefs,
    referencePrice: research.referencePrice,
    informationTimeObservedAt: research.informationTimeObservedAt,
    deterministic: true,
  });
  if (researchRef) refs.push(researchRef);
  const decisionRef = sealPaperStrategyEvidence(vault, 'HELIOS_PAPER_STRATEGY_DECISION', {
    strategyId: decision.strategyId,
    action: decision.action,
    ruleVersion: decision.ruleVersion,
    referenceMidMinor: decision.referenceMidMinor,
    rationale: decision.rationale,
  });
  if (decisionRef) refs.push(decisionRef);
  return Object.freeze(refs);
}

export function sealProposalPhase(vault: EvidenceVault | undefined, proposal: HeliosPaperGrowProposal): string | null {
  return sealPaperStrategyEvidence(vault, 'HELIOS_PAPER_STRATEGY_PROPOSAL', {
    proposalId: proposal.proposalId,
    workOrderId: proposal.workOrderId,
    environment: proposal.environment,
    direction: proposal.direction,
    instrumentId: proposal.instrumentId,
    grantsFinancialEffect: false,
  });
}

export function sealExecutionPhase(
  vault: EvidenceVault | undefined,
  input: {
    readonly proposalId: string;
    readonly orderId: string;
    readonly fillId: string | null;
    readonly environment: 'PAPER';
    readonly simulation: true;
    readonly providerSourced: false;
  },
): string | null {
  return sealPaperStrategyEvidence(vault, 'HELIOS_PAPER_STRATEGY_EXECUTION', input);
}

export function sealPositionPhase(vault: EvidenceVault | undefined, position: HeliosPaperPosition): string | null {
  return sealPaperStrategyEvidence(vault, 'HELIOS_PAPER_STRATEGY_POSITION', {
    positionId: position.positionId,
    environment: position.environment,
    liveProviderPosition: false,
    status: position.status,
    instrumentId: position.instrumentId,
  });
}

export function sealGrowResultPhase(vault: EvidenceVault | undefined, result: HeliosPaperGrowResult): string | null {
  return sealPaperStrategyEvidence(vault, 'HELIOS_PAPER_STRATEGY_GROW_RESULT', {
    cycleId: result.cycleId,
    outcome: result.outcome,
    attributionClass: result.attributionClass,
    grossResult: result.grossResult,
    netResult: result.netResult,
  });
}
