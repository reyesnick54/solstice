/**
 * ALPHA19 — forward outcome maturity queue (shadow only).
 * Canonical: `packages/platform/src/helios/forward-alpha/alpha19`.
 */

export const HELIOS_ALPHA19_OUTCOME_MATURITY = 'HELIOS_ALPHA19_OUTCOME_MATURITY' as const;

export {
  evaluateAlpha19OutcomeMaturityQualification,
  HELIOS_ALPHA19_OUTCOME_MATURITY_QUALIFIED,
} from '../forward-alpha/alpha19/index.ts';
