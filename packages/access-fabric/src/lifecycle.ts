import type { ReservationState } from './types.ts';

const TRANSITIONS: Readonly<Record<ReservationState, readonly ReservationState[]>> = {
  REQUESTED: ['HELD', 'CANCELLED', 'FAILED'],
  HELD: ['CONFIRMED', 'CANCELLED', 'EXPIRED', 'FAILED'],
  CONFIRMED: ['ACTIVE', 'CANCELLED', 'FAILED', 'DISPUTED'],
  ACTIVE: ['COMPLETED', 'CANCELLED', 'FAILED', 'DISPUTED'],
  COMPLETED: [],
  CANCELLED: [],
  EXPIRED: [],
  FAILED: [],
  DISPUTED: ['CANCELLED', 'FAILED', 'ACTIVE'],
};

export function canTransitionReservation(from: ReservationState, to: ReservationState): boolean {
  return TRANSITIONS[from].includes(to);
}

export function isTerminalReservationState(state: ReservationState): boolean {
  return TRANSITIONS[state].length === 0;
}

export function holdsCapacity(state: ReservationState): boolean {
  return state === 'HELD' || state === 'CONFIRMED' || state === 'ACTIVE';
}

export function softHoldState(state: ReservationState): boolean {
  return state === 'HELD';
}

export function firmReservationState(state: ReservationState): boolean {
  return state === 'CONFIRMED' || state === 'ACTIVE';
}
