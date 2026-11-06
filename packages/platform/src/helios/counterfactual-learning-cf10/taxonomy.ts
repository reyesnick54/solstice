/**
 * HELIOS CF10 — counterfactual decision regret and gate attribution (ESTIMATED semantics).
 * Simulation / learning artifact only. Does not grant Execution Authority, loosen gates,
 * or override Risk, Compliance, or mandate policy.
 */

/** Qualification marker for CF10 attribution surfaces. */
export const HELIOS_CF10_DECISION_ATTRIBUTION_QUALIFIED =
  'HELIOS_CF10_DECISION_ATTRIBUTION_QUALIFIED' as const;

export const HELIOS_COUNTERFACTUAL_LEARNING_CF10_SCHEMA =
  'sunrey.helios.counterfactual-learning.cf10.v1' as const;

export const HELIOS_CF10_GATE_FAMILIES = [
  'DATA_QUALITY',
  'AAF',
  'RESEARCH',
  'VALUATION',
  'STRATEGY',
  'RISK',
  'LIQUIDITY',
  'EXECUTION',
  'MANDATE',
  'COMPLIANCE',
  'CAPITAL_ALLOCATION',
  'HUMAN_REVIEW',
] as const;

export type HeliosCf10GateFamily = (typeof HELIOS_CF10_GATE_FAMILIES)[number];

/** Gate families whose rejections must not be auto-scored as “costly” from price path alone. */
export const HELIOS_CF10_POLICY_PROTECTIVE_GATE_FAMILIES: readonly HeliosCf10GateFamily[] = Object.freeze([
  'RISK',
  'COMPLIANCE',
  'MANDATE',
]);

export const HELIOS_CF10_REJECTION_CLASSIFICATIONS = [
  'REJECTION_APPEARS_PROTECTIVE',
  'REJECTION_APPEARS_COSTLY',
  'MIXED',
  'INCONCLUSIVE',
] as const;

export type HeliosCf10RejectionClassification = (typeof HELIOS_CF10_REJECTION_CLASSIFICATIONS)[number];

export function isHeliosCf10GateFamily(value: string): value is HeliosCf10GateFamily {
  return (HELIOS_CF10_GATE_FAMILIES as readonly string[]).includes(value);
}
