/**
 * Persistence-local HELIOS market bar snapshot shape.
 *
 * Structurally compatible with sunrey-exchange CapitalMarketBarStoreSnapshot
 * without importing exchange internals.
 */

export type HeliosMarketBarStoreSnapshot = {
  readonly bars: readonly Record<string, unknown>[];
  readonly barIds: readonly string[];
  readonly duplicateBarIds: readonly string[];
};
