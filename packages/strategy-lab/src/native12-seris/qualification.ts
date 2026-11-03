import {
  HELIOS_NATIVE_SERIS_STRATEGY_AUTOPILOT_BLOCKED,
  HELIOS_NATIVE_SERIS_STRATEGY_AUTOPILOT_QUALIFIED,
} from './taxonomy.ts';
import { HELIOS_NATIVE12_SERIS_UPSTREAM } from './upstream-attribution.ts';

export type SerisNative12QualificationChecks = {
  readonly aiProposalBecomesGenomeCandidate: boolean;
  readonly sourceReviewEnforced: boolean;
  readonly genomeValidationRequired: boolean;
  readonly featureValidityRequired: boolean;
  readonly historicalHoldoutWalkForwardOrchestrated: boolean;
  readonly durableRunHistory: boolean;
  readonly marketContextInjection: boolean;
  readonly researchAutopilotNotFinancialAutopilot: boolean;
  readonly shadowPaperSimulationOnly: boolean;
  readonly liveExecutionForbidden: boolean;
  readonly upstreamAttributionPresent: boolean;
};

export type SerisNative12QualificationResult = {
  readonly marker:
    | typeof HELIOS_NATIVE_SERIS_STRATEGY_AUTOPILOT_QUALIFIED
    | typeof HELIOS_NATIVE_SERIS_STRATEGY_AUTOPILOT_BLOCKED;
  readonly qualified: boolean;
  readonly blockers: readonly string[];
  readonly upstreamReferenceSha: string;
};

export function evaluateSerisNative12Qualification(
  checks: SerisNative12QualificationChecks,
): SerisNative12QualificationResult {
  const blockers: string[] = [];
  for (const [key, passed] of Object.entries(checks) as [keyof SerisNative12QualificationChecks, boolean][]) {
    if (!passed) {
      blockers.push(String(key));
    }
  }
  return Object.freeze({
    marker:
      blockers.length === 0
        ? HELIOS_NATIVE_SERIS_STRATEGY_AUTOPILOT_QUALIFIED
        : HELIOS_NATIVE_SERIS_STRATEGY_AUTOPILOT_BLOCKED,
    qualified: blockers.length === 0,
    blockers: Object.freeze(blockers),
    upstreamReferenceSha: HELIOS_NATIVE12_SERIS_UPSTREAM.referenceSha,
  });
}
