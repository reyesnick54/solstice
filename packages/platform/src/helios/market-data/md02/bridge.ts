/**
 * Bridge MD02 market time to legacy H08 InformationTime.
 */

import type { UtcInstant } from '@solstice/domain';
import type { InformationTime } from '../../observation/types.ts';
import type { MarketTimeEnvelope } from './types.ts';

export function marketTimeToInformationTime(marketTime: MarketTimeEnvelope): InformationTime {
  return Object.freeze({
    sourceEventTime: marketTime.exchangeEventTime,
    sourcePublishedTime: marketTime.providerPublishTime,
    providerAvailabilityTime: marketTime.providerReceiveTime ?? marketTime.providerPublishTime,
    sunreyArrivalTime: marketTime.sunreyNetworkReceiveTime,
    ingestionTime: marketTime.sunreyNormalizeTime,
    knowableAt: marketTime.knowableAt,
  });
}

export function buildMarketTimeInputFromInformationPartial(input: {
  readonly sourceEventTime?: UtcInstant | null;
  readonly sourcePublishedTime?: UtcInstant | null;
  readonly providerAvailabilityTime?: UtcInstant | null;
  readonly sunreyArrivalTime: UtcInstant;
  readonly ingestionTime?: UtcInstant;
  readonly exchangeSendTime?: UtcInstant | null;
  readonly providerReceiveTime?: UtcInstant | null;
  readonly sunreyPersistTime?: UtcInstant;
}) {
  const sunreyNetworkReceiveTime = input.sunreyArrivalTime;
  const sunreyNormalizeTime = input.ingestionTime ?? sunreyNetworkReceiveTime;
  const sunreyPersistTime = input.sunreyPersistTime ?? sunreyNormalizeTime;
  return {
    exchangeEventTime: input.sourceEventTime ?? null,
    exchangeSendTime: input.exchangeSendTime ?? null,
    providerReceiveTime: input.providerReceiveTime ?? input.providerAvailabilityTime ?? null,
    providerPublishTime: input.sourcePublishedTime ?? null,
    sunreyNetworkReceiveTime,
    sunreyDecodeTime: sunreyNetworkReceiveTime,
    sunreyNormalizeTime,
    sunreyPersistTime,
  };
}
