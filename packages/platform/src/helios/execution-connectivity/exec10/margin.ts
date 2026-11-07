import type { UtcInstant } from '@solstice/domain';
import type { MarginState } from './types.ts';
import { HELIOS_EXEC10_SCHEMA, MARGIN_ENABLEMENT_GATES } from './taxonomy.ts';

export type BuildMarginStateInput = {
  readonly brokerReportedExcessMinor: string | null;
  readonly gateOverrides?: Partial<Record<(typeof MARGIN_ENABLEMENT_GATES)[number], boolean>>;
  readonly asOf: UtcInstant;
};

/**
 * Architectural margin support for future regulated use. `marginEnabled` stays false
 * unless every external/provider/regulatory gate is explicitly open (not default).
 */
export function buildMarginState(input: BuildMarginStateInput): MarginState {
  const gates = MARGIN_ENABLEMENT_GATES.map((gate) =>
    Object.freeze({
      gate,
      open: input.gateOverrides?.[gate] === true,
    }),
  );
  const allOpen = gates.every((row) => row.open);

  void allOpen;
  return Object.freeze({
    schemaVersion: HELIOS_EXEC10_SCHEMA,
    marginEnabled: false,
    gates: Object.freeze(gates),
    brokerReportedExcessMinor: input.brokerReportedExcessMinor,
    ignoredForExecution: true,
    asOf: input.asOf,
  });
}

export function marginWouldBeEnabled(input: BuildMarginStateInput): boolean {
  const state = buildMarginState(input);
  return state.gates.every((row) => row.open);
}
