import type { Clock } from '../../../../config/src/clock.ts';
import { addMs } from '../../../../config/src/clock.ts';
import type { UtcInstant } from '../../../../domain/src/time.ts';

export type S3mCircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export class S3mCircuitBreaker {
  private consecutiveFailures = 0;
  private state: S3mCircuitState = 'CLOSED';
  private openedAt: UtcInstant | null = null;
  private readonly failureThreshold: number;
  private readonly cooldownMs: number;
  private readonly clock: Clock;

  constructor(clock: Clock, failureThreshold: number, cooldownMs: number) {
    this.clock = clock;
    this.failureThreshold = failureThreshold;
    this.cooldownMs = cooldownMs;
  }

  currentState(): S3mCircuitState {
    this.maybeHalfOpen();
    return this.state;
  }

  allowRequest(): boolean {
    this.maybeHalfOpen();
    return this.state !== 'OPEN';
  }

  recordSuccess(): void {
    this.consecutiveFailures = 0;
    this.state = 'CLOSED';
    this.openedAt = null;
  }

  recordFailure(): void {
    this.consecutiveFailures += 1;
    if (this.state === 'HALF_OPEN' || this.consecutiveFailures >= this.failureThreshold) {
      this.state = 'OPEN';
      this.openedAt = this.clock.now();
    }
  }

  private maybeHalfOpen(): void {
    if (this.state !== 'OPEN' || !this.openedAt) {
      return;
    }
    if (this.clock.now() >= addMs(this.openedAt, this.cooldownMs)) {
      this.state = 'HALF_OPEN';
    }
  }
}
