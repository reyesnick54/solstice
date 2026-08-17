import type { EconomicDataSource, SourceRelationship } from './types.ts';

export type IndependenceCluster = {
  readonly controllerId: string;
  readonly upstreamOrganizationId: string;
  readonly sourceIds: readonly string[];
  readonly providerIds: readonly string[];
  readonly independent: boolean;
};

export function independentControllerCount(sources: readonly EconomicDataSource[]): number {
  return new Set(sources.map((row) => row.controllerId)).size;
}

export function independentUpstreamCount(sources: readonly EconomicDataSource[]): number {
  return new Set(sources.map((row) => row.upstreamOrganizationId)).size;
}

export function analyzeIndependence(
  sources: readonly EconomicDataSource[],
  requireIndependence: boolean,
): readonly IndependenceCluster[] {
  const groups = new Map<string, EconomicDataSource[]>();
  for (const source of sources) {
    const key = `${source.controllerId}:${source.upstreamOrganizationId}`;
    const existing = groups.get(key) ?? [];
    existing.push(source);
    groups.set(key, existing);
  }
  return [...groups.entries()]
    .sort(([left], [right]) => (left < right ? -1 : 1))
    .map(([, rows]) => {
      const sourceIds = rows.map((row) => row.sourceId).sort();
      const providerIds = [...new Set(rows.map((row) => row.providerId))].sort();
      const independent = !requireIndependence || rows.length === 1;
      return Object.freeze({
        controllerId: rows[0]!.controllerId,
        upstreamOrganizationId: rows[0]!.upstreamOrganizationId,
        sourceIds,
        providerIds,
        independent,
      });
    });
}

export function twoEndpointsOneUpstreamAreNotAutomaticallyIndependent(
  left: SourceRelationship,
  right: SourceRelationship,
  requireIndependence: boolean,
): boolean {
  if (!requireIndependence) {
    return true;
  }
  if (left.controllerId === right.controllerId || left.upstreamOrganizationId === right.upstreamOrganizationId) {
    return false;
  }
  if (left.sharedControlGroup !== null && left.sharedControlGroup === right.sharedControlGroup) {
    return false;
  }
  return true;
}

export function countIndependentForQuorum(
  sources: readonly EconomicDataSource[],
  requireIndependence: boolean,
): number {
  if (!requireIndependence) {
    return new Set(sources.map((row) => row.providerId)).size;
  }
  return independentControllerCount(sources);
}
