import type { OrderStatus } from '../taxonomy.ts';

/**
 * Server-side order lifecycle. User-supplied status is ignored.
 * VALIDATING and ACCEPTED are productized Phase G states; AUTHORIZED
 * remains the Kernel-allow checkpoint already used by the service.
 */
export const PRODUCTIZED_ORDER_STATES = [
  'CREATED',
  'VALIDATING',
  'REJECTED',
  'AUTHORIZED',
  'ACCEPTED',
  'OPEN',
  'PARTIALLY_FILLED',
  'FILLED',
  'CANCEL_PENDING',
  'CANCELLED',
  'EXPIRED',
  'SUSPENDED',
] as const;
export type ProductizedOrderState = (typeof PRODUCTIZED_ORDER_STATES)[number];

export const TERMINAL_ORDER_STATES = ['REJECTED', 'FILLED', 'CANCELLED', 'EXPIRED'] as const;

export const ORDER_TRANSITIONS: {
  readonly [S in ProductizedOrderState]: readonly ProductizedOrderState[];
} = {
  CREATED: ['VALIDATING', 'REJECTED'],
  VALIDATING: ['REJECTED', 'AUTHORIZED', 'ACCEPTED'],
  AUTHORIZED: ['ACCEPTED', 'REJECTED'],
  ACCEPTED: ['OPEN', 'REJECTED'],
  OPEN: ['PARTIALLY_FILLED', 'FILLED', 'CANCEL_PENDING', 'CANCELLED', 'EXPIRED', 'SUSPENDED'],
  PARTIALLY_FILLED: ['PARTIALLY_FILLED', 'FILLED', 'CANCEL_PENDING', 'CANCELLED', 'EXPIRED', 'SUSPENDED'],
  CANCEL_PENDING: ['CANCELLED', 'PARTIALLY_FILLED', 'FILLED'],
  FILLED: [],
  CANCELLED: [],
  REJECTED: [],
  EXPIRED: [],
  SUSPENDED: ['OPEN', 'CANCELLED', 'EXPIRED', 'PARTIALLY_FILLED'],
};

export function isProductizedOrderState(value: string): value is ProductizedOrderState {
  return (PRODUCTIZED_ORDER_STATES as readonly string[]).includes(value);
}

export function isTerminalOrderState(state: ProductizedOrderState): boolean {
  return (TERMINAL_ORDER_STATES as readonly string[]).includes(state);
}

export function canTransitionOrder(from: ProductizedOrderState, to: ProductizedOrderState): boolean {
  return ORDER_TRANSITIONS[from].includes(to);
}

export function transitionOrder(
  from: OrderStatus | ProductizedOrderState,
  to: ProductizedOrderState,
): { readonly ok: true; readonly state: ProductizedOrderState } | { readonly ok: false; readonly code: 'ILLEGAL_ORDER_TRANSITION' } {
  if (!isProductizedOrderState(from)) {
    return { ok: false, code: 'ILLEGAL_ORDER_TRANSITION' };
  }
  if (!canTransitionOrder(from, to)) {
    return { ok: false, code: 'ILLEGAL_ORDER_TRANSITION' };
  }
  return { ok: true, state: to };
}

export function cancellableStates(): readonly ProductizedOrderState[] {
  return ['OPEN', 'PARTIALLY_FILLED', 'CANCEL_PENDING', 'SUSPENDED'];
}

export function isCancellable(state: OrderStatus | ProductizedOrderState): boolean {
  return (cancellableStates() as readonly string[]).includes(state);
}
