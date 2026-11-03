/**
 * External Data Trust Engine alignment — compare sources with lineage-aware independence.
 */

import { ExternalDataTrustEngine } from '../../../../../provider-sdk/src/trust/engine.ts';
import type { TrustObservationContext } from '../../../../../provider-sdk/src/trust/types.ts';
import { buildExternalObservation } from '../../../../../provider-sdk/src/index.ts';
import { countIndependentWitnesses, classifyWitness } from './lineage.ts';
import type { MultiSourceDisagreementReport, NormalizedCryptoMarketObservation } from './types.ts';
import type { UtcInstant } from '../../../../../domain/src/time.ts';
import { isReferenceAggregate } from './taxonomy.ts';

const LARGE_DISAGREEMENT_BPS = 150;

function midPrice(observation: NormalizedCryptoMarketObservation): number | null {
  if (observation.bidMinorUnits !== null && observation.askMinorUnits !== null) {
    return Number(observation.bidMinorUnits + observation.askMinorUnits) / 2;
  }
  if (observation.lastMinorUnits !== null) return Number(observation.lastMinorUnits);
  if (observation.tradePriceMinorUnits !== null) return Number(observation.tradePriceMinorUnits);
  return null;
}

export function buildTrustContexts(
  observations: readonly NormalizedCryptoMarketObservation[],
): TrustObservationContext<number>[] {
  const contexts: TrustObservationContext<number>[] = [];
  for (const observation of observations) {
    const price = midPrice(observation);
    const built = buildExternalObservation({
      observationId: observation.observationId,
      providerId: observation.providerId,
      providerCategory: 'markets',
      capability: 'crypto_market_data',
      data: { priceMinor: price },
      source: {
        provider: observation.providerId,
        dataset: observation.sourceFamily,
      },
      time: {
        retrievedAt: observation.sunreyArrivalTime,
        sourceTimestamp: observation.providerEventTime,
      },
      authorityClass:
        observation.sourceClass === 'VENUE_MARKET_DATA' ? 'regulated_provider' : 'reference_data',
      provenance: {
        rawPayload: observation.rawPayloadHash,
        providerSchemaVersion: observation.schemaVersion,
      },
      validationStatus: 'valid',
    });
    if (!built.ok) continue;
    contexts.push(
      Object.freeze({
        observation: built.value,
        numericValue: price,
        lineage: Object.freeze({
          upstreamSource: observation.upstreamSourceRef,
          sourceFamily: observation.sourceFamily,
          datasetOrigin: observation.sourceClass,
        }),
      }),
    );
  }
  return contexts;
}

export function assessMultiSourceDisagreement(input: {
  readonly instrumentId: string;
  readonly evaluationTime: UtcInstant;
  readonly observations: readonly NormalizedCryptoMarketObservation[];
}): MultiSourceDisagreementReport {
  const lineageNotes: string[] = [];
  let aggregateWitnessCount = 0;
  for (const observation of input.observations) {
    const witness = classifyWitness(observation);
    lineageNotes.push(`${witness.providerId}: ${witness.reason}`);
    if (isReferenceAggregate(observation.sourceClass)) {
      aggregateWitnessCount += 1;
    }
  }

  const independentWitnessCount = countIndependentWitnesses(input.observations);
  const prices = input.observations.map(midPrice).filter((value): value is number => value !== null);
  let dispersionBps: number | null = null;
  if (prices.length >= 2) {
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const mid = (min + max) / 2;
    dispersionBps = mid === 0 ? null : Math.round(((max - min) / mid) * 10_000);
  }

  const engine = new ExternalDataTrustEngine({ nowUtc: () => input.evaluationTime });
  const contexts = buildTrustContexts(input.observations);
  const trust = engine.assess({
    contexts,
    policyProfile: 'MARKET_REFERENCE',
    semanticKey: `aaf09:${input.instrumentId}:mid`,
    unit: 'price_minor',
    mapCanonicalValue: () => null,
  });
  if (trust.status === 'CONFLICTED') {
    lineageNotes.push('trust_engine: conflicted numeric consensus');
  }

  const largeDisagreement =
    dispersionBps !== null && dispersionBps >= LARGE_DISAGREEMENT_BPS && independentWitnessCount >= 1;

  return Object.freeze({
    instrumentId: input.instrumentId,
    evaluationTime: input.evaluationTime,
    independentWitnessCount,
    aggregateWitnessCount,
    dispersionBps,
    largeDisagreement,
    lineageNotes: Object.freeze(lineageNotes),
    grantsExecutionAuthority: false,
  });
}
