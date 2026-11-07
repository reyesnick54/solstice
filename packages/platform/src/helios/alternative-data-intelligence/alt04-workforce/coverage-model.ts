import type { JobOpportunity } from '@solstice/external-data/wave6';
import type { CoverageReweightDimension } from './taxonomy.ts';
import type { JobPostingCoverageModel } from './types.ts';
import type { UtcInstant } from '@solstice/domain';

export type CoverageBenchmark = {
  readonly firmKey: string;
  readonly officialHeadcount: number | null;
  readonly industry: string | null;
  readonly geography: string | null;
  readonly establishmentClass: string | null;
};

function providerShareBps(jobs: readonly JobOpportunity[]): Readonly<Record<string, number>> {
  const counts: Record<string, number> = {};
  for (const job of jobs) {
    counts[job.providerId] = (counts[job.providerId] ?? 0) + 1;
  }
  const total = jobs.length;
  const out: Record<string, number> = {};
  for (const [providerId, count] of Object.entries(counts)) {
    out[providerId] = total > 0 ? Math.round((count * 10_000) / total) : 0;
  }
  return Object.freeze(out);
}

function reweightFromBenchmark(input: {
  readonly benchmark: CoverageBenchmark | null;
  readonly postingCount: number;
}): Readonly<Partial<Record<CoverageReweightDimension, number>>> {
  const factors: Partial<Record<CoverageReweightDimension, number>> = {};
  if (!input.benchmark) return Object.freeze(factors);

  if (input.benchmark.officialHeadcount != null && input.benchmark.officialHeadcount > 50_000) {
    factors.firm_size = 8_500;
  } else if (input.benchmark.officialHeadcount != null && input.benchmark.officialHeadcount < 500) {
    factors.firm_size = 4_500;
  }

  if (input.benchmark.geography) {
    factors.geography = 7_000;
  }
  if (input.benchmark.industry) {
    factors.industry = 6_500;
  }
  if (input.benchmark.establishmentClass) {
    factors.establishment_class = 6_000;
  }

  if (input.postingCount < 3) {
    factors.firm_size = Math.min(factors.firm_size ?? 10_000, 3_000);
  }

  return Object.freeze(factors);
}

export function buildJobPostingCoverageModel(input: {
  readonly firmKey: string;
  readonly evaluationTime: UtcInstant;
  readonly knowableAt: UtcInstant;
  readonly jobs: readonly JobOpportunity[];
  readonly benchmark: CoverageBenchmark | null;
}): JobPostingCoverageModel {
  const shares = providerShareBps(input.jobs);
  const benchmarkAvailable = input.benchmark != null && input.benchmark.officialHeadcount != null;
  const reweightFactors = reweightFromBenchmark({
    benchmark: input.benchmark,
    postingCount: input.jobs.length,
  });

  const rawWeightBps = 10_000;
  let adjusted = rawWeightBps;
  for (const factor of Object.values(reweightFactors)) {
    if (factor != null) adjusted = Math.round((adjusted * factor) / 10_000);
  }
  adjusted = Math.max(1_000, Math.min(10_000, adjusted));

  return Object.freeze({
    modelId: `coverage:${input.firmKey}:${input.evaluationTime}`,
    firmKey: input.firmKey,
    evaluationTime: input.evaluationTime,
    providerSharesBps: shares,
    benchmarkAvailable,
    reweightFactors,
    rawWeightBps,
    adjustedWeightBps: adjusted,
    knowableAt: input.knowableAt,
  });
}

export function applyCoverageAdjustedCount(rawCount: number, model: JobPostingCoverageModel): number {
  return Math.max(0, Math.round((rawCount * model.adjustedWeightBps) / 10_000));
}
