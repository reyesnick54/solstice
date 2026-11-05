import type { InvariantCheck, ResourceSample } from './types.ts';
import { analyzeMemoryTrend, MIN_SOAK_MS_FOR_TREND_ANALYSIS } from './memory-trend-analysis.ts';

export const HELIOS_MEMORY_SOAK_QUALIFIED = 'HELIOS_MEMORY_SOAK_QUALIFIED' as const;

export type MemorySoakQualificationInput = {
  readonly invariants: readonly InvariantCheck[];
  readonly memorySnapshots: readonly ResourceSample[];
  readonly durationMs: number;
};

export type MemorySoakQualificationResult = {
  readonly marker: typeof HELIOS_MEMORY_SOAK_QUALIFIED;
  readonly ok: boolean;
  readonly blockers: readonly string[];
  readonly trend: ReturnType<typeof analyzeMemoryTrend>;
};

export function evaluateHeliosMemorySoakQualification(
  input: MemorySoakQualificationInput,
): MemorySoakQualificationResult {
  const blockers: string[] = [];
  for (const invariant of input.invariants) {
    if (!invariant.ok) {
      blockers.push(`${invariant.id}: ${invariant.detail}`);
    }
  }
  if (input.memorySnapshots.length < 4) {
    blockers.push('MEMORY_SNAPSHOTS: fewer than 4 soak snapshots captured (5s interval)');
  }
  const trendRequired = input.durationMs >= MIN_SOAK_MS_FOR_TREND_ANALYSIS;
  const trend = analyzeMemoryTrend(input.memorySnapshots, input.durationMs);
  if (trendRequired && !trend.ok) {
    blockers.push(`MEMORY_TREND: ${trend.detail}`);
  }
  return Object.freeze({
    marker: HELIOS_MEMORY_SOAK_QUALIFIED,
    ok: blockers.length === 0,
    blockers: Object.freeze(blockers),
    trend,
  });
}
