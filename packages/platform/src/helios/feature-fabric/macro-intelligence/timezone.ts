/**
 * Normalize macro release timestamps to UTC for point-in-time joins.
 */

import { asUtcInstant, type UtcInstant } from '../../../../../domain/src/time.ts';

/** BLS headline releases are commonly quoted in US/Eastern; fixtures pass explicit offsets. */
export function normalizeMacroReleaseInstant(
  localIso: string,
  offsetMinutesEastOfUtc: number,
): UtcInstant {
  const localMs = Date.parse(localIso);
  if (!Number.isFinite(localMs)) {
    throw new Error(`invalid macro release timestamp: ${localIso}`);
  }
  const utcMs = localMs + offsetMinutesEastOfUtc * 60_000;
  return asUtcInstant(new Date(utcMs).toISOString());
}

export function assertUtcInstant(value: UtcInstant): UtcInstant {
  if (!value.endsWith('Z')) {
    throw new Error('macro intelligence requires UTC Zulu timestamps');
  }
  return value;
}
