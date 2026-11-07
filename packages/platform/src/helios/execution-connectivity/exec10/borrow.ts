import type { UtcInstant } from '@solstice/domain';
import type { BorrowState } from './types.ts';
import { HELIOS_EXEC10_SCHEMA, SHORT_ENABLEMENT_GATES } from './taxonomy.ts';

export type BuildBorrowStateInput = {
  readonly gateOverrides?: Partial<Record<(typeof SHORT_ENABLEMENT_GATES)[number], boolean>>;
  readonly asOf: UtcInstant;
};

/**
 * Shorting remains disabled until borrow, locate, eligibility, and Risk gates exist.
 */
export function buildBorrowState(input: BuildBorrowStateInput): BorrowState {
  const gates = SHORT_ENABLEMENT_GATES.map((gate) =>
    Object.freeze({
      gate,
      satisfied: input.gateOverrides?.[gate] === true,
    }),
  );

  return Object.freeze({
    schemaVersion: HELIOS_EXEC10_SCHEMA,
    shortingEnabled: false,
    borrowAvailable: false,
    gates: Object.freeze(gates),
    asOf: input.asOf,
  });
}

export function shortingWouldBeEnabled(input: BuildBorrowStateInput): boolean {
  const state = buildBorrowState(input);
  return state.gates.every((row) => row.satisfied);
}
