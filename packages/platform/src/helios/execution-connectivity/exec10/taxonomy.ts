/**
 * HELIOS EXECUTION CONNECTIVITY — EXEC10 cash, buying power, and financing control plane.
 */

export const HELIOS_EXEC10_SCHEMA = 'helios.exec10-financing-controls.v1' as const;

export const HELIOS_EXEC10_AUTHORITY = 'packages/platform/src/helios/execution-connectivity/exec10' as const;

export const HELIOS_EXEC10_FINANCING_CONTROLS_QUALIFIED =
  'HELIOS_EXEC10_FINANCING_CONTROLS_QUALIFIED' as const;

export const HELIOS_EXEC10_FINANCING_CONTROLS_BLOCKED = 'HELIOS_EXEC10_FINANCING_CONTROLS_BLOCKED' as const;

/** Default SunRey Grow posture — no hidden leverage paths. */
export const GROW_FINANCING_POSTURE_FLAGS = [
  'CASH_ONLY',
  'NO_MARGIN',
  'NO_SHORTING',
  'NO_NAKED_OPTIONS',
  'NO_UNBOUNDED_DERIVATIVE_EXPOSURE',
] as const;

export type GrowFinancingPostureFlag = (typeof GROW_FINANCING_POSTURE_FLAGS)[number];

export const DEFAULT_GROW_FINANCING_POSTURE: readonly GrowFinancingPostureFlag[] = Object.freeze([
  'CASH_ONLY',
  'NO_MARGIN',
  'NO_SHORTING',
  'NO_NAKED_OPTIONS',
  'NO_UNBOUNDED_DERIVATIVE_EXPOSURE',
]);

export const BUYING_POWER_VALIDATION_STATES = ['INFORMATIONAL_ONLY', 'MANDATE_VALIDATED', 'BLOCKED'] as const;

export type BuyingPowerValidationState = (typeof BUYING_POWER_VALIDATION_STATES)[number];

export const MARGIN_ENABLEMENT_GATES = ['REGULATORY', 'PROVIDER', 'EXTERNAL'] as const;

export type MarginEnablementGate = (typeof MARGIN_ENABLEMENT_GATES)[number];

export const SHORT_ENABLEMENT_GATES = [
  'BORROW_AVAILABILITY',
  'LOCATE_EVIDENCE',
  'SHORT_ELIGIBILITY',
  'RISK_APPROVAL',
] as const;

export type ShortEnablementGate = (typeof SHORT_ENABLEMENT_GATES)[number];
