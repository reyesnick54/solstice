/**
 * Leave-one-source-out contribution diagnostics (non-causal).
 */

import type { EarningsEvidenceContribution, ProbabilisticEarningsState } from './types.ts';
import type { EarningsExpertKind } from './taxonomy.ts';
import { subEarningsDecimal } from './numeric.ts';

export function buildEvidenceContributions(input: {
  readonly full: ProbabilisticEarningsState;
  readonly leaveOneOut: Readonly<Record<EarningsExpertKind, ProbabilisticEarningsState | null>>;
  readonly weightShares: Readonly<Record<EarningsExpertKind, number>>;
}): readonly EarningsEvidenceContribution[] {
  const experts = Object.keys(input.leaveOneOut) as EarningsExpertKind[];
  return Object.freeze(
    experts.map((expertKind) => {
      const reduced = input.leaveOneOut[expertKind];
      const epsDelta =
        reduced === null
          ? null
          : subEarningsDecimal(input.full.nextQuarterEps.pointEstimate, reduced.nextQuarterEps.pointEstimate);
      const revenueDelta =
        reduced === null
          ? null
          : subEarningsDecimal(
              input.full.nextQuarterRevenue.pointEstimate,
              reduced.nextQuarterRevenue.pointEstimate,
            );
      const beatProbabilityDelta =
        reduced === null ? null : input.full.beatProbability.probability - reduced.beatProbability.probability;
      return Object.freeze({
        expertKind,
        diagnosticMethod: 'leave_one_source_out',
        epsDelta,
        revenueDelta,
        beatProbabilityDelta,
        weightShare: input.weightShares[expertKind] ?? 0,
        nonCausalDisclaimer: 'NOT_A_CAUSAL_ATTRIBUTION',
      });
    }),
  );
}
