import type { ForwardAlphaRealityStatus, InvestmentPerformanceProofStatus } from './taxonomy.ts';
import type { AlphaEvidenceSourceKind } from './taxonomy.ts';

const PERFORMANCE_PROOF: ReadonlySet<ForwardAlphaRealityStatus> = new Set([
  'FORWARD_ALPHA_SUPPORTED',
  'FORWARD_ROBUSTNESS_SUPPORTED',
  'PAPER_IMPLEMENTATION_SUPPORTED',
  'LIVE_ALPHA_SUPPORTED',
]);

const NON_GENUINE_SOURCES: ReadonlySet<AlphaEvidenceSourceKind> = new Set([
  'ARCHITECTURE_ONLY',
  'SYNTHETIC_HARNESS',
  'HISTORICAL_FIXTURE',
]);

/**
 * Synthetic or historical fixtures must never masquerade as investment-performance proof.
 */
export function clampRealityStatusForSourceKind(
  status: ForwardAlphaRealityStatus,
  sourceKind: AlphaEvidenceSourceKind,
): ForwardAlphaRealityStatus {
  if (!NON_GENUINE_SOURCES.has(sourceKind)) {
    return status;
  }
  if (!PERFORMANCE_PROOF.has(status)) {
    return status;
  }
  if (status === 'FORWARD_ALPHA_SUPPORTED' || status === 'FORWARD_EDGE_CANDIDATE') {
    return 'FORWARD_CAMPAIGN_READY';
  }
  return 'FORWARD_CAMPAIGN_READY';
}

export function sourceKindForbiddenForPerformanceProof(sourceKind: AlphaEvidenceSourceKind): boolean {
  return NON_GENUINE_SOURCES.has(sourceKind);
}

export function isInvestmentPerformanceProofStatus(
  status: ForwardAlphaRealityStatus,
): status is InvestmentPerformanceProofStatus {
  return PERFORMANCE_PROOF.has(status);
}
