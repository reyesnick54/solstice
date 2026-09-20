/**
 * Convert capital-market observations to provider-sdk ExternalObservation shape.
 */

import type { UtcInstant } from '../../../../../domain/src/time.ts';
import type { CapitalMarketObservation } from '../../../../../sunrey-exchange/src/capital-market/types.ts';
import { buildExternalObservation, type ExternalObservation } from '../../../../../provider-sdk/src/index.ts';

export type GoldMarketPayload = {
  readonly lastMinorUnits: string | null;
  readonly bidMinorUnits: string | null;
  readonly askMinorUnits: string | null;
  readonly currency: string;
  readonly sessionStatus: string;
};

export function externalObservationFromCapitalMarket(
  observation: CapitalMarketObservation,
): ExternalObservation<GoldMarketPayload> {
  const built = buildExternalObservation({
    observationId: observation.provenance.observationId,
    providerId: observation.providerId,
    providerCategory: 'markets',
    capability: observation.provenance.capability,
    data: Object.freeze({
      lastMinorUnits: observation.lastMinorUnits?.toString() ?? null,
      bidMinorUnits: observation.bidMinorUnits?.toString() ?? null,
      askMinorUnits: observation.askMinorUnits?.toString() ?? null,
      currency: observation.currency,
      sessionStatus: observation.sessionStatus,
    }),
    source: {
      provider: observation.providerId,
      dataset: observation.instrument.instrumentId,
      sourceUrl: observation.provenance.sourceUrl,
    },
    time: {
      retrievedAt: observation.arrivalTimestamp,
      sourceTimestamp: observation.sourceTimestamp,
      effectiveAt: observation.availabilityTimestamp ?? observation.sourceTimestamp,
    },
    authorityClass: observation.provenance.authorityClass,
    provenance: {
      rawPayload: observation.provenance.rawPayloadHash,
      providerSchemaVersion: observation.schema,
    },
  });
  if (!built.ok) {
    throw new Error(`failed to build external observation: ${built.message}`);
  }
  return built.value;
}

export function externalObservationFromGoldBar(input: {
  readonly observationId: string;
  readonly providerId: string;
  readonly identityId: string;
  readonly interval: string;
  readonly openMinorUnits: bigint;
  readonly highMinorUnits: bigint;
  readonly lowMinorUnits: bigint;
  readonly closeMinorUnits: bigint;
  readonly periodEnd: UtcInstant;
  readonly knowableAt: UtcInstant;
}): ExternalObservation<Record<string, string>> {
  const built = buildExternalObservation({
    observationId: input.observationId,
    providerId: input.providerId,
    providerCategory: 'markets',
    capability: 'market_history',
    data: Object.freeze({
      openMinorUnits: input.openMinorUnits.toString(),
      highMinorUnits: input.highMinorUnits.toString(),
      lowMinorUnits: input.lowMinorUnits.toString(),
      closeMinorUnits: input.closeMinorUnits.toString(),
      interval: input.interval,
    }),
    source: {
      provider: input.providerId,
      dataset: input.identityId,
    },
    time: {
      retrievedAt: input.knowableAt,
      sourceTimestamp: input.periodEnd,
      effectiveAt: input.periodEnd,
    },
    authorityClass: 'reference_data',
    provenance: {
      rawPayload: JSON.stringify({ identityId: input.identityId, interval: input.interval }),
      providerSchemaVersion: 'sunrey.helios.gold-market.v1',
    },
  });
  if (!built.ok) {
    throw new Error(`failed to build bar observation: ${built.message}`);
  }
  return built.value;
}
