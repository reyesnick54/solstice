import type { KernelAuthorization } from '@solstice/kernel';
import type { Order } from './types.ts';

/**
 * Nominal brand. The matching engine accepts only this type.
 * The brand symbol is module-private. Forging a plain object fails
 * `assertClearedOrder` because it cannot hold the unique symbol.
 */
const CLEARED_BRAND: unique symbol = Symbol('solstice.ClearedOrder');

export type ComplianceClearance = {
  readonly clearanceId: string;
  readonly evidenceId: string;
  readonly authorization: KernelAuthorization;
  readonly checks: readonly string[];
};

export type ClearedOrder = {
  readonly [CLEARED_BRAND]: typeof CLEARED_BRAND;
  readonly order: Order;
  readonly clearance: ComplianceClearance;
};

/**
 * The only function that can construct a ClearedOrder.
 * Imported solely by the Compliance Gateway. Not re-exported from the package index.
 */
export function mintClearedOrder(order: Order, clearance: ComplianceClearance): ClearedOrder {
  return Object.freeze({
    [CLEARED_BRAND]: CLEARED_BRAND,
    order: Object.freeze({ ...order, state: 'CLEARED' as const }),
    clearance: Object.freeze({ ...clearance, checks: Object.freeze(clearance.checks.slice()) }),
  });
}

export function isClearedOrder(value: unknown): value is ClearedOrder {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as { readonly [CLEARED_BRAND]?: unknown })[CLEARED_BRAND] === CLEARED_BRAND
  );
}

export function assertClearedOrder(value: unknown): asserts value is ClearedOrder {
  if (!isClearedOrder(value)) {
    throw new TypeError(
      'MatchingEngine refuses non-cleared orders: a ClearedOrder minted by the Compliance Gateway is required',
    );
  }
}
