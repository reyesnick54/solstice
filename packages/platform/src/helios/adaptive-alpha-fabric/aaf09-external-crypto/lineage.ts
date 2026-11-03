/**
 * Multi-source lineage — republished venue data does not count as independent witness.
 */

import type { NormalizedCryptoMarketObservation } from './types.ts';
import { isReferenceAggregate, isVenueSource } from './taxonomy.ts';

export type WitnessClassification = {
  readonly observationId: string;
  readonly providerId: string;
  readonly sourceFamily: string;
  readonly countsAsIndependentWitness: boolean;
  readonly reason: string;
};

export function classifyWitness(observation: NormalizedCryptoMarketObservation): WitnessClassification {
  if (isVenueSource(observation.sourceClass)) {
    return Object.freeze({
      observationId: observation.observationId,
      providerId: observation.providerId,
      sourceFamily: observation.sourceFamily,
      countsAsIndependentWitness: true,
      reason: 'primary venue market-data tape',
    });
  }
  if (isReferenceAggregate(observation.sourceClass)) {
    return Object.freeze({
      observationId: observation.observationId,
      providerId: observation.providerId,
      sourceFamily: observation.sourceFamily,
      countsAsIndependentWitness: false,
      reason: 'reference aggregate is not an independent venue witness',
    });
  }
  return Object.freeze({
    observationId: observation.observationId,
    providerId: observation.providerId,
    sourceFamily: observation.sourceFamily,
    countsAsIndependentWitness: false,
    reason: 'aggregate republishing venue data cannot corroborate independently',
  });
}

export function countIndependentWitnesses(observations: readonly NormalizedCryptoMarketObservation[]): number {
  const families = new Set<string>();
  let count = 0;
  for (const observation of observations) {
    const witness = classifyWitness(observation);
    if (!witness.countsAsIndependentWitness) continue;
    if (families.has(witness.sourceFamily)) continue;
    families.add(witness.sourceFamily);
    count += 1;
  }
  return count;
}

export function sharedUpstreamBlocksIndependence(
  left: NormalizedCryptoMarketObservation,
  right: NormalizedCryptoMarketObservation,
): boolean {
  if (!left.upstreamSourceRef || !right.upstreamSourceRef) return false;
  return left.upstreamSourceRef === right.upstreamSourceRef;
}
