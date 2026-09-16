import type { ExecutableOpportunityMetricsSnapshot, ExecutableOpportunity } from './types.ts';

export function collectExecutableOpportunityMetrics(
  opportunities: readonly ExecutableOpportunity[],
): ExecutableOpportunityMetricsSnapshot {
  let evidenceRejectedCount = 0;
  let staleCount = 0;
  let customerIneligibleCount = 0;
  let noRouteCount = 0;
  let routeReadyCount = 0;
  let qualifiedForProposalCount = 0;
  const latencies: number[] = [];

  for (const item of opportunities) {
    if (item.evidenceDecision && !item.evidenceDecision.verified) {
      evidenceRejectedCount += 1;
    }
    if (item.state === 'STALE') {
      staleCount += 1;
    }
    if (item.state === 'INELIGIBLE') {
      customerIneligibleCount += 1;
    }
    if (item.state === 'NO_ROUTE') {
      noRouteCount += 1;
    }
    if (item.state === 'EXECUTION_ROUTE_READY') {
      routeReadyCount += 1;
    }
    if (item.state === 'QUALIFIED_FOR_PROPOSAL') {
      qualifiedForProposalCount += 1;
      if (item.qualifiedAt) {
        latencies.push(Date.parse(item.qualifiedAt) - Date.parse(item.discoveredAt));
      }
    }
  }

  const averageObservationToQualificationMs =
    latencies.length > 0 ? Math.round(latencies.reduce((sum, value) => sum + value, 0) / latencies.length) : null;

  return Object.freeze({
    discoveredCount: opportunities.length,
    evidenceRejectedCount,
    staleCount,
    customerIneligibleCount,
    noRouteCount,
    routeReadyCount,
    qualifiedForProposalCount,
    averageObservationToQualificationMs,
  });
}
