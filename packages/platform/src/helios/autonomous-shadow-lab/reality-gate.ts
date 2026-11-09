import {
  defaultSimulationRealityGateInput,
  resolveAlphaRealityGate,
} from '../forward-alpha-evidence/reality-gate.ts';
import { isInvestmentPerformanceProofStatus } from '../forward-alpha-evidence/synthetic-guard.ts';

import { AUTONOMOUS_SHADOW_LAB_ARCHITECTURE_QUALIFIED } from './taxonomy.ts';
import type { ShadowLabRealityGateResult } from './types.ts';

/**
 * Shadow-lab qualification may prove AUTONOMOUS_SHADOW_LAB_ARCHITECTURE_QUALIFIED only.
 * FORWARD_ALPHA_SUPPORTED requires genuine prospective observations via AlphaRealityGate.
 */
export function evaluateShadowLabRealityGate(
  longRunEvidenceChainIntact: boolean,
  sourceKind: 'SYNTHETIC_HARNESS' | 'GENUINE_FORWARD_CAMPAIGN' = 'SYNTHETIC_HARNESS',
): ShadowLabRealityGateResult {
  const notes: string[] = [];
  const gate = resolveAlphaRealityGate(
    defaultSimulationRealityGateInput({
      sourceKind,
      architectureComplete: true,
      forwardCampaignInfrastructureReady: true,
      chronologicalForwardDecisionCount: sourceKind === 'GENUINE_FORWARD_CAMPAIGN' ? 50 : 0,
    }),
  );

  const architectureQualified =
    longRunEvidenceChainIntact && gate.status !== undefined && !gate.investmentPerformanceClaimed;

  if (sourceKind === 'SYNTHETIC_HARNESS') {
    notes.push('harness uses SYNTHETIC_HARNESS — cannot claim FORWARD_ALPHA_SUPPORTED');
    if (isInvestmentPerformanceProofStatus(gate.status)) {
      notes.push('unexpected investment proof from synthetic harness');
    }
  }

  notes.push(AUTONOMOUS_SHADOW_LAB_ARCHITECTURE_QUALIFIED);

  return Object.freeze({
    architectureQualified,
    forwardAlphaSupportedClaimed: isInvestmentPerformanceProofStatus(gate.status),
    alphaRealityStatus: gate.status,
    notes: Object.freeze(notes),
  });
}
