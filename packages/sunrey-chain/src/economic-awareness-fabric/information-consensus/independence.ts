/**
 * Source independence analysis using provider lineage.
 *
 * Three providers copying the same upstream source count as ONE
 * independent confirmation, not three.
 */

import type { NormalizedEconomicObservation, ProviderLineage } from '../types.ts';
import type { IndependentSourceClassSummary } from './types.ts';

export type IndependenceAnalysis = {
  readonly rawProviderCount: number;
  readonly rawObservationCount: number;
  readonly independentLineageRootCount: number;
  readonly independentSourceClassCount: number;
  readonly sharedUpstreamGroups: readonly {
    readonly upstreamOrganizationId: string;
    readonly lineageRootId: string;
    readonly providerIds: readonly string[];
    readonly observationIds: readonly string[];
  }[];
  readonly independentSourceClasses: readonly IndependentSourceClassSummary[];
  readonly endpointCountIsNotIndependence: true;
};

function lineageRootKey(lineage: ProviderLineage): string {
  return lineage.lineageRootId;
}

function sourceClassKey(lineage: ProviderLineage): string {
  return `${lineage.sourceClass}:${lineageRootKey(lineage)}`;
}

export function analyzeSourceIndependence(
  observations: readonly NormalizedEconomicObservation[],
): IndependenceAnalysis {
  const providerIds = new Set(observations.map((row) => row.providerId));
  const upstreamGroups = new Map<string, { providerIds: Set<string>; observationIds: string[]; upstreamOrganizationId: string; lineageRootId: string }>();
  const classGroups = new Map<string, { sourceClass: string; lineageRootId: string; providerIds: Set<string>; observationIds: string[] }>();

  for (const observation of observations) {
    const lineage = observation.lineage;
    const upstreamKey = `${lineage.upstreamOrganizationId}:${lineageRootKey(lineage)}`;
    const upstream = upstreamGroups.get(upstreamKey) ?? {
      providerIds: new Set<string>(),
      observationIds: [],
      upstreamOrganizationId: lineage.upstreamOrganizationId,
      lineageRootId: lineageRootKey(lineage),
    };
    upstream.providerIds.add(observation.providerId);
    upstream.observationIds.push(observation.observationId);
    upstreamGroups.set(upstreamKey, upstream);

    const classKey = sourceClassKey(lineage);
    const classGroup = classGroups.get(classKey) ?? {
      sourceClass: lineage.sourceClass,
      lineageRootId: lineageRootKey(lineage),
      providerIds: new Set<string>(),
      observationIds: [],
    };
    classGroup.providerIds.add(observation.providerId);
    classGroup.observationIds.push(observation.observationId);
    classGroups.set(classKey, classGroup);
  }

  const sharedUpstreamGroups = [...upstreamGroups.values()]
    .map((group) =>
      Object.freeze({
        upstreamOrganizationId: group.upstreamOrganizationId,
        lineageRootId: group.lineageRootId,
        providerIds: Object.freeze([...group.providerIds].sort()),
        observationIds: Object.freeze([...group.observationIds].sort()),
      }),
    )
    .sort((left, right) => left.lineageRootId.localeCompare(right.lineageRootId));

  const independentSourceClasses = [...classGroups.values()]
    .map((group) =>
      Object.freeze({
        sourceClass: group.sourceClass,
        lineageRootId: group.lineageRootId,
        providerIds: Object.freeze([...group.providerIds].sort()),
        observationIds: Object.freeze([...group.observationIds].sort()),
      }),
    )
    .sort((left, right) => `${left.sourceClass}:${left.lineageRootId}`.localeCompare(`${right.sourceClass}:${right.lineageRootId}`));

  const independentLineageRoots = new Set(observations.map((row) => lineageRootKey(row.lineage)));

  return Object.freeze({
    rawProviderCount: providerIds.size,
    rawObservationCount: observations.length,
    independentLineageRootCount: independentLineageRoots.size,
    independentSourceClassCount: independentSourceClasses.length,
    sharedUpstreamGroups: Object.freeze(sharedUpstreamGroups),
    independentSourceClasses: Object.freeze(independentSourceClasses),
    endpointCountIsNotIndependence: true,
  });
}

export function providersShareUpstream(
  left: ProviderLineage,
  right: ProviderLineage,
): boolean {
  return (
    left.lineageRootId === right.lineageRootId ||
    left.upstreamOrganizationId === right.upstreamOrganizationId ||
    (left.sharedControlGroup !== null && left.sharedControlGroup === right.sharedControlGroup)
  );
}

export function effectiveIndependentCount(observations: readonly NormalizedEconomicObservation[]): number {
  return analyzeSourceIndependence(observations).independentLineageRootCount;
}
