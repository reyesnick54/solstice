/**
 * HELIOS OS03 — execution simulation qualification gate.
 */

export const HELIOS_OS03_EXECUTION_SIMULATION_QUALIFIED = 'HELIOS_OS03_EXECUTION_SIMULATION_QUALIFIED' as const;
export const HELIOS_OS03_EXECUTION_SIMULATION_BLOCKED = 'HELIOS_OS03_EXECUTION_SIMULATION_BLOCKED' as const;

export type Os03QualificationChecks = {
  readonly thinBookPartialFill: boolean;
  readonly gapWideSpread: boolean;
  readonly noFillWhenLimitNotMarketable: boolean;
  readonly fastCancelBeforeFill: boolean;
  readonly staleBookNoFill: boolean;
  readonly fundingEventModeled: boolean;
  readonly liquidationModeled: boolean;
  readonly fokFailure: boolean;
  readonly iocPartial: boolean;
  readonly marketImpactApproximation: boolean;
  readonly deterministicReplay: boolean;
  readonly barFidelityExplicit: boolean;
  readonly fillEvidenceComplete: boolean;
  readonly simulationPosture: boolean;
};

export type Os03QualificationResult = {
  readonly marker:
    | typeof HELIOS_OS03_EXECUTION_SIMULATION_QUALIFIED
    | typeof HELIOS_OS03_EXECUTION_SIMULATION_BLOCKED;
  readonly qualified: boolean;
  readonly blockers: readonly string[];
};

const CHECK_LABELS: Record<keyof Os03QualificationChecks, string> = {
  thinBookPartialFill: 'thin book partial fill',
  gapWideSpread: 'gap / wide spread handling',
  noFillWhenLimitNotMarketable: 'no spurious fill when limit not marketable',
  fastCancelBeforeFill: 'fast cancel latency',
  staleBookNoFill: 'stale book blocks matching',
  fundingEventModeled: 'funding event',
  liquidationModeled: 'liquidation path',
  fokFailure: 'FOK failure when insufficient liquidity',
  iocPartial: 'IOC partial then cancel rest',
  marketImpactApproximation: 'market impact / slippage model',
  deterministicReplay: 'deterministic replay under fixed inputs',
  barFidelityExplicit: 'bar execution fidelity explicit (no silent intrabar)',
  fillEvidenceComplete: 'fill evidence bundle complete',
  simulationPosture: 'simulation posture preserved',
};

export function evaluateOs03ExecutionSimulationQualification(
  checks: Os03QualificationChecks,
): Os03QualificationResult {
  const blockers: string[] = [];
  for (const [key, passed] of Object.entries(checks) as [keyof Os03QualificationChecks, boolean][]) {
    if (!passed) {
      blockers.push(CHECK_LABELS[key]);
    }
  }
  if (blockers.length === 0) {
    return Object.freeze({
      marker: HELIOS_OS03_EXECUTION_SIMULATION_QUALIFIED,
      qualified: true,
      blockers: Object.freeze([]),
    });
  }
  return Object.freeze({
    marker: HELIOS_OS03_EXECUTION_SIMULATION_BLOCKED,
    qualified: false,
    blockers: Object.freeze(blockers),
  });
}
