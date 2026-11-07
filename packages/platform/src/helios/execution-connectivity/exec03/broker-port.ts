import type { ProviderOrderLookupSignal } from './types.ts';

export type FixtureBrokerSubmitRequest = {
  readonly clientOrderId: string;
  readonly operationId: string;
  readonly instrumentId: string;
  readonly side: 'BUY' | 'SELL';
  readonly quantityUnits: string;
};

export type FixtureBrokerSubmitOutcome =
  | {
      readonly kind: 'ACKNOWLEDGED';
      readonly providerOrderId: string;
    }
  | {
      readonly kind: 'CONFIRMED';
      readonly providerOrderId: string;
    }
  | {
      readonly kind: 'REJECTED';
      readonly providerOrderId: string;
    }
  | {
      readonly kind: 'TIMEOUT_AFTER_ACCEPT';
    }
  | {
      readonly kind: 'UNAVAILABLE';
      readonly message: string;
    };

export type FixtureBrokerQueryRequest = {
  readonly clientOrderId: string;
  readonly operationId: string;
};

/**
 * Injected simulation broker for EXEC03 qualification.
 * Counts external order creations for exactly-once property tests.
 */
export class FixtureExec03BrokerPort {
  readonly providerId: string;
  readonly liveBrokerConnected = false as const;

  private readonly externalOrders = new Map<
    string,
    {
      readonly clientOrderId: string;
      readonly operationId: string;
      readonly providerOrderId: string;
      readonly status: 'ACKNOWLEDGED' | 'CONFIRMED' | 'REJECTED' | 'OPEN';
    }
  >();
  private readonly dropCopyByClient = new Map<string, ProviderOrderLookupSignal>();
  private orderCounter = 0;
  private submitBehavior: FixtureBrokerSubmitOutcome['kind'] = 'ACKNOWLEDGED';
  private externalSubmitCount = 0;

  constructor(providerId = 'fixture_exec03_broker_v1') {
    this.providerId = providerId;
  }

  setSubmitBehavior(kind: FixtureBrokerSubmitOutcome['kind']): void {
    this.submitBehavior = kind;
  }

  externalOrderCount(): number {
    return this.externalSubmitCount;
  }

  submit(request: FixtureBrokerSubmitRequest): FixtureBrokerSubmitOutcome {
    const existing = this.externalOrders.get(request.clientOrderId);
    if (existing) {
      return {
        kind: existing.status === 'REJECTED' ? 'REJECTED' : 'ACKNOWLEDGED',
        providerOrderId: existing.providerOrderId,
      };
    }

    if (this.submitBehavior === 'UNAVAILABLE') {
      return { kind: 'UNAVAILABLE', message: 'fixture broker unavailable' };
    }

    this.externalSubmitCount += 1;
    this.orderCounter += 1;
    const providerOrderId = `brk_ord_${String(this.orderCounter).padStart(8, '0')}`;

    if (this.submitBehavior === 'TIMEOUT_AFTER_ACCEPT') {
      this.externalOrders.set(request.clientOrderId, {
        clientOrderId: request.clientOrderId,
        operationId: request.operationId,
        providerOrderId,
        status: 'OPEN',
      });
      return { kind: 'TIMEOUT_AFTER_ACCEPT' };
    }

    const status =
      this.submitBehavior === 'REJECTED'
        ? 'REJECTED'
        : this.submitBehavior === 'CONFIRMED'
          ? 'CONFIRMED'
          : 'ACKNOWLEDGED';

    this.externalOrders.set(request.clientOrderId, {
      clientOrderId: request.clientOrderId,
      operationId: request.operationId,
      providerOrderId,
      status,
    });

    return { kind: this.submitBehavior, providerOrderId } as FixtureBrokerSubmitOutcome;
  }

  queryByClientOrderId(clientOrderId: string, observedAt: string): ProviderOrderLookupSignal {
    const row = this.externalOrders.get(clientOrderId);
    if (!row) {
      return Object.freeze({
        source: 'BROKER_QUERY',
        found: false,
        providerOrderId: null,
        status: null,
        observedAt,
      });
    }
    const status =
      row.status === 'OPEN' ? 'OPEN' : row.status === 'CONFIRMED' ? 'CONFIRMED' : 'ACKNOWLEDGED';
    return Object.freeze({
      source: 'BROKER_QUERY',
      found: true,
      providerOrderId: row.providerOrderId,
      status,
      observedAt,
    });
  }

  dropCopySignal(clientOrderId: string, observedAt: string): ProviderOrderLookupSignal {
    const cached = this.dropCopyByClient.get(clientOrderId);
    if (cached) {
      return cached;
    }
    const broker = this.queryByClientOrderId(clientOrderId, observedAt);
    if (!broker.found) {
      return Object.freeze({
        source: 'DROP_COPY',
        found: false,
        providerOrderId: null,
        status: null,
        observedAt,
      });
    }
    return Object.freeze({
      source: 'DROP_COPY',
      found: true,
      providerOrderId: broker.providerOrderId,
      status: broker.status,
      observedAt,
    });
  }

  openOrdersSignal(clientOrderId: string, observedAt: string): ProviderOrderLookupSignal {
    const row = this.externalOrders.get(clientOrderId);
    if (!row) {
      return Object.freeze({
        source: 'OPEN_ORDERS',
        found: false,
        providerOrderId: null,
        status: null,
        observedAt,
      });
    }
    return Object.freeze({
      source: 'OPEN_ORDERS',
      found: true,
      providerOrderId: row.providerOrderId,
      status: row.status === 'OPEN' ? 'OPEN' : 'ACKNOWLEDGED',
      observedAt,
    });
  }

  seedDropCopy(clientOrderId: string, signal: ProviderOrderLookupSignal): void {
    this.dropCopyByClient.set(clientOrderId, signal);
  }

  reset(): void {
    this.externalOrders.clear();
    this.dropCopyByClient.clear();
    this.orderCounter = 0;
    this.externalSubmitCount = 0;
    this.submitBehavior = 'ACKNOWLEDGED';
  }
}
