import type { UtcInstant } from '../../domain/src/time.ts';

export type Clock = {
  now(): UtcInstant;
};

export function utcNowFromDate(date: Date): UtcInstant {
  const iso = date.toISOString();
  return iso as UtcInstant;
}

export const systemClock: Clock = {
  now: () => utcNowFromDate(new Date()),
};

export class FrozenClock implements Clock {
  private instant: UtcInstant;

  constructor(instant: UtcInstant) {
    this.instant = instant;
  }

  now(): UtcInstant {
    return this.instant;
  }

  set(instant: UtcInstant): void {
    this.instant = instant;
  }

  advanceMs(ms: bigint): void {
    const next = new Date(Date.parse(this.instant) + Number(ms)).toISOString();
    this.instant = next as UtcInstant;
  }
}

export function addMs(instant: UtcInstant, ms: bigint | number): UtcInstant {
  return new Date(Date.parse(instant) + Number(ms)).toISOString() as UtcInstant;
}

export function isExpired(expiresAt: UtcInstant, now: UtcInstant): boolean {
  return Date.parse(now) >= Date.parse(expiresAt);
}
