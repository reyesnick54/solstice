/**
 * AAF market-data temporal joins — always key on knowableAt (MD02).
 */

import type { UtcInstant } from '@solstice/domain';
import { aafTemporalJoinInstant } from '../market-data/md02/knowable-at.ts';
import type { MarketTimeEnvelope } from '../market-data/md02/types.ts';
import type { TemporalJoinPolicy } from './compiler/v2-types.ts';

export function resolveMarketDataTemporalJoin(input: {
  readonly marketTime: MarketTimeEnvelope;
  readonly temporalJoinPolicy: TemporalJoinPolicy;
}): UtcInstant {
  if (input.temporalJoinPolicy === 'AS_OF_SOURCE_EVENT') {
    throw new Error('market-data historical joins must use knowableAt, not exchange event time');
  }
  return aafTemporalJoinInstant(input.marketTime);
}
