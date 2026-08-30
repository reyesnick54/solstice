/**
 * Provider audit trail — no secrets or raw provider payloads.
 */

import type { AccessProviderId } from './types.ts';

export type ProviderAuditEvent = {
  readonly providerId: AccessProviderId;
  readonly operation: string;
  readonly correlationId: string;
  readonly outcome: 'ATTEMPT' | 'SUCCESS' | 'FAILURE' | 'REJECTED';
  readonly at: string;
  readonly code?: string;
};

export type ProviderAuditPort = {
  readonly record: (event: ProviderAuditEvent) => void;
  readonly list: () => readonly ProviderAuditEvent[];
};

export class InMemoryProviderAuditPort implements ProviderAuditPort {
  private readonly events: ProviderAuditEvent[] = [];

  record(event: ProviderAuditEvent): void {
    this.events.push(Object.freeze({ ...event }));
  }

  list(): readonly ProviderAuditEvent[] {
    return Object.freeze([...this.events]);
  }
}

export class NoOpProviderAuditPort implements ProviderAuditPort {
  record(): void {
    return;
  }

  list(): readonly ProviderAuditEvent[] {
    return Object.freeze([]);
  }
}
