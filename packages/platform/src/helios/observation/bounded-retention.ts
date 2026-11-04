/** Default hot-window retention for in-memory HELIOS market observations. */
export const HELIOS_OBSERVATION_BUFFER_MAX_PER_INSTRUMENT = 256 as const;

export function trimObservationHistory<T>(history: T[], maxEntries: number): readonly T[] {
  if (history.length <= maxEntries) {
    return history;
  }
  const start = history.length - maxEntries;
  history.splice(0, start);
  return history;
}
