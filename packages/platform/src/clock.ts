import type { UtcInstant } from '../../contracts/src/time.ts';
import { asUtcInstant } from '../../contracts/src/time.ts';

export interface Clock {
  now(): UtcInstant;
}

export const systemClock: Clock = {
  now: () => asUtcInstant(new Date().toISOString()),
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
}
