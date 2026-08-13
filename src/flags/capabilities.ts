/**
 * Capability flags. These are the only switches that may enable real-world
 * side effects. They are not feature toggles for product experiments.
 *
 * REAL_MONEY_ENABLED is false and stays false. This process is a simulation.
 * No code path may flip this flag. No external payment provider, bank, or
 * rails API may be contacted.
 */
export const REAL_MONEY_ENABLED = false as const;

export const CAPABILITIES = Object.freeze({
  REAL_MONEY_ENABLED,
});

export function assertSimulationOnly(): void {
  if (REAL_MONEY_ENABLED !== false) {
    throw new Error(
      "REAL_MONEY_ENABLED must remain false; real-money movement is not authorised",
    );
  }
}
