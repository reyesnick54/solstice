/** Default hot-window retention for in-memory HELIOS market observations. */
export const HELIOS_OBSERVATION_BUFFER_MAX_PER_INSTRUMENT = 256 as const;

/** Trims `history` in place and returns entries removed from the front. */
export function trimObservationHistory<T>(history: T[], maxEntries: number): readonly T[] {
  if (history.length <= maxEntries) {
    return Object.freeze([]);
  }
  const evictCount = history.length - maxEntries;
  return Object.freeze(history.splice(0, evictCount));
}
