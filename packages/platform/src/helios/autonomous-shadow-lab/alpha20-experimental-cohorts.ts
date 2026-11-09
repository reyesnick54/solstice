/**
 * ALPHA20 — experimental forward cohorts (shadow capital only).
 * Canonical: `packages/platform/src/helios/forward-alpha/alpha20`.
 */

export const HELIOS_ALPHA20_EXPERIMENTAL_COHORTS = 'HELIOS_ALPHA20_EXPERIMENTAL_COHORTS' as const;

export {
  runForwardCohortExperimentPipeline,
  evaluateAlpha20ForwardExperimentsQualification,
  HELIOS_ALPHA20_FORWARD_EXPERIMENTS_QUALIFIED,
} from '../forward-alpha/alpha20/index.ts';
