/**
 * M07 — bridge Gold market observations into HELIOS observation fabric.
 */

import type { Clock } from '../../../../../config/src/clock.ts';
import type { UtcInstant } from '../../../../../domain/src/time.ts';
import type { CapitalMarketObservation } from '../../../../../sunrey-exchange/src/capital-market/types.ts';
import type { GoldBarCandle } from '../../../../../sunrey-exchange/src/capital-market/gold/types.ts';
import { buildInformationTime, isKnowableAt } from '../../observation/information-time.ts';
import { HeliosObservationFabric } from '../../observation/fabric.ts';
import type { HeliosMarketObservationEnvelope, ObservationType } from '../../observation/types.ts';
import { externalObservationFromCapitalMarket, externalObservationFromGoldBar } from './external-observation.ts';

export type GoldObservationBridgeResult =
  | { readonly ok: true; readonly envelope: HeliosMarketObservationEnvelope }
  | { readonly ok: false; readonly code: string; readonly message: string };

export class HeliosGoldObservationBridge {
  readonly #fabric: HeliosObservationFabric;
  readonly #clock: Clock;

  constructor(fabric: HeliosObservationFabric, clock: Clock) {
    this.#fabric = fabric;
    this.#clock = clock;
  }

  ingestQuote(observation: CapitalMarketObservation, canonicalInstrumentId: string): GoldObservationBridgeResult {
    const external = externalObservationFromCapitalMarket(observation);
    const result = this.#fabric.ingest({
      observation: external,
      sourceId: `gold:${observation.providerId}:${canonicalInstrumentId}`,
      canonicalInstrumentId,
      observationType: 'quote' satisfies ObservationType,
    });
    if (!result.ok) {
      return Object.freeze({ ok: false, code: result.code, message: result.message });
    }
    return Object.freeze({ ok: true, envelope: result.envelope });
  }

  ingestBar(bar: GoldBarCandle, evaluationTimeUtc: UtcInstant): GoldObservationBridgeResult {
    const knowableAt = bar.knowableAt;
    const informationTime = buildInformationTime({
      observation: externalObservationFromGoldBar({
        observationId: `gold_bar_${bar.identityId}_${bar.periodStart}`,
        providerId: bar.providerId,
        identityId: bar.identityId,
        interval: bar.interval,
        openMinorUnits: bar.openMinorUnits,
        highMinorUnits: bar.highMinorUnits,
        lowMinorUnits: bar.lowMinorUnits,
        closeMinorUnits: bar.closeMinorUnits,
        periodEnd: bar.periodEnd,
        knowableAt,
      }),
      sourceEventTime: bar.periodEnd,
      ingestionTime: this.#clock.now(),
      sunreyArrivalTime: knowableAt,
    });

    if (!isKnowableAt(evaluationTimeUtc, informationTime)) {
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
      knowableAt,
    });

    const result = this.#fabric.ingest({
      observation: external,
      sourceId: `gold:${bar.providerId}:${bar.identityId}:bar`,
      canonicalInstrumentId: bar.identityId,
      observationType: 'daily_price' satisfies ObservationType,
      informationTime,
    });
    if (!result.ok) {
      return Object.freeze({ ok: false, code: result.code, message: result.message });
    }
    return Object.freeze({ ok: true, envelope: result.envelope });
  }
}
