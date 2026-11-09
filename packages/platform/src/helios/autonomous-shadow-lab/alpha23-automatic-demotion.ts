/**
 * ALPHA23 — automatic strategy demotion from forward decay signals.
 * Canonical: `packages/platform/src/helios/forward-alpha/alpha23`.
 */

export const HELIOS_ALPHA23_AUTOMATIC_DEMOTION = 'HELIOS_ALPHA23_AUTOMATIC_DEMOTION' as const;

export {
  evaluateAlpha23Qualification,
  evaluateAlpha23AutomaticDemotion,
  HELIOS_ALPHA23_AUTOMATIC_DEMOTION_QUALIFIED,
} from '../forward-alpha/alpha23/index.ts';
