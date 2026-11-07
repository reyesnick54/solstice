/**
 * MD11 secondary index dimensions (instrument, venue, provider, times, sequence).
 */

import type { UtcInstant } from '../../../../domain/src/time.ts';
import type { MarketEventIndexFields } from './types.ts';

export type MarketEventIndexName =
  | 'instrument'
  | 'venue'
  | 'provider'
  | 'exchangeTime'
  | 'sunreyReceiveTime'
  | 'knowableAt'
  | 'sequence';

export const MARKET_EVENT_INDEX_NAMES: readonly MarketEventIndexName[] = Object.freeze([
  'instrument',
  'venue',
  'provider',
  'exchangeTime',
  'sunreyReceiveTime',
  'knowableAt',
  'sequence',
]);

export function indexFieldValue(index: MarketEventIndexFields, name: MarketEventIndexName): string {
  switch (name) {
    case 'instrument':
      return index.instrument;
    case 'venue':
      return index.venue;
    case 'provider':
      return index.provider;
    case 'exchangeTime':
      return index.exchangeTime;
    case 'sunreyReceiveTime':
      return index.sunreyReceiveTime;
    case 'knowableAt':
      return index.knowableAt;
    case 'sequence':
      return index.sequence === null ? '' : index.sequence.toString();
    default:
      return '';
  }
}

export function compareUtc(a: UtcInstant, b: UtcInstant): number {
  return Date.parse(a) - Date.parse(b);
}
