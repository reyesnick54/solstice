import type { InvariantCheck, ResourceSample } from './types.ts';

export const HELIOS_MEMORY_SOAK_QUALIFIED = 'HELIOS_MEMORY_SOAK_QUALIFIED' as const;

export type MemorySoakQualificationInput = {
  readonly invariants: readonly InvariantCheck[];
  readonly memorySnapshots: readonly ResourceSample[];
};

export type MemorySoakQualificationResult = {
  readonly marker: typeof HELIOS_MEMORY_SOAK_QUALIFIED;
  readonly ok: boolean;
  readonly blockers: readonly string[];
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
  if (input.memorySnapshots.length < 2) {
    blockers.push('MEMORY_SNAPSHOTS: fewer than 2 soak snapshots captured');
  }
  return Object.freeze({
    marker: HELIOS_MEMORY_SOAK_QUALIFIED,
    ok: blockers.length === 0,
    blockers: Object.freeze(blockers),
  });
}
