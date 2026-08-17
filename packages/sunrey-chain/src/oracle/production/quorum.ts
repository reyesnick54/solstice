import { err, ok, type Result } from '../../../../domain/src/result.ts';
import { OracleEngine } from '../engine.ts';
import type { OracleObservation, VerifiedEconomicFact } from '../types.ts';
import { countIndependentForQuorum } from './independence.ts';
import type { EconomicDataSource, ProductionFeedConfiguration, ProductionOracleRejection } from './types.ts';

export function evaluateProductionQuorum(input: {
  readonly feed: ProductionFeedConfiguration;
  readonly observations: readonly OracleObservation[];
  readonly sources: readonly EconomicDataSource[];
  readonly requireIndependence: boolean;
}): Result<true, ProductionOracleRejection> {
  const providers = new Set(input.observations.map((row) => row.oracleId));
  if (providers.size < input.feed.minimumProviders) {
    return err({
      code: 'QUORUM_ABSENT',
      detail: `need ${input.feed.minimumProviders} providers, have ${providers.size}; fact creation fails closed`,
    });
  }
  const independent = countIndependentForQuorum(input.sources, input.requireIndependence);
  if (independent < input.feed.minimumIndependentControllers) {
    return err({
      code: 'INSUFFICIENT_INDEPENDENT_CONTROLLERS',
      detail: `need ${input.feed.minimumIndependentControllers} independent controllers, have ${independent}`,
    });
  }
  return ok(true);
}

export function finalizeOrFailClosed(
  engine: OracleEngine,
  feed: ProductionFeedConfiguration,
  sources: readonly EconomicDataSource[],
  window: { readonly subject: string; readonly startUnix: bigint; readonly endUnix: bigint },
  requireIndependence: boolean,
): Result<VerifiedEconomicFact, ProductionOracleRejection> {
  const collected = engine
    .listObservations(feed.feedId)
    .filter((row) => row.subject === window.subject);
  const quorum = evaluateProductionQuorum({
    feed,
    observations: collected,
    sources,
    requireIndependence,
  });
  if (!quorum.ok) {
    return quorum;
  }
  const finalized = engine.finalizeWindow({
    feedId: feed.feedId,
    subject: window.subject,
    startUnix: window.startUnix,
    endUnix: window.endUnix,
  });
  if (!finalized.ok) {
    return err({
      code: finalized.error.code === 'ORACLE_INSUFFICIENT_QUORUM' ? 'QUORUM_ABSENT' : 'FACT_NOT_VERIFIED',
      detail: finalized.error.detail,
    });
  }
  return ok(finalized.value);
}
