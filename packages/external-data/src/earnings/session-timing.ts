/**
 * Classify earnings session timing from release vs market calendar (US equity default).
 */

import type { UtcInstant } from '@solstice/domain';
import type { EarningsSessionTiming } from './taxonomy.ts';

const US_MARKET_OPEN_UTC = { hour: 13, minute: 30 };
const US_MARKET_CLOSE_UTC = { hour: 20, minute: 0 };

export function classifyEarningsSessionTiming(releaseTimeUtc: UtcInstant | null): EarningsSessionTiming {
  if (releaseTimeUtc === null) {
    return 'UNKNOWN';
  }
  const ms = Date.parse(releaseTimeUtc);
  if (!Number.isFinite(ms)) {
    return 'UNKNOWN';
  }
  const date = new Date(ms);
  const minutes = date.getUTCHours() * 60 + date.getUTCMinutes();
  const openMinutes = US_MARKET_OPEN_UTC.hour * 60 + US_MARKET_OPEN_UTC.minute;
  const closeMinutes = US_MARKET_CLOSE_UTC.hour * 60 + US_MARKET_CLOSE_UTC.minute;
  if (minutes < openMinutes) {
    return 'BEFORE_MARKET';
  }
  if (minutes >= closeMinutes) {
    return 'AFTER_MARKET';
  }
  return 'DURING_MARKET';
}
