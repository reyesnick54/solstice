import type { CanonicalObservationEnvelope } from '../normalization/envelope.ts';

export type FederatedQuery = {
  readonly queryId: string;
  readonly economicDomain: string;
  readonly metric: string;
  readonly entityRef: string | null;
  readonly providerIds: readonly string[];
  readonly asOfUtc: string;
};

export type FederatedQueryResult = {
  readonly queryId: string;
  readonly envelopes: readonly CanonicalObservationEnvelope[];
  readonly providerCoverage: Readonly<Record<string, 'hit' | 'miss' | 'error'>>;
  readonly completedAtUtc: string;
};

/**
 * Strip provider raw payloads before federated query results leave the fabric.
 * Downstream consumers receive digests and normalized fields only.
 */
export function minimizeObservationEnvelope(
  envelope: CanonicalObservationEnvelope,
): CanonicalObservationEnvelope {
  const provenance = envelope.externalObservation.provenance;
  if (!provenance || !('rawPayload' in provenance)) {
    return envelope;
  }
  const { rawPayload: _rawPayload, ...restProvenance } = provenance as typeof provenance & {
    readonly rawPayload?: unknown;
  };
  return Object.freeze({
    ...envelope,
    externalObservation: Object.freeze({
      ...envelope.externalObservation,
      provenance: Object.freeze(restProvenance),
    }),
  });
}

export function minimizeFederatedQueryResult(result: FederatedQueryResult): FederatedQueryResult {
  return Object.freeze({
    ...result,
    envelopes: Object.freeze(result.envelopes.map((envelope) => minimizeObservationEnvelope(envelope))),
  });
}

export type FederatedQueryEngine = {
  execute(query: FederatedQuery, store: ReadonlyMap<string, CanonicalObservationEnvelope>): FederatedQueryResult;
};

export function createFederatedQueryEngine(): FederatedQueryEngine {
  return {
    execute(query, store) {
      const envelopes: CanonicalObservationEnvelope[] = [];
      const coverage: Record<string, 'hit' | 'miss' | 'error'> = {};

      for (const providerId of query.providerIds) {
        const matches = [...store.values()].filter(
          (e) =>
            e.providerId === providerId &&
            e.economicDomain === query.economicDomain &&
            (query.entityRef === null ||
              e.externalObservation.capability === query.metric ||
              e.externalObservation.source.dataset === query.metric),
        );
        if (matches.length > 0) {
          envelopes.push(...matches);
          coverage[providerId] = 'hit';
        } else {
          coverage[providerId] = 'miss';
        }
      }

      return minimizeFederatedQueryResult(
        Object.freeze({
          queryId: query.queryId,
          envelopes: Object.freeze(envelopes),
          providerCoverage: Object.freeze(coverage),
          completedAtUtc: query.asOfUtc,
        }),
      );
    },
  };
}
