/**
 * ALPHA12 — capacity evidence (participation vs declared capacity envelope).
 */

export const HELIOS_ALPHA12_CAPACITY = 'HELIOS_ALPHA12_CAPACITY' as const;

export function participationRateBps(tradedNotionalMinor: bigint, advMinor: bigint): number {
  if (advMinor <= 0n) {
    return 0;
  }
  return Number((tradedNotionalMinor * 10_000n) / advMinor);
}

export function withinCapacityEnvelope(participationBps: number, maxParticipationBps: number): boolean {
  return participationBps <= maxParticipationBps;
}
