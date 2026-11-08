/**
 * ALPHA13 — portfolio-level forward evidence aggregation.
 */

export const HELIOS_ALPHA13_PORTFOLIO_EVIDENCE = 'HELIOS_ALPHA13_PORTFOLIO_EVIDENCE' as const;

export function aggregatePortfolioExcessMinor(sleeveExcessMinor: readonly bigint[]): bigint {
  return sleeveExcessMinor.reduce((acc, x) => acc + x, 0n);
}

export function allSleevesDocumented(sleeveIds: readonly string[], documented: ReadonlySet<string>): boolean {
  return sleeveIds.every((id) => documented.has(id));
}
