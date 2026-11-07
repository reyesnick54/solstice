import type { UtcInstant } from '@solstice/domain';
import { clampBps } from './numeric.ts';
import { HELIOS_EXEC07_TCA_SCHEMA } from './taxonomy.ts';
import type {
  AlgorithmExecutionProfile,
  Exec07ExecutionPolicyNicheEvidence,
  Exec07RouterLearningHint,
  ExecutionQualityReport,
  VenueExecutionProfile,
} from './types.ts';

/**
 * Historically validated execution-quality evidence for EXEC05 routing consumption.
 * Simulation / measurement only — does not re-score regulatory compatibility.
 */
export function buildExec05RouterLearningHints(input: {
  readonly reports: readonly ExecutionQualityReport[];
  readonly computedAt: UtcInstant;
}): readonly Exec07RouterLearningHint[] {
  return Object.freeze(
    input.reports
      .filter((row) => row.validated)
      .map((row) =>
        Object.freeze({
          schema: HELIOS_EXEC07_TCA_SCHEMA,
          evidenceKind: 'HELIOS_EXEC07_ROUTER_LEARNING_HINT' as const,
          venueId: row.venueId,
          providerId: row.providerId,
          instrumentId: row.instrumentId,
          implementationShortfallBps: row.transactionCost.implementationShortfallBps,
          fillRateBps: row.transactionCost.operational.fillRateBps,
          validated: true,
          usableByExec05Router: true as const,
          computedAt: input.computedAt,
        }),
      ),
  );
}

function qualityScoreBps(profile: Pick<AlgorithmExecutionProfile, 'avgImplementationShortfallBps' | 'avgFillRateBps'>): number {
  const shortfall = profile.avgImplementationShortfallBps ?? 0;
  const fill = profile.avgFillRateBps;
  const costPenalty = Math.min(5000, Math.max(0, shortfall));
  return clampBps(fill - costPenalty);
}

/**
 * EVOL13 may learn execution-policy performance by niche without coupling to investment-signal evolution.
 */
export function buildEvol13ExecutionPolicyNicheEvidence(input: {
  readonly nicheKey: string;
  readonly profiles: readonly AlgorithmExecutionProfile[];
  readonly computedAt: UtcInstant;
}): readonly Exec07ExecutionPolicyNicheEvidence[] {
  return Object.freeze(
    input.profiles
      .filter((row) => row.sampleCount > 0)
      .map((row) =>
        Object.freeze({
          schema: HELIOS_EXEC07_TCA_SCHEMA,
          evidenceKind: 'HELIOS_EXEC07_EXECUTION_POLICY_NICHE' as const,
          nicheKey: input.nicheKey,
          algorithmKind: row.algorithmKind,
          venueId: row.venueId ?? 'AGGREGATE',
          sampleCount: row.sampleCount,
          qualityScoreBps: qualityScoreBps(row),
          validated: row.avgImplementationShortfallBps != null,
          usableByEvol13ExecutionPolicyOnly: true as const,
          separatesInvestmentSignalEvolution: true as const,
          computedAt: input.computedAt,
        }),
      ),
  );
}

export function summarizeVenueForRouter(profile: VenueExecutionProfile): {
  readonly venueId: string;
  readonly qualityScoreBps: number;
  readonly validated: boolean;
} {
  const shortfall = profile.avgImplementationShortfallBps ?? 0;
  const score = clampBps(profile.avgFillRateBps - Math.min(5000, Math.max(0, shortfall)));
  return Object.freeze({
    venueId: profile.venueId,
    qualityScoreBps: score,
    validated: profile.benchmarkConstructionCompleteRateBps >= 8000,
  });
}
