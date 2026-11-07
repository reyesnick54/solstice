/**
 * EXEC01 — capital reservation facts for broker connectivity (simulation only).
 */

import type { UtcInstant } from '@solstice/domain';

export type BrokerCapitalReservationFact = {
  readonly factKind: 'BROKER_CAPITAL_RESERVATION';
  readonly reservationId: string;
  readonly brokerAccountId: string;
  readonly orderId: string;
  readonly amountMinorUnits: string;
  readonly currency: string;
  readonly reservedAt: UtcInstant;
  readonly releasedAt: UtcInstant | null;
  readonly simulation: true;
  readonly liveReservation: false;
};

export type BrokerCapitalReservationPort = {
  readonly reserveForOrder: (input: {
    readonly orderId: string;
    readonly brokerAccountId: string;
    readonly amountMinorUnits: string;
    readonly currency: string;
    readonly idempotencyKey: string;
  }) =>
    | { readonly ok: true; readonly reservationId: string; readonly fact: BrokerCapitalReservationFact }
    | { readonly ok: false; readonly message: string };
  readonly release: (input: { readonly reservationId: string; readonly reason: string }) => void;
};
