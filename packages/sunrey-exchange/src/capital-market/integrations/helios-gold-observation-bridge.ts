/**
 * M07 — bridge Gold market observations into HELIOS observation fabric.
 *
 * Lives in Exchange owner; accepts a fabric port from platform at runtime
 * without creating a package dependency on platform.
 */

import type { UtcInstant } from '../../../../domain/src/time.ts';
import { buildExternalObservation, type ExternalObservation } from '../../../../provider-sdk/src/index.ts';
import type { CapitalMarketObservation } from '../types.ts';
import type { GoldBarCandle } from '../gold/types.ts';

export type GoldMarketPayload = {
  readonly lastMinorUnits: string | null;
  readonly bidMinorUnits: string | null;
  readonly askMinorUnits: string | null;
  readonly currency: string;
  readonly sessionStatus: string;
};

export type GoldObservationFabricPort = {
  ingest<T>(input: {
    readonly observation: ExternalObservation<T>;
    readonly sourceId: string;
    readonly canonicalInstrumentId: string;
    readonly observationType: string;
    readonly informationTime?: Partial<{
      readonly sourceEventTime: UtcInstant | null;
      readonly sourcePublishedTime: UtcInstant | null;
      readonly providerAvailabilityTime: UtcInstant | null;
      readonly sunreyArrivalTime: UtcInstant;
      readonly ingestionTime: UtcInstant;
    }>;
  }): { readonly ok: true; readonly envelope: { readonly entitlement: { readonly unavailable: boolean } } } | { readonly ok: false; readonly code: string; readonly message: string };
};

export type GoldObservationBridgeResult =
  | { readonly ok: true; readonly envelope: { readonly entitlement: { readonly unavailable: boolean }; readonly canonicalInstrumentId: string } }
  | { readonly ok: false; readonly code: string; readonly message: string };

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

function isKnowableAt(evaluationTimeUtc: UtcInstant, knowableAt: UtcInstant): boolean {
  const evalMs = Date.parse(evaluationTimeUtc);
  const knowableMs = Date.parse(knowableAt);
  if (!Number.isFinite(evalMs) || !Number.isFinite(knowableMs)) {
    return false;
  }
  return evalMs >= knowableMs;
}

export function ingestGoldQuote(
  fabric: GoldObservationFabricPort,
  observation: CapitalMarketObservation,
  canonicalInstrumentId: string,
): GoldObservationBridgeResult {
  const external = externalObservationFromCapitalMarket(observation);
  const result = fabric.ingest({
    observation: external,
    sourceId: `gold:${observation.providerId}:${canonicalInstrumentId}`,
    canonicalInstrumentId,
    observationType: 'quote',
  });
  if (!result.ok) {
    return Object.freeze({ ok: false, code: result.code, message: result.message });
  }
  return Object.freeze({ ok: true, envelope: result.envelope });
}

export function ingestGoldBar(
  fabric: GoldObservationFabricPort,
  bar: GoldBarCandle,
  evaluationTimeUtc: UtcInstant,
  ingestionTime: UtcInstant,
): GoldObservationBridgeResult {
  if (!isKnowableAt(evaluationTimeUtc, bar.knowableAt)) {
    return Object.freeze({
      ok: false,
      code: 'LOOK_AHEAD',
      message: `bar ${bar.periodStart} not knowable at ${evaluationTimeUtc}`,
    });
  }

  const external = externalObservationFromGoldBar({
    observationId: `gold_bar_${bar.identityId}_${bar.periodStart}`,
    providerId: bar.providerId,
    identityId: bar.identityId,
    interval: bar.interval,
    openMinorUnits: bar.openMinorUnits,
    highMinorUnits: bar.highMinorUnits,
    lowMinorUnits: bar.lowMinorUnits,
    closeMinorUnits: bar.closeMinorUnits,
    periodEnd: bar.periodEnd,
    knowableAt: bar.knowableAt,
  });

  const result = fabric.ingest({
    observation: external,
    sourceId: `gold:${bar.providerId}:${bar.identityId}:bar`,
    canonicalInstrumentId: bar.identityId,
    observationType: 'daily_price',
    informationTime: {
      sourceEventTime: bar.periodEnd,
      ingestionTime,
      sunreyArrivalTime: bar.knowableAt,
    },
  });
  if (!result.ok) {
    return Object.freeze({ ok: false, code: result.code, message: result.message });
  }
  return Object.freeze({ ok: true, envelope: result.envelope });
}
