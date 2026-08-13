export interface Clock {
  now(): Date;
}

export const systemClock: Clock = {
  now: () => new Date(),
};

export class FrozenClock implements Clock {
  private instant: Date;

  constructor(instant: Date) {
    this.instant = instant;
  }

  now(): Date {
    return this.instant;
  }

  advance(ms: number): void {
    this.instant = new Date(this.instant.getTime() + ms);
  }
}
