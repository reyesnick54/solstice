/**
 * ALPHA21 — continuous shadow portfolio book (no customer ledger posts).
 * Canonical: `packages/platform/src/helios/forward-alpha/alpha21`.
 */

export const HELIOS_ALPHA21_CONTINUOUS_SHADOW_PORTFOLIO = 'HELIOS_ALPHA21_CONTINUOUS_SHADOW_PORTFOLIO' as const;

export {
  evaluateAlpha21ContinuousShadowRuntimeQualification,
  HELIOS_ALPHA21_CONTINUOUS_SHADOW_RUNTIME_QUALIFIED,
  ShadowPortfolioRuntime,
  PaperPortfolioRuntime,
} from '../forward-alpha/alpha21/index.ts';
