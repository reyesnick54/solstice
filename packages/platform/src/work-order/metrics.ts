/**
 * Safe diagnostics counters for Economic Work Orders.
 * No customer-identifying payload is recorded.
 */

export type WorkOrderMetricsSnapshot = {
  readonly created: number;
  readonly active: number;
  readonly paused: number;
  readonly blocked: number;
  readonly completed: number;
  readonly cancelled: number;
  readonly expired: number;
  readonly failed: number;
  readonly failedTransitionAttempts: number;
};

export class WorkOrderMetrics {
  private created = 0;
  private active = 0;
  private paused = 0;
  private blocked = 0;
  private completed = 0;
  private cancelled = 0;
  private expired = 0;
  private failed = 0;
  private failedTransitionAttempts = 0;

  recordCreated(): void {
    this.created += 1;
  }

  recordState(state: string): void {
    switch (state) {
      case 'ACTIVE':
        this.active += 1;
        break;
      case 'PAUSED':
        this.paused += 1;
        break;
      case 'BLOCKED':
        this.blocked += 1;
        break;
      case 'COMPLETED':
        this.completed += 1;
        break;
      case 'CANCELLED':
        this.cancelled += 1;
        break;
      case 'EXPIRED':
        this.expired += 1;
        break;
      case 'FAILED':
        this.failed += 1;
        break;
      default:
        break;
    }
  }

  recordFailedTransition(): void {
    this.failedTransitionAttempts += 1;
  }

  snapshot(): WorkOrderMetricsSnapshot {
    return Object.freeze({
      created: this.created,
      active: this.active,
      paused: this.paused,
      blocked: this.blocked,
      completed: this.completed,
      cancelled: this.cancelled,
      expired: this.expired,
      failed: this.failed,
      failedTransitionAttempts: this.failedTransitionAttempts,
    });
  }
}
