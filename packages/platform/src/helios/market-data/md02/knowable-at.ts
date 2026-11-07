/**
 * MD02 knowableAt — latest availability stage, never collapsed with exchange event time.
 */

import { asUtcInstant, type UtcInstant } from '@solstice/domain';
import type { MarketTimeEnvelope } from './types.ts';

function latestInstant(candidates: readonly (UtcInstant | null)[]): UtcInstant {
  const present = candidates.filter((row): row is UtcInstant => row !== null);
  if (present.length === 0) {
    throw new Error('at least one pipeline instant required for knowableAt');
  }
  return present.reduce((latest, current) => {
    const latestMs = Date.parse(latest);
    const currentMs = Date.parse(current);
    if (!Number.isFinite(latestMs)) return current;
    if (!Number.isFinite(currentMs)) return latest;
    return currentMs > latestMs ? current : latest;
  });
}

export function computeMarketKnowableAt(
  stages: Pick<
    MarketTimeEnvelope,
    | 'providerReceiveTime'
    | 'providerPublishTime'
    | 'sunreyNetworkReceiveTime'
    | 'sunreyDecodeTime'
    | 'sunreyNormalizeTime'
    | 'sunreyPersistTime'
  >,
): UtcInstant {
  return asUtcInstant(
    latestInstant([
      stages.providerPublishTime,
      stages.providerReceiveTime,
      stages.sunreyNetworkReceiveTime,
      stages.sunreyDecodeTime,
      stages.sunreyNormalizeTime,
      stages.sunreyPersistTime,
    ]),
  );
}

/** AAF historical joins must key on knowableAt, not exchange event time alone. */
export function aafTemporalJoinInstant(envelope: Pick<MarketTimeEnvelope, 'knowableAt'>): UtcInstant {
  return envelope.knowableAt;
}
