import { randomUUID } from 'node:crypto';

import type { UtcInstant } from '../../../domain/src/time.ts';
import type { AccessResourceKind } from '../types/access-right.ts';
import {
  freezeCapacityReservation,
  type CapacityReservation,
  type CapacityReservationState,
} from '../types/capacity-reservation.ts';

export type HoldCapacityInput = {
  readonly providerId: string;
  readonly resourceKind: AccessResourceKind;
  readonly quantity: number;
  readonly unit: string;
  readonly holdExpiresAt: UtcInstant;
  readonly idempotencyKey: string;
};

export type HoldCapacityResult =
  | { readonly ok: true; readonly reservation: CapacityReservation }
  | { readonly ok: false; readonly code: 'UNAVAILABLE' | 'PROVIDER_ERROR'; readonly detail: string };

export type CapacityProviderPort = {
  holdCapacity(input: HoldCapacityInput): Promise<HoldCapacityResult> | HoldCapacityResult;
  commitReservation(reservationId: string): Promise<CapacityReservation> | CapacityReservation;
  releaseReservation(reservationId: string): Promise<CapacityReservation> | CapacityReservation;
};

export type ProviderCapability = {
  readonly providerId: string;
  readonly resourceKind: AccessResourceKind;
  readonly unit: string;
  readonly availableQuantity: number;
  readonly simulationOnly: true;
};

export class SimulationCapacityProvider implements CapacityProviderPort {
  private readonly reservations = new Map<string, CapacityReservation>();
  private readonly capabilities: readonly ProviderCapability[];
  private readonly now: () => UtcInstant;
  private readonly failProviderIds: ReadonlySet<string>;

  constructor(input: {
    readonly capabilities: readonly ProviderCapability[];
    readonly now: () => UtcInstant;
    readonly failProviderIds?: ReadonlySet<string>;
  }) {
    this.capabilities = input.capabilities;
    this.now = input.now;
    this.failProviderIds = input.failProviderIds ?? new Set();
  }

  listCapabilities(): readonly ProviderCapability[] {
    return this.capabilities;
  }

  snapshot(): readonly CapacityReservation[] {
    return [...this.reservations.values()];
  }

  holdCapacity(input: HoldCapacityInput): HoldCapacityResult {
    if (this.failProviderIds.has(input.providerId)) {
      return { ok: false, code: 'PROVIDER_ERROR', detail: `provider ${input.providerId} simulated failure` };
    }
    const cap = this.capabilities.find(
      (row) => row.providerId === input.providerId && row.resourceKind === input.resourceKind,
    );
    if (!cap || cap.availableQuantity < input.quantity) {
      return {
        ok: false,
        code: 'UNAVAILABLE',
        detail: `insufficient capacity for ${input.resourceKind} at ${input.providerId}`,
      };
    }
    const existing = [...this.reservations.values()].find(
      (row) => row.idempotencyKey === input.idempotencyKey && row.state !== 'RELEASED',
    );
    if (existing) {
      return { ok: true, reservation: existing };
    }
    const reservation = freezeCapacityReservation({
      reservationId: randomUUID(),
      providerId: input.providerId,
      resourceKind: input.resourceKind,
      quantity: input.quantity,
      unit: input.unit,
      state: 'HELD',
      holdExpiresAt: input.holdExpiresAt,
      committedAt: null,
      releasedAt: null,
      idempotencyKey: input.idempotencyKey,
      evidenceId: null,
    });
    this.reservations.set(reservation.reservationId, reservation);
    return { ok: true, reservation };
  }

  commitReservation(reservationId: string): CapacityReservation {
    const row = this.requireReservation(reservationId, 'HELD');
    const committed = freezeCapacityReservation({
      ...row,
      state: 'COMMITTED',
      committedAt: this.now(),
      holdExpiresAt: null,
    });
    this.reservations.set(reservationId, committed);
    return committed;
  }

  releaseReservation(reservationId: string): CapacityReservation {
    const row = this.reservations.get(reservationId);
    if (!row) {
      throw new Error(`reservation not found: ${reservationId}`);
    }
    if (row.state === 'RELEASED' || row.state === 'COMMITTED') {
      return row;
    }
    const released = freezeCapacityReservation({
      ...row,
      state: 'RELEASED',
      releasedAt: this.now(),
      holdExpiresAt: null,
    });
    this.reservations.set(reservationId, released);
    return released;
  }

  private requireReservation(reservationId: string, state: CapacityReservationState): CapacityReservation {
    const row = this.reservations.get(reservationId);
    if (!row) {
      throw new Error(`reservation not found: ${reservationId}`);
    }
    if (row.state !== state) {
      throw new Error(`reservation ${reservationId} is ${row.state}, expected ${state}`);
    }
    return row;
  }
}
