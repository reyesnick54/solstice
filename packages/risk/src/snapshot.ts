import type { UtcInstant } from '../../domain/src/time.ts';
import { asPortfolioRiskSnapshotId, type PortfolioRiskSnapshotId } from './ids.ts';
import type { PortfolioRiskSnapshot, RiskPositionFact, ValuationObservation } from './types.ts';

export function freezePortfolioRiskSnapshot(snapshot: PortfolioRiskSnapshot): PortfolioRiskSnapshot {
  return Object.freeze({
    ...snapshot,
    positions: Object.freeze(snapshot.positions.map((row) => Object.freeze({ ...row }))),
    observations: Object.freeze(snapshot.observations.map((row) => Object.freeze({ ...row }))),
    sourceRefs: Object.freeze([...snapshot.sourceRefs]),
    simulationOnly: true,
    ...(snapshot.mandate ? { mandate: Object.freeze({ ...snapshot.mandate, overrideForbidden: true as const }) } : {}),
  });
}

export function snapshotIdFor(portfolioId: string, asOf: UtcInstant): PortfolioRiskSnapshotId {
  const token = `${portfolioId}:${asOf}`.replace(/[^A-Za-z0-9]/g, '').slice(0, 24);
  return asPortfolioRiskSnapshotId(`prs_${token || 'snapshot'}`);
}

export function currentPositionValue(positions: readonly RiskPositionFact[], instrumentId: string): bigint {
  return positions
    .filter((row) => row.instrumentId === instrumentId)
    .reduce((sum, row) => sum + row.marketValueMinor, 0n);
}

export function portfolioMarketValue(positions: readonly RiskPositionFact[]): bigint {
  return positions.reduce((sum, row) => sum + row.marketValueMinor, 0n);
}

export function appendObservation(
  observations: readonly ValuationObservation[],
  next: ValuationObservation,
): readonly ValuationObservation[] {
  return Object.freeze([...observations, Object.freeze({ ...next })]);
}
