import type { CapacityReservationId } from './ids.ts';

/**
 * Settlement intent port. The reservation engine emits intents; canonical
 * settlement systems execute monetary flows. No money moves here.
 */
export type CapacitySettlementIntent = {
  readonly intentId: string;
  readonly reservationId: CapacityReservationId;
  readonly accountId: string;
  readonly actorId: string;
  readonly kind: 'RESERVATION_CONFIRMED' | 'RESERVATION_COMPLETED' | 'RESERVATION_CANCELLED';
  readonly createdAt: string;
};

export type SettlementIntentPort = {
  emit(intent: CapacitySettlementIntent): void;
  listByReservation(reservationId: CapacityReservationId): readonly CapacitySettlementIntent[];
};

export class InMemorySettlementIntentPort implements SettlementIntentPort {
  private readonly byReservation = new Map<string, CapacitySettlementIntent[]>();
  private readonly all: CapacitySettlementIntent[] = [];

  emit(intent: CapacitySettlementIntent): void {
    const frozen = Object.freeze({ ...intent });
    this.all.push(frozen);
    const key = intent.reservationId as string;
    const rows = this.byReservation.get(key) ?? [];
    rows.push(frozen);
    this.byReservation.set(key, rows);
  }

  listByReservation(reservationId: CapacityReservationId): readonly CapacitySettlementIntent[] {
    return this.byReservation.get(reservationId as string) ?? [];
  }

  listAll(): readonly CapacitySettlementIntent[] {
    return this.all;
  }
}
