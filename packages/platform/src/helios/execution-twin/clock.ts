import type { UtcInstant } from '@solstice/domain';
import { asUtcInstant } from '@solstice/domain';

/**
 * Deterministic clock for execution twin runs.
 * Historical replay advances only through explicit schedule calls.
 */
export class ExecutionTwinClock {
  private currentMs: number;
  private readonly originMs: number;

  constructor(startAt: UtcInstant) {
    this.originMs = Date.parse(startAt);
    this.currentMs = this.originMs;
  }

  now(): UtcInstant {
    return asUtcInstant(new Date(this.currentMs).toISOString());
  }

  origin(): UtcInstant {
    return asUtcInstant(new Date(this.originMs).toISOString());
  }

  advanceTo(instant: UtcInstant): void {
    const next = Date.parse(instant);
    if (next < this.currentMs) {
      throw new Error('ExecutionTwinClock cannot move backwards during a run');
    }
    this.currentMs = next;
  }

  advanceByMs(deltaMs: number): UtcInstant {
    if (deltaMs < 0) {
      throw new Error('ExecutionTwinClock advanceByMs requires non-negative delta');
    }
    this.currentMs += deltaMs;
    return this.now();
  }

  elapsedMs(): number {
    return this.currentMs - this.originMs;
  }
}
