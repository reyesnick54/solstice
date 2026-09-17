export type ConcurrencyScope = 'global' | 'provider' | 'model' | 'customer' | 'workOrder';

export type ConcurrencyLimits = {
  readonly global: number;
  readonly provider: number;
  readonly model: number;
  readonly customer: number;
  readonly workOrder: number;
};

export const DEFAULT_CONCURRENCY_LIMITS: ConcurrencyLimits = Object.freeze({
  global: 32,
  provider: 8,
  model: 4,
  customer: 4,
  workOrder: 2,
});

type SlotKey = string;

export class ConcurrencyGate {
  private readonly limits: ConcurrencyLimits;
  private readonly active = new Map<SlotKey, number>();
  private readonly waiters: Array<{ readonly key: SlotKey; readonly resolve: () => void }> = [];

  constructor(limits: ConcurrencyLimits = DEFAULT_CONCURRENCY_LIMITS) {
    this.limits = limits;
  }

  queueDepth(): number {
    return this.waiters.length;
  }

  activeCount(scope: ConcurrencyScope, id = 'global'): number {
    return this.active.get(this.scopeKey(scope, id)) ?? 0;
  }

  async acquire(input: {
    readonly provider: string;
    readonly model: string;
    readonly customerId: string;
    readonly workOrderId: string | null;
  }): Promise<() => void> {
    const keys: Array<{ readonly scope: ConcurrencyScope; readonly id: string; readonly limit: number }> = [
      { scope: 'global', id: 'global', limit: this.limits.global },
      { scope: 'provider', id: input.provider, limit: this.limits.provider },
      { scope: 'model', id: input.model, limit: this.limits.model },
      { scope: 'customer', id: input.customerId, limit: this.limits.customer },
    ];
    if (input.workOrderId) {
      keys.push({ scope: 'workOrder', id: input.workOrderId, limit: this.limits.workOrder });
    }
    for (const key of keys) {
      await this.waitForSlot(key.scope, key.id, key.limit);
      this.increment(key.scope, key.id);
    }
    let released = false;
    return () => {
      if (released) return;
      released = true;
      for (const key of keys) {
        this.decrement(key.scope, key.id);
      }
    };
  }

  private scopeKey(scope: ConcurrencyScope, id: string): SlotKey {
    return `${scope}:${id}`;
  }

  private increment(scope: ConcurrencyScope, id: string): void {
    const key = this.scopeKey(scope, id);
    this.active.set(key, (this.active.get(key) ?? 0) + 1);
  }

  private decrement(scope: ConcurrencyScope, id: string): void {
    const key = this.scopeKey(scope, id);
    const next = (this.active.get(key) ?? 1) - 1;
    if (next <= 0) {
      this.active.delete(key);
    } else {
      this.active.set(key, next);
    }
    this.drainWaiters();
  }

  private async waitForSlot(scope: ConcurrencyScope, id: string, limit: number): Promise<void> {
    while ((this.active.get(this.scopeKey(scope, id)) ?? 0) >= limit) {
      await new Promise<void>((resolve) => {
        this.waiters.push({ key: this.scopeKey(scope, id), resolve });
      });
    }
  }

  private drainWaiters(): void {
    const remaining: typeof this.waiters = [];
    for (const waiter of this.waiters) {
      const [scope, id] = waiter.key.split(':') as [ConcurrencyScope, string];
      const limit = this.limitFor(scope);
      if ((this.active.get(waiter.key) ?? 0) < limit) {
        waiter.resolve();
      } else {
        remaining.push(waiter);
      }
    }
    this.waiters.length = 0;
    this.waiters.push(...remaining);
  }

  private limitFor(scope: ConcurrencyScope): number {
    switch (scope) {
      case 'global':
        return this.limits.global;
      case 'provider':
        return this.limits.provider;
      case 'model':
        return this.limits.model;
      case 'customer':
        return this.limits.customer;
      case 'workOrder':
        return this.limits.workOrder;
      default: {
        const _exhaustive: never = scope;
        return _exhaustive;
      }
    }
  }
}
