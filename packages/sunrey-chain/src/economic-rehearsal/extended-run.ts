/**
 * Manual extended economic-epoch workflow.
 *
 * Deterministic seed/config only. Do not claim an extended run unless
 * this workflow is actually executed.
 */

export const EXTENDED_ECONOMIC_RUN_SEED = 80 as const;
export const EXTENDED_ECONOMIC_RUN_EPOCHS = 48 as const;

export function extendedEconomicRunPlan(): {
  readonly executed: false;
  readonly seed: typeof EXTENDED_ECONOMIC_RUN_SEED;
  readonly epochs: typeof EXTENDED_ECONOMIC_RUN_EPOCHS;
  readonly command: string;
  readonly notes: string;
} {
  return Object.freeze({
    executed: false,
    seed: EXTENDED_ECONOMIC_RUN_SEED,
    epochs: EXTENDED_ECONOMIC_RUN_EPOCHS,
    command:
      'SUNREY_FIXTURE_ENV=local npm run sunrey-economics -- dual simulate --scenario baseline --epochs 48 --seed 80',
    notes:
      'Manual extended workflow. Chunk 80 does not claim this run was executed. Use the same rehearsal identity and REHEARSAL_ONLY allocations.',
  });
}
