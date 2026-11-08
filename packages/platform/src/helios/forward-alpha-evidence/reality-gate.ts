import { LIVE_INVESTMENT_EXECUTION, LIVE_TRADING_ENABLED } from '@solstice/config';

import { clampRealityStatusForSourceKind, isInvestmentPerformanceProofStatus } from './synthetic-guard.ts';
import type { ForwardEvidenceProvenance } from './taxonomy.ts';
import type { AlphaRealityGateInput, ForwardAlphaRealityGateResult } from './types.ts';
import type { ForwardAlphaRealityStatus } from './taxonomy.ts';

function resolveProvenance(input: AlphaRealityGateInput): ForwardEvidenceProvenance {
  if (input.liveRegulatedCapitalEvidence && input.sourceKind === 'REGULATED_LIVE_CAPITAL') {
    return 'REGULATED_LIVE';
  }
  if (input.chronologicalForwardDecisionCount > 0 && input.sourceKind === 'GENUINE_FORWARD_CAMPAIGN') {
    return 'CHRONOLOGICAL_FORWARD';
  }
  if (input.sourceKind === 'HISTORICAL_FIXTURE') {
    return 'HISTORICAL_FIXTURE';
  }
  if (input.sourceKind === 'SYNTHETIC_HARNESS') {
    return 'SYNTHETIC';
  }
  return 'NONE';
}

/**
 * AlphaRealityGate — separates engineering qualification from evidence-derived investment status.
 */
/** AlphaRealityGate — evidence-derived status resolver (distinct from architecture marker). */
export function resolveAlphaRealityGate(input: AlphaRealityGateInput): ForwardAlphaRealityGateResult {
  const notes: string[] = [];
  let status: ForwardAlphaRealityStatus = 'ARCHITECTURE_QUALIFIED';

  if (!input.architectureComplete) {
    notes.push('ALPHA01–ALPHA14 modules incomplete');
    return Object.freeze({
      status,
      provenance: 'NONE',
      notes: Object.freeze(notes),
      engineeringQualificationOnly: true,
      investmentPerformanceClaimed: false,
    });
  }

  if (input.forwardCampaignInfrastructureReady) {
    status = 'FORWARD_CAMPAIGN_READY';
    notes.push('Prospective forward campaign infrastructure qualified (no performance claim)');
  }

  const genuineForward =
    input.sourceKind === 'GENUINE_FORWARD_CAMPAIGN' && input.chronologicalForwardDecisionCount > 0;

  if (genuineForward) {
    status = 'FORWARD_EVIDENCE_ACCUMULATING';
    notes.push('Chronological forward decisions on record');
  }

  if (genuineForward && input.preliminaryPositiveForward) {
    status = 'FORWARD_EDGE_CANDIDATE';
    notes.push('Preliminary positive forward evidence — not alpha proven');
  }

  if (genuineForward && input.statisticalPolicySatisfied && input.preliminaryPositiveForward) {
    status = 'FORWARD_ALPHA_SUPPORTED';
    notes.push('Predeclared statistical policy endpoint satisfied on genuine forward sample');
  }

  const regimesOk =
    input.robustnessRegimesRequired > 0 &&
    input.robustnessRegimesSatisfied >= input.robustnessRegimesRequired;

  if (status === 'FORWARD_ALPHA_SUPPORTED' && regimesOk) {
    status = 'FORWARD_ROBUSTNESS_SUPPORTED';
    notes.push('Required regime slices satisfied on forward evidence');
  }

  if (
    (status === 'FORWARD_ALPHA_SUPPORTED' || status === 'FORWARD_ROBUSTNESS_SUPPORTED') &&
    input.paperExecutionAfterRealisticCosts &&
    genuineForward
  ) {
    status = 'PAPER_IMPLEMENTATION_SUPPORTED';
    notes.push('Forward paper path exercised with realistic cost model');
  }

  const liveFlagsAllow =
    input.liveTradingEnabled &&
    input.liveInvestmentExecution &&
    LIVE_TRADING_ENABLED &&
    LIVE_INVESTMENT_EXECUTION;

  if (status === 'PAPER_IMPLEMENTATION_SUPPORTED' && input.liveRegulatedCapitalEvidence && liveFlagsAllow) {
    status = 'LIVE_ALPHA_SUPPORTED';
    notes.push('Regulated live-capital evidence path (requires live flags and human authorization)');
  }

  if (
    status === 'LIVE_ALPHA_SUPPORTED' &&
    (!liveFlagsAllow || !input.liveRegulatedCapitalEvidence)
  ) {
    status = 'PAPER_IMPLEMENTATION_SUPPORTED';
    notes.push('LIVE_ALPHA_SUPPORTED blocked: live flags disabled or regulated capital evidence absent');
  }

  if (status === 'LIVE_ALPHA_SUPPORTED' && !liveFlagsAllow) {
    status = input.paperExecutionAfterRealisticCosts ? 'PAPER_IMPLEMENTATION_SUPPORTED' : 'FORWARD_ALPHA_SUPPORTED';
    notes.push('LIVE_ALPHA_SUPPORTED impossible while LIVE_TRADING_ENABLED=false or LIVE_INVESTMENT_EXECUTION=false');
  }

  status = clampRealityStatusForSourceKind(status, input.sourceKind);

  if (!genuineForward && status !== 'ARCHITECTURE_QUALIFIED' && status !== 'FORWARD_CAMPAIGN_READY') {
    status = input.forwardCampaignInfrastructureReady ? 'FORWARD_CAMPAIGN_READY' : 'ARCHITECTURE_QUALIFIED';
    notes.push('No genuine forward campaign observations — status capped');
  }

  const provenance = resolveProvenance(input);

  if (LIVE_TRADING_ENABLED === false && notes.every((n) => !n.includes('LIVE_TRADING_ENABLED'))) {
    notes.push('LIVE_TRADING_ENABLED remains false in repository qualification');
  }

  const investmentPerformanceClaimed = isInvestmentPerformanceProofStatus(status);

  return Object.freeze({
    status,
    provenance,
    notes: Object.freeze(notes),
    engineeringQualificationOnly: !investmentPerformanceClaimed,
    investmentPerformanceClaimed,
  });
}

/** Architecture marker qualified does not imply alpha proven. */
export function architectureMarkerImpliesAlphaProven(status: ForwardAlphaRealityStatus): boolean {
  return isInvestmentPerformanceProofStatus(status);
}

export const AlphaRealityGate = resolveAlphaRealityGate;

export function defaultSimulationRealityGateInput(
  overrides: Partial<AlphaRealityGateInput> = {},
): AlphaRealityGateInput {
  return Object.freeze({
    architectureComplete: true,
    forwardCampaignInfrastructureReady: true,
    sourceKind: 'SYNTHETIC_HARNESS',
    chronologicalForwardDecisionCount: 0,
    preliminaryPositiveForward: false,
    statisticalPolicySatisfied: false,
    robustnessRegimesSatisfied: 0,
    robustnessRegimesRequired: 3,
    paperExecutionAfterRealisticCosts: false,
    liveRegulatedCapitalEvidence: false,
    liveTradingEnabled: false,
    liveInvestmentExecution: false,
    ...overrides,
  });
}
