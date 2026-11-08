import {
  HELIOS_ALPHA13_PORTFOLIO_FORWARD_EVIDENCE_BLOCKED,
  HELIOS_ALPHA13_PORTFOLIO_FORWARD_EVIDENCE_QUALIFIED,
} from './taxonomy.ts';
import { assertNoCapitalDoubleCount } from './allocation.ts';
import type { PortfolioForwardEvidence } from './types.ts';

export type Alpha13QualificationPolicy = {
  /** Minimum portfolio active return (bps) after combination. */
  readonly minPortfolioActiveReturnBps: number;
  /** Maximum allowed alpha double-count residue (bps). */
  readonly maxAlphaDoubleCountBps: number;
  /** Minimum breadth score distinguishing independent edges. */
  readonly minBreadthScoreBps: number;
  readonly maxPortfolioDrawdownBps: number;
};

export const defaultAlpha13QualificationPolicy = (): Alpha13QualificationPolicy =>
  Object.freeze({
    minPortfolioActiveReturnBps: 50,
    maxAlphaDoubleCountBps: 250,
    minBreadthScoreBps: 4_000,
    maxPortfolioDrawdownBps: 2_500,
  });

export type Alpha13QualificationResult = {
  readonly qualified: boolean;
  readonly marker:
    | typeof HELIOS_ALPHA13_PORTFOLIO_FORWARD_EVIDENCE_QUALIFIED
    | typeof HELIOS_ALPHA13_PORTFOLIO_FORWARD_EVIDENCE_BLOCKED;
  readonly blockers: readonly string[];
  readonly evidence: PortfolioForwardEvidence;
};

export function evaluateAlpha13PortfolioForwardEvidenceQualification(
  evidence: PortfolioForwardEvidence,
  policy: Alpha13QualificationPolicy = defaultAlpha13QualificationPolicy(),
): Alpha13QualificationResult {
  const blockers: string[] = [];
  const capitalBlock = assertNoCapitalDoubleCount(evidence.allocation);
  if (capitalBlock) {
    blockers.push(capitalBlock);
  }
  if (evidence.capitalDoubleCountDetected) {
    blockers.push('CAPITAL_DOUBLE_COUNT_DETECTED');
  }
  if (evidence.alphaDoubleCountBlockedBps > policy.maxAlphaDoubleCountBps) {
    blockers.push('ALPHA_DOUBLE_COUNT_EXCESS');
  }
  if (evidence.activeReturnBps < policy.minPortfolioActiveReturnBps) {
    blockers.push('PORTFOLIO_ACTIVE_RETURN_TOO_LOW');
  }
  if (evidence.maxDrawdownBps > policy.maxPortfolioDrawdownBps) {
    blockers.push('PORTFOLIO_DRAWDOWN_EXCEEDED');
  }
  if (evidence.alphaBreadth.breadthScoreBps < policy.minBreadthScoreBps) {
    blockers.push('ALPHA_BREADTH_INSUFFICIENT');
  }
  if (evidence.alphaBreadth.classification === 'ONE_EDGE_MANY_EXPRESSIONS') {
    blockers.push('CORRELATED_EDGE_EXPRESSIONS');
  }

  const qualified = blockers.length === 0;
  return Object.freeze({
    qualified,
    marker: qualified
      ? HELIOS_ALPHA13_PORTFOLIO_FORWARD_EVIDENCE_QUALIFIED
      : HELIOS_ALPHA13_PORTFOLIO_FORWARD_EVIDENCE_BLOCKED,
    blockers: Object.freeze(blockers),
    evidence,
  });
}

export function alpha13PortfolioForwardEvidenceMarker(
  result: Alpha13QualificationResult,
): typeof HELIOS_ALPHA13_PORTFOLIO_FORWARD_EVIDENCE_QUALIFIED | typeof HELIOS_ALPHA13_PORTFOLIO_FORWARD_EVIDENCE_BLOCKED {
  return result.marker;
}
