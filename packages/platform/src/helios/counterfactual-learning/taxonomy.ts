/**
 * HELIOS CF01 — Counterfactual learning research record (immutable decision episodes).
 * Extends Strategy Lab, forward-shadow, Grow, outcome-attribution, AAF V2, Execution Twin, Evidence Vault.
 * This is not a financial ledger; it stores research-time decisions and separate outcome attachments.
 */

export const HELIOS_COUNTERFACTUAL_LEARNING_SCHEMA =
  'sunrey.helios.counterfactual-learning.cf01.v1' as const;

export const HELIOS_CF01_DECISION_LEDGER_QUALIFIED = 'HELIOS_CF01_DECISION_LEDGER_QUALIFIED' as const;

export const HELIOS_CF01_DECISION_LEDGER_BLOCKED = 'HELIOS_CF01_DECISION_LEDGER_BLOCKED' as const;

/** Consequential portfolio / strategy actions considered at decision time */
export const COUNTERFACTUAL_ACTION_CLASSES = [
  'ENTER',
  'EXIT',
  'HOLD',
  'NO_ACTION',
  'WAIT',
  'SIZE_UP',
  'SIZE_DOWN',
  'REBALANCE',
  'ROUTE_ALTERNATIVE',
  'DELAY_ENTRY',
  'EARLY_EXIT',
] as const;

export type CounterfactualActionClass = (typeof COUNTERFACTUAL_ACTION_CLASSES)[number];
