export interface Clock {
  now(): Date;
}

export const systemClock: Clock = {
  now: () => new Date(),
};

export class FrozenClock implements Clock {
  constructor(private instant: Date) {}

  now(): Date {
    return this.instant;
  }

  advance(ms: number): void {
    this.instant = new Date(this.instant.getTime() + ms);
  }
}
